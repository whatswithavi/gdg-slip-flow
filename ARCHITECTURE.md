# ARCHITECTURE.md

## 1. Overview

Slip Flow digitizes handwritten raw-material intake slips using an LLM's vision capability, routes extracted data through a human approval step, stores approved records in a structured database, and exposes a natural-language query agent over that data. Every AI decision — extraction attempt, confidence score, approve/reject — is logged to an audit trail.

**Track:** A — Business Process Automation

## 2. Problem Statement

Businesses that receive raw materials often log intake via handwritten paper slips. These slips are easy to lose, damage, or misread, and there is no searchable record of what arrived and when. This project converts that manual, fragile process into a traceable, auditable, human-approved digital workflow.

## 3. System Architecture

```
[Flutter Web app: Upload screen]
        |  image_picker -> Firebase Storage
        v
[POST /api/extract-slip] --(image)--> [SlipExtractionAgent]
                                              |  (review_diff-pattern skill:
                                              |   parse_slip_data)
                                              v
                                    Gemini multimodal (single call:
                                    OCR + structured extraction)
                                              |
                                              v
                                    [slips_pending, Firestore]
                                              |
                                              v
                          [Flutter Web app: Approval screen] <-- human edits/corrects
                                              |
                              approve  /              \  reject
                                      v                  v
                         [slips, Firestore]      [audit_log: rejected]
                              |
                              v
                    [audit_log: approved]
                              |
                              v
                [Flutter Web app: Query screen] <-- natural language Qs
                              |
                              v
                [POST /api/query] -> [QueryAgent]
                              |  (skill: answer_from_records)
                              v
                Gemini (context = fetched slips, instructed to
                answer only from provided records)
                              |
                              v
                   [Answer + cited slip IDs]
```

## 4. Components

### 4.1 Frontend

- **Tech:** Flutter, Web-first (compiles to a real page — Playwright-testable, matches the hackathon's recommended testing approach), also buildable to Android via the already-registered Firebase app (`com.aavii.gdg`).
  - **Build note:** CI/demo builds use `flutter build web --debug` — a `dart2js` release-mode bug in Firebase's JS interop crashes at runtime on this Flutter/Dart version (see `DECISIONS.md`); the debug (DDC) compiler doesn't hit it and produces a fully functional static build.
- **Design system:** ported from the existing `aavii_website` Flutter app (colors, dark-mode-aware theme, shared rounded/soft-shadow widgets) as fresh files, not a dependency on that repo.
- **Screens:**
  - Upload (camera/file capture via `image_picker`)
  - Approval dashboard (original image + editable extracted fields, Approve/Reject)
  - Query (ask questions in natural language, get cited answers)

### 4.2 Backend

- **Tech:** Node.js/TypeScript/Express — same proven `routes/` → `agents/` → `skills/` shape as the Track B build.
- **Responsibilities:** agent orchestration (extraction, query), Firestore/Storage access via `firebase-admin` (service-account credential, server-side only — never exposed to the client), audit logging.

### 4.3 OCR

- **Approach:** Gemini multimodal (`gemini-flash-latest`) — one call takes the slip image and returns structured JSON directly (item, quantity, unit, date, supplier, confidence). No separate OCR-then-extract pipeline.
  - Deliberately simpler than the originally planned Google Cloud Vision + separate LLM extraction: avoids a second untested credential path, and reuses the exact Gemini key/model already proven working (including the free-tier model-quota gotcha already solved in Track B — see that project's `DECISIONS.md`).

### 4.4 Custom Agent 1 — SlipExtractionAgent

- Input: a slip image
- Output: structured fields (item, quantity, unit, date, supplier) + a confidence score
- Writes to `slips_pending`, never directly to `slips`
- Logs its extraction attempt and confidence to `audit_log`

### 4.5 Custom Skill — parse_slip_data

- Reusable capability used by `SlipExtractionAgent`: owns the prompt (what fields to extract, how to score confidence) and the expected structured-output schema, same pattern as Track B's `review_diff` skill.

### 4.6 Custom Agent 2 — QueryAgent

- Input: a natural-language question about slip/inventory history
- Fetches relevant records from Firestore, feeds them to Gemini as context, and instructs it to answer **only** from the provided records
- Returns the answer with the specific slip ID(s) it drew from — never fabricates data not present in the fetched records

### 4.7 Custom Skill — answer_from_records

- Reusable capability used by `QueryAgent`: owns the "answer only from provided context, always cite" prompt contract.

### 4.8 Database

- **Tech:** Firebase Firestore (project: `gdgdeployordie`, already provisioned for this hackathon under a dedicated Android package — separate from any other project).
- **Collections:**
  - `slips_pending` — raw extracted data awaiting human approval
  - `slips` — approved, final records
  - `audit_log` — every AI decision and human approve/reject action, with a timestamp, the input reference, and reasoning/confidence

### 4.9 Storage

- **Tech:** Firebase Storage (same project) — holds the original slip images, referenced by ID from the Firestore records.

## 5. Data Flow Summary

1. Slip photographed/uploaded via the Flutter Web app
2. `SlipExtractionAgent` (Gemini multimodal) extracts structured fields directly from the image → `slips_pending`, logged to `audit_log`
3. Human reviews in the Approval screen, edits if needed
4. On approve: record moves to `slips`, logged to `audit_log`
5. On reject: logged to `audit_log`, discarded from pending
6. `QueryAgent` answers questions against `slips`, citing sources, logged to `audit_log`

## 6. Traceability & Auditability

- Every extraction attempt, confidence score, and human decision is logged to `audit_log` with a timestamp
- Every approved record retains a link to its original slip image (Firebase Storage)
- Every query answer cites the specific record(s) it drew from — no hallucinated answers

## 7. Testing Strategy

Playwright end-to-end tests against the Flutter Web build, covering: upload → extraction → approval UI renders correct fields → approve → Firestore updated → query returns a cited answer. Same discipline as Track B: verify each backend piece with a direct `curl`/smoke test before wiring UI on top of it.

## 8. CI/CD

GitHub Actions: a Node job (lint/build/test the backend, same shape as Track B) and a Flutter job (`flutter analyze`, `flutter test`, `flutter build web --debug`). Must be green before considering a part done.

## 9. Deferred (documented, not built — scope cut for a 12-hour solo build)

- Email backup of approved slips — not one of the 5 non-negotiables; would add a new credential (Resend/SendGrid) for no scoring benefit under time pressure.
- Full inventory aggregation dashboard — the Query screen's answer-with-citations already surfaces approved records; a dedicated dashboard is polish, not core.
- Additional workflow types (customer support triage, employee onboarding) using the same approval-agent pattern.
