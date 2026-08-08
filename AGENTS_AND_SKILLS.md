# Custom Agents & Skills

## Shared: LLM provider abstraction (`server/llm.ts`)

All four agents below call `callLLMText`/`callLLMVision`/`callLLMMultiVision` rather than hitting an LLM API directly. All try Gemini first (the primary, proven provider) and fall back to Groq (`qwen/qwen3.6-27b` for vision, `openai/gpt-oss-20b` for text) **specifically on a 429 quota error** — a malformed request or bad prompt still fails loudly rather than silently retrying against a different provider and masking the bug. This removed duplicated fetch boilerplate that used to live separately in each agent, and implements the multi-provider resilience the hackathon brief itself recommends. Verified for real: Gemini's free-tier quota was genuinely exhausted during development, so every agent below has been live-tested running entirely on the Groq fallback path, not just the primary one.

## Agent 1: `RegisterExtractionAgent`

**File**: [`server/agents/registerExtractionAgent.ts`](server/agents/registerExtractionAgent.ts)

**Purpose**: Orchestrates a paper-register-upload request end-to-end, for any configured register type (intake, production, dispatch, attendance, expense — see `server/registerTypes.ts`). Generalizes what started as a single-purpose `SlipExtractionAgent` (raw-material intake only) once the product scope broadened to "any paper-heavy business," not just one factory's intake slips.

**Responsibilities**:
1. Validate an image and a `registerType` id were actually provided; reject unknown types before spending a Gemini call.
2. Invoke the `extract_register_data` skill to build a prompt specific to that register type's field schema.
3. Call Gemini's multimodal endpoint (`gemini-flash-latest`) with the image inline — one call does OCR and structured extraction together, no separate OCR step.
4. Parse and validate the response against the skill's expected schema.
5. Upload the original image to Firebase Storage (non-blocking — if Storage isn't reachable, the record is still written with `imageUrl: null` rather than failing the whole request; see `DECISIONS.md`).
6. Write the result to `records_pending`, tagged with `registerType` and `companyId` — **never** to the approved `records` collection.
7. Log the extraction attempt (register type, confidence, notes, timestamp) to `audit_log`.

Verified end-to-end before any UI was built: extraction against a real intake-slip test image, confirmed writes to `records_pending` and `audit_log` directly against Firestore, then re-verified after generalizing to the config-driven schema (extract → pending → approve, all against the real backend).

## Skill 1: `extract_register_data`

**File**: [`server/skills/extract_register_data.ts`](server/skills/extract_register_data.ts)

**Purpose**: The reusable extraction capability — owns the prompt and output schema, built **dynamically from a `RegisterTypeConfig`** rather than hardcoded field names. This is what makes adding a new paper form (say, a quality-inspection register) a config entry in `registerTypes.ts`, not new prompt-engineering or parsing code. Still enforces "null rather than guess" for illegible handwriting and a confidence score, same discipline as the original single-purpose version.

## How they compose

```
runRegisterExtraction(imageBase64, mimeType, registerType)  // agent
  → getRegisterType(registerType)                           // config lookup
  → buildExtractionPrompt(config)                            // skill: type-specific prompt
  → fetch(Gemini multimodal API)                              // agent: calls the LLM with the image
  → parseExtractionResponse(raw, config)                     // skill: validates + parses per-type
  → uploadRegisterImage(...)                                 // agent: Storage (non-blocking)
  → write records_pending + audit_log                        // agent: Firestore
  → RegisterRecord                                            // agent: returns typed result
```

## Agent 2: `QueryAgent`

**File**: [`server/agents/queryAgent.ts`](server/agents/queryAgent.ts)

**Purpose**: Orchestrates a natural-language question over approved records end-to-end — across *any* register type, not just one kind of record.

**Responsibilities**:
1. Validate a question was actually provided.
2. Fetch approved records from the `records` collection (most recent 200 — sufficient for demo scale; a real production version would filter/paginate).
3. Invoke the `answer_from_records` skill to build a prompt that includes those records — each with its `registerType` and `fields` — as the *only* permitted context.
4. Call Gemini with that prompt (text-only, no image).
5. Parse and validate the response against the skill's expected schema.
6. Log the question, answer, and cited record IDs to `audit_log`.
7. Return the answer with citations — **never** answers from the model's outside knowledge.

**Verified with real test cases** before any UI was built:
- A question answerable from one specific approved record — correctly answered using only that record and cited its exact ID, ignoring an unrelated approved record present in the same query.
- A question the records *cannot* answer (asking for data no field captures) — correctly refused to guess, returned an explicit "records don't contain this" answer with an empty citation list, rather than fabricating a number.

## Skill 2: `answer_from_records`

**File**: [`server/skills/answer_from_records.ts`](server/skills/answer_from_records.ts)

**Purpose**: The reusable "answer only from provided context, always cite" prompt contract — the mechanism that makes the no-hallucination guarantee enforceable rather than just a hope. Owns the prompt and the expected output schema (`answer`, `citedRecordIds`, `citedDocIds`). Framed generically ("a business's digitized paper records") so it reads correctly whether the cited records are intake slips, attendance, or expenses. Extended (Part E) to accept a second context source — uploaded compliance documents — so the same no-hallucination guarantee covers "are we compliant with X" questions, not just operational record lookups; the model must separately cite which record IDs and which document IDs it actually used.

## How they compose

```
runQuery(question)                            // agent
  → fetch records from Firestore                // agent: the only permitted context
  → buildQueryPrompt(question, records)        // skill: builds the prompt
  → fetch(Gemini API)                           // agent: calls the LLM
  → parseQueryResponse(raw)                    // skill: validates + parses the response
  → write audit_log                            // agent: logs the query itself
  → QueryAnswer                                // agent: returns typed result
```

## Agent 3: `DailyDigestAgent`

**File**: [`server/agents/dailyDigestAgent.ts`](server/agents/dailyDigestAgent.ts)

**Purpose**: The owner-facing pillar — proactively summarizes recent activity into a short written report, rather than reacting to a specific upload or question the way the other two agents do.

**Responsibilities**:
1. Gather recent activity: approved-record counts by register type (last 7 days — wide enough for a small demo dataset to have something to report), low-confidence pending items needing review, and audit-log activity tallies (extractions/approvals/rejections/queries).
2. Invoke the `summarize_activity` skill to build a prompt that includes that gathered data as the *only* permitted context.
3. Call Gemini (text-only) to turn the raw counts into a short, specific, plain-language summary + highlights.
4. Log the digest generation itself to `audit_log`.
5. Return the summary, highlights, and the raw input data together (so the UI/API consumer can show both the written digest and the numbers it was grounded in).

**Verified** against real Firestore data accumulated over this build's own testing: the returned summary correctly reported the actual counts (matching a direct Firestore query), and correctly reported zero low-confidence items when none existed rather than inventing any.

## Skill 3: `summarize_activity`

**File**: [`server/skills/summarize_activity.ts`](server/skills/summarize_activity.ts)

**Purpose**: The reusable "turn structured activity data into a short owner-facing digest" prompt contract. Distinct from `answer_from_records` (answers one specific question) — this skill's job is unprompted summarization of what happened, grounded strictly in the counts/flags handed to it.

## How they compose

```
runDailyDigest()                                    // agent
  → gatherDigestInput()                              // agent: Firestore reads (records, records_pending, audit_log)
  → buildDigestPrompt(input)                         // skill: builds the prompt
  → fetch(Gemini API)                                 // agent: calls the LLM
  → parseDigestResponse(raw)                         // skill: validates + parses the response
  → write audit_log                                  // agent: logs the digest generation itself
  → DigestResult + input                             // agent: returns typed result
```

## Agent 4: `FaceAttendanceAgent`

**File**: [`server/agents/faceAttendanceAgent.ts`](server/agents/faceAttendanceAgent.ts)

**Purpose**: Photo-based attendance check-in — a worker faces the camera instead of a paper sheet being filled and photographed. Fetches every enrolled worker's reference photo, compares a freshly captured photo against all of them **in a single multi-image LLM call**, and — if matched with reasonable confidence (≥0.5) — writes an attendance record.

**Responsibilities**:
1. Fetch all enrolled workers (`workers` collection — reference photo stored as base64 directly in Firestore, since Firebase Storage isn't enabled; see `DECISIONS.md`).
2. Invoke `match_worker_face` to build a prompt describing each reference photo, then call `callLLMMultiVision` with all reference images plus the new photo in one request (not one comparison call per worker — cheaper and keeps the model reasoning about all candidates together).
3. Log the match attempt (worker id, confidence) to `audit_log` regardless of outcome.
4. **If matched** (confidence ≥ 0.5): write a `records_pending` entry with `registerType: "attendance"` — going through the exact same human-approval gate as every other register type. A face match is a strong signal, not a bypass of the human-in-the-loop principle the rest of this app is built around.
5. **If not matched or low confidence**: no record is created — returns the match result (with `recordId: null`) so the caller can show "not recognized."

**Reliability note, stated plainly**: this uses a general-purpose vision LLM to compare photos, not a purpose-built face-recognition model (e.g. embeddings + similarity search). It's noticeably less rigorous than dedicated biometric systems. Acceptable for a small enrolled team in a demo context; not a claim of production-grade accuracy.

**Privacy note**: worker photos are biometric data. This feature was built deliberately (not as a casual add-on) after flagging that tradeoff to the user — see `DECISIONS.md`.

**Verified** with synthetic test images (two visually distinct generated "faces," not real photos — avoids needing real biometric data just to test the code path): correctly matched a photo against its own enrolled reference while correctly distinguishing it from a second enrolled worker (confidence 1.0, correct reasoning citing specific visual differences), and correctly refused to match a third, unenrolled "stranger" image (confidence 0, `recordId: null`) rather than guessing.

## Skill 4: `match_worker_face`

**File**: [`server/skills/match_worker_face.ts`](server/skills/match_worker_face.ts)

**Purpose**: The reusable "compare a new photo against N reference photos and identify the best match, or none" prompt contract. Owns the multi-image prompt structure (reference photos labeled in order, new photo last) and the output schema (`matchedWorkerId`, `matchedWorkerName`, `confidence`, `reasoning`) — the `reasoning` field isn't just decoration, it's what a human reviewing a low-confidence or surprising match can actually check.

## How they compose

```
runFaceAttendance(imageBase64, mimeType)            // agent
  → fetch enrolled workers from Firestore             // agent
  → buildMatchPrompt(workers)                        // skill: builds the prompt
  → callLLMMultiVision(prompt, [refPhotos..., newPhoto])  // agent: calls the LLM with all images
  → parseMatchResponse(raw)                          // skill: validates + parses the response
  → write audit_log (always)                         // agent
  → write records_pending (only if matched)           // agent: same approval gate as every register type
  → FaceAttendanceResult                              // agent: returns typed result
```

## Deterministic service (not an agent or skill): `calculatePayroll`

**File**: [`server/services/payroll.ts`](server/services/payroll.ts)

**Deliberately not LLM-backed.** Attendance records are already structured, human-approved data by the time payroll runs over them (`GET /api/payroll?wageRate=...` sums `hoursWorked` per worker from approved `attendance`-type records and multiplies by the given rate). Summing numbers and multiplying by a rate is exact arithmetic — asking a language model to do it would trade a guaranteed-correct calculation for a probabilistic one, for no benefit. Kept in `server/services/`, not `server/skills/`, to keep that distinction honest in the codebase's structure, not just in this document: the hackathon's "custom agent + custom skill" requirement is about AI orchestration, and this isn't that — it's the kind of business logic an agent's output feeds into, correctly built as plain code.

Verified against seeded attendance data (bypassing extraction to avoid spending Gemini quota on a deterministic-math test): two workers, mixed present/half-day/absent days, confirmed correct per-worker hour totals, days-present counts (absent days with 0 hours correctly excluded), and wage calculations.
