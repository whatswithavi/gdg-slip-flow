# ARCHITECTURE.md

## 1. Overview

Slip Flow digitizes a business's handwritten paper registers — raw-material intake, production/batch logs, dispatch/sales, worker attendance, expense vouchers — using an LLM's vision capability, routes extracted data through a human approval step, stores approved records in a structured database, and exposes two owner-facing capabilities over that data: a citation-only natural-language query agent (covering both operational records and uploaded compliance documents) and a proactive daily activity digest. Every AI decision — extraction attempt, confidence score, approve/reject, query, digest — is logged to an audit trail.

**Track:** A — Business Process Automation

## 2. Problem Statement

Businesses that run on paper — raw-material intake slips, production logs, dispatch notes, attendance registers — have no searchable record of what happened and when, and the AI-driven digitization tools that exist are typically built for one document type at a time. This project is a **configurable platform**: the register types it can digitize are data (`server/registerTypes.ts`), not hardcoded logic, so the same extraction/approval/query/payroll/digest machinery works for a raw-material factory, a retail dispatch operation, or any other paper-heavy business without new agent code — a new paper form is a config entry. It's demonstrated end-to-end on a real plastic recycling factory's actual workflow.

## 3. System Architecture

```
[Flutter Web app: Upload screen]                [Flutter Web app: Insights screen]
        |  register type picker                          |  compliance doc upload
        v                                                  v
[POST /api/extract-record]              [POST /api/compliance-docs]
        |  --(image + registerType)-->                    |
        v                                                  v
[RegisterExtractionAgent]                        [compliance_docs, Firestore]
        |  (skill: extract_register_data,
        |   prompt/schema built from the
        |   register type's field config)
        v
   LLM vision call (server/llm.ts: Gemini primary,
   Groq automatic fallback on 429 — one call does
   OCR + structured extraction, no separate OCR step)
        |
        v
[records_pending, Firestore]  (+ audit_log: extraction)
        |
        v
[Flutter Web app: Approval screen] <-- human edits fields, dynamically
        |                                rendered per register type
   approve  /              \  reject
           v                  v
   [records, Firestore]  [audit_log: rejected]
           |
           v
   [audit_log: approved]


[Flutter Web app: Query screen]                 [Flutter Web app: Insights screen]
        |  natural-language question                     |  "Generate digest"
        v                                                  v
[POST /api/query] -> [QueryAgent]                [GET /api/digest] -> [DailyDigestAgent]
        |  (skill: answer_from_records)                    |  (skill: summarize_activity)
        v                                                  v
   LLM call (context = fetched records +          gathers recent approved-record counts,
   compliance docs; instructed to answer          low-confidence pending items, and
   ONLY from provided context)                    audit_log activity tallies, then asks
        |                                          the LLM to summarize
        v                                                  v
[Answer + citedRecordIds + citedDocIds]          [Summary + highlights]
   (+ audit_log: query)                             (+ audit_log: digest)


[GET /api/payroll?wageRate=...] -> calculatePayroll()   <- plain deterministic
   (server/services/payroll.ts — NOT an LLM call;           code, not a skill:
    sums approved `attendance` records per worker)           arithmetic doesn't
                                                               belong behind a
                                                               language model
```

## 4. Components

### 4.1 Frontend

- **Tech:** Flutter, Web-first (compiles to a real page — Playwright-testable, matches the hackathon's recommended testing approach), also buildable to Android via the already-registered Firebase app (`com.aavii.gdg`).
  - **Build note:** CI/demo builds use `flutter build web --debug` — a `dart2js` release-mode bug in Firebase's JS interop crashes at runtime on this Flutter/Dart version (see `DECISIONS.md`); the debug (DDC) compiler doesn't hit it and produces a fully functional static build.
- **Design system:** ported from the existing `aavii_website` Flutter app (colors, dark-mode-aware theme, shared rounded/soft-shadow widgets) as fresh files, not a dependency on that repo.
- **Screens** (`lib/screens/`):
  - **Upload** — register-type picker (pill chips, driven by `GET /api/register-types`) + camera/gallery capture; result card renders whichever fields that type defines.
  - **Approval** — pending records as cards; each card's editable fields are built dynamically from the matching register type's field schema (one widget handles all 5 register types).
  - **Query** — natural-language question box; answer shows both record citations and compliance-doc citations separately.
  - **Insights** — combines the daily digest ("Generate digest" button + summary/highlights) and the compliance document library (upload form + list), kept as one tab rather than two since neither has enough content alone to justify a 5-tab bar.

### 4.2 Backend

- **Tech:** Node.js/TypeScript/Express — `routes/` → `agents/` → `skills/` (+ `services/` for non-LLM business logic) shape, same pattern proven in this hackathon's earlier Track B build.
- **Responsibilities:** agent orchestration (extraction, query, digest), payroll calculation, Firestore access via `firebase-admin` (service-account credential, server-side only — never exposed to the client), audit logging.

### 4.3 LLM provider (`server/llm.ts`)

- **Primary:** Gemini (`gemini-flash-latest`) — one multimodal call does OCR + structured extraction together for images; text calls for query/digest.
- **Automatic fallback:** Groq (`qwen/qwen3.6-27b` for vision, `openai/gpt-oss-20b` for text), triggered **specifically on a 429 quota error** — not on other failures, so a real bug still fails loudly instead of silently retrying against a different provider. This is the multi-provider resilience pattern the hackathon brief itself recommends. Verified live: Gemini's free-tier quota was genuinely exhausted during development, so the full extraction/query/digest path has been end-to-end tested running entirely on the Groq fallback, not just the primary provider.
- Deliberately simpler than the originally planned Google Cloud Vision + separate LLM extraction: avoids a second untested credential path.

### 4.4 Custom Agent 1 — `RegisterExtractionAgent`

- Input: a document image + a `registerType` id
- Output: structured fields (per that type's schema) + a confidence score
- Writes to `records_pending`, never directly to `records`
- Logs its extraction attempt and confidence to `audit_log`

### 4.5 Custom Skill — `extract_register_data`

- Reusable capability used by `RegisterExtractionAgent`: builds the prompt and expected output schema **dynamically from a `RegisterTypeConfig`** (`server/registerTypes.ts`) rather than hardcoded field names — this is what makes a new paper form a config entry, not new prompt-engineering code.

### 4.6 Custom Agent 2 — `QueryAgent`

- Input: a natural-language question
- Fetches approved records *and* uploaded compliance documents from Firestore, feeds both to the LLM as context, and instructs it to answer **only** from what's provided
- Returns the answer with separate citation lists (`citedRecordIds`, `citedDocIds`) — never fabricates data not present in the fetched context

### 4.7 Custom Skill — `answer_from_records`

- Reusable capability used by `QueryAgent`: owns the "answer only from provided context, always cite" prompt contract — the mechanism that makes the no-hallucination guarantee enforceable rather than just a hope.

### 4.8 Custom Agent 3 — `DailyDigestAgent`

- **Proactive, not reactive** (unlike the two agents above, which respond to a specific upload or question): gathers recent approved-record counts by register type, flags low-confidence pending items needing review, and tallies recent `audit_log` activity, then asks the LLM to turn that into a short owner-facing summary.
- Logs the digest generation itself to `audit_log`.

### 4.9 Custom Skill — `summarize_activity`

- Reusable capability used by `DailyDigestAgent`: the "turn structured activity data into a short digest" prompt contract, grounded strictly in the counts/flags handed to it.

### 4.10 Custom Agent 4 — `FaceAttendanceAgent`

- **Photo-based attendance check-in**, an alternative to filling a paper attendance register: a worker's photo is compared against every enrolled worker's reference photo **in one multi-image LLM call** (`callLLMMultiVision` — see 4.3), and a match above a confidence threshold writes an attendance record.
- **Not an approval bypass**: a match writes to `records_pending` with `registerType: "attendance"`, going through the identical human-approval screen as every other register type — the existing dynamic Approval-card renders it with no special-casing.
- **Reliability**: uses a general-purpose vision LLM for photo comparison, not a dedicated face-recognition embeddings model — meaningfully less rigorous, acceptable for a small enrolled team, not a production biometric-accuracy claim.
- **Privacy**: worker photos are biometric data, requiring real consent/data-handling consideration — flagged to the user before building, not treated as a routine feature add.
- Every match attempt (successful or not) is logged to `audit_log`.

### 4.11 Custom Skill — `match_worker_face`

- Reusable capability used by `FaceAttendanceAgent`: owns the multi-image prompt structure (N labeled reference photos, then the new photo) and the output schema (`matchedWorkerId`, `matchedWorkerName`, `confidence`, `reasoning`) — the `reasoning` field lets a human check a surprising or low-confidence match.

### 4.12 Deterministic service (not an agent or skill) — `calculatePayroll`

- `server/services/payroll.ts`: sums approved `attendance` records per worker and multiplies by a given wage rate. Deliberately plain code, not an LLM call — arithmetic should be exact, not probabilistic. Kept out of `server/skills/` to keep the AI/non-AI distinction real in the code structure, not just asserted in docs.

### 4.13 Compliance document library

- `POST/GET /api/compliance-docs`: text-based (title + content + optional expiry date) — not PDF upload/parsing, which would be a real scope expansion not worth the remaining build time. Documents become citable context for `QueryAgent` immediately on upload.

### 4.14 Database

- **Tech:** Firebase Firestore (project: `gdgdeployordie`, already provisioned for this hackathon under a dedicated Android package — separate from any other project). Free Spark plan — no billing required.
- **Collections:**
  - `records_pending` — raw extracted data awaiting human approval, tagged with `registerType` and `companyId`
  - `records` — approved, final records (generic `fields` object per record, shaped by that record's register type)
  - `compliance_docs` — uploaded compliance documents (title, content, optional expiry date)
  - `workers` — enrolled workers for face-recognition attendance (name + reference photo, stored as base64 since Storage isn't enabled)
  - `audit_log` — every AI decision and human action (extraction, approval, rejection, query, digest, face-match attempt), with a timestamp, the input reference, and reasoning/confidence
- **Multi-tenancy:** every record carries a `companyId` (currently a single hardcoded constant — see `DECISIONS.md`). The data model is genuinely multi-tenant-ready; auth and a company picker were explicitly scoped out as too large for the remaining build time.

### 4.15 Storage

- **Deliberately not used.** Cloud Storage for Firebase now requires the Blaze (pay-as-you-go) billing plan to provision at all — not just for meaningful usage — which was rejected for this hackathon submission (no card, no billing risk). The upload step is non-blocking by design (`uploadRegisterImage` catches and logs, returns `null`), so extraction/approval/query are fully functional without it; records simply have `imageUrl: null` and the Approval screen shows a placeholder icon instead of the original photo. See `DECISIONS.md` — this is a permanent scope decision, not an outstanding gap.

### 4.16 Deterministic service (not an agent or skill) — digital receipt emails

- `server/services/email.ts`: on every approval, formats the approved fields into an HTML receipt and sends it via SendGrid to a fixed recipient. Plain code, not an LLM call — same reasoning as `calculatePayroll`. Non-blocking: a failed send is logged but never fails the approval itself, since the approval is already durably recorded in Firestore first. Requires `SENDGRID_API_KEY`, `RECEIPT_SENDER_EMAIL` (must be verified as a sender identity in SendGrid), and `RECEIPT_RECIPIENT_EMAIL` — if any are unset, or sending fails for any reason, approvals still succeed exactly as if this feature didn't exist.

## 5. Data Flow Summary

1. Document photographed/uploaded via the Flutter Web app, tagged with a register type
2. `RegisterExtractionAgent` extracts structured fields (schema driven by that type) → `records_pending`, logged to `audit_log`
3. Human reviews in the Approval screen (fields rendered dynamically per type), edits if needed
4. On approve: record moves to `records`, logged to `audit_log`
5. On reject: logged to `audit_log`, discarded from pending
6. `QueryAgent` answers questions against `records` + `compliance_docs`, citing sources, logged to `audit_log`
7. `DailyDigestAgent` summarizes recent activity on demand, logged to `audit_log`
8. `calculatePayroll` computes wages from approved `attendance` records (no LLM involved)

## 6. Traceability & Auditability

- Every extraction attempt, confidence score, and human decision is logged to `audit_log` with a timestamp
- Every query answer cites the specific record(s) and/or compliance document(s) it drew from — no hallucinated answers
- Every digest is grounded strictly in the counts/flags gathered from Firestore, never invented

## 7. Testing Strategy

Playwright end-to-end tests against the Flutter Web build (`tests/api-flow.spec.ts`, `tests/app-loads.spec.ts`), covering: extract → approve → query returns a cited answer, and reject removes a record from the pending queue. Same discipline throughout this build: verify each backend piece with a direct `curl`/smoke test before wiring UI on top of it, and re-verify after any refactor (e.g. the LLM provider abstraction was tested against the real Groq fallback, not mocked).

## 8. CI/CD

GitHub Actions: a single job covering backend lint/build, `flutter analyze`/`flutter test`/`flutter build web --debug`, and the full Playwright suite (with both `GEMINI_API_KEY` and `GROQ_API_KEY` configured, so quota exhaustion during CI runs doesn't block the pipeline). Must be green before considering a part done.

## 9. Deferred (documented, not built — scope cut for a solo build)

- Full inventory aggregation dashboard — the Query screen's answer-with-citations already surfaces approved records; a dedicated dashboard is polish, not core.
- PDF upload/parsing for compliance documents — text-in achieves the same "ask questions with citations" goal without the extraction/OCR complexity.
- Multi-tenant auth / company picker — the data model supports it (`companyId` on every record); building real tenant isolation was out of scope for the remaining time.
- Additional workflow types (customer support triage, employee onboarding) using the same approval-agent pattern.
