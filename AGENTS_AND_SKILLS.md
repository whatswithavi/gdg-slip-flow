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

## Agent 2 & Skill 2: `QueryAgent` / `answer_from_records`

Not yet built — documented in `ARCHITECTURE.md` §4.6–4.7. Will follow the same pattern once implemented: this file will be updated with its actual composition at that point, not before.
