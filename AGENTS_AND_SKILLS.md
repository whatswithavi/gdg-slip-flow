# Custom Agents & Skills

## Agent 1: `SlipExtractionAgent`

**File**: [`server/agents/slipExtractionAgent.ts`](server/agents/slipExtractionAgent.ts)

**Purpose**: Orchestrates a slip-upload request end-to-end.

**Responsibilities**:
1. Validate an image was actually provided.
2. Invoke the `parse_slip_data` skill to build the extraction prompt.
3. Call Gemini's multimodal endpoint (`gemini-flash-latest`) with the image inline — one call does OCR and structured extraction together, no separate OCR step.
4. Parse and validate the response against the skill's expected schema.
5. Upload the original image to Firebase Storage (non-blocking — if Storage isn't reachable, the record is still written with `imageUrl: null` rather than failing the whole request; see `DECISIONS.md`).
6. Write the result to `slips_pending` — **never** to the approved `slips` collection.
7. Log the extraction attempt (confidence, notes, timestamp) to `audit_log`.

Verified end-to-end with a real synthetic test slip image before any UI was built: the agent correctly extracted item/quantity/unit/date/supplier from a generated image, and both the `slips_pending` and `audit_log` writes were confirmed directly against Firestore.

## Skill 1: `parse_slip_data`

**File**: [`server/skills/parse_slip_data.ts`](server/skills/parse_slip_data.ts)

**Purpose**: The reusable extraction capability — owns the prompt (what fields to extract, how to score confidence, "null rather than guess" instruction for illegible handwriting) and the expected output schema (`item`, `quantity`, `unit`, `date`, `supplier`, `confidence`, `notes`).

## How they compose

```
runSlipExtraction(imageBase64, mimeType)      // agent
  → buildExtractionPrompt()                   // skill: builds the prompt
  → fetch(Gemini multimodal API)               // agent: calls the LLM with the image
  → parseExtractionResponse(raw)              // skill: validates + parses the response
  → uploadSlipImage(...)                      // agent: Storage (non-blocking)
  → write slips_pending + audit_log           // agent: Firestore
  → SlipRecord                                // agent: returns typed result
```

## Agent 2: `QueryAgent`

**File**: [`server/agents/queryAgent.ts`](server/agents/queryAgent.ts)

**Purpose**: Orchestrates a natural-language question over approved records end-to-end.

**Responsibilities**:
1. Validate a question was actually provided.
2. Fetch approved records from the `slips` collection (most recent 200 — sufficient for demo scale; a real production version would filter/paginate).
3. Invoke the `answer_from_records` skill to build a prompt that includes those records as the *only* permitted context.
4. Call Gemini with that prompt (text-only, no image).
5. Parse and validate the response against the skill's expected schema.
6. Log the question, answer, and cited slip IDs to `audit_log`.
7. Return the answer with citations — **never** answers from the model's outside knowledge.

**Verified with two real test cases** before any UI was built:
- A question answerable from one specific approved record ("How many units of copper wire did we receive, and who was the supplier?") — correctly answered using only that record and cited its exact slip ID, ignoring an unrelated approved record present in the same query.
- A question the records *cannot* answer ("What is the price per unit of the steel rods?" — no price field exists in the schema) — correctly refused to guess, returned an explicit "records don't contain this" answer with an empty citation list, rather than fabricating a number.

## Skill 2: `answer_from_records`

**File**: [`server/skills/answer_from_records.ts`](server/skills/answer_from_records.ts)

**Purpose**: The reusable "answer only from provided context, always cite" prompt contract — the mechanism that makes the no-hallucination guarantee enforceable rather than just a hope. Owns the prompt and the expected output schema (`answer`, `citedSlipIds`).

## How they compose

```
runQuery(question)                            // agent
  → fetch slips from Firestore                 // agent: the only permitted context
  → buildQueryPrompt(question, records)        // skill: builds the prompt
  → fetch(Gemini API)                           // agent: calls the LLM
  → parseQueryResponse(raw)                    // skill: validates + parses the response
  → write audit_log                            // agent: logs the query itself
  → QueryAnswer                                // agent: returns typed result
```
