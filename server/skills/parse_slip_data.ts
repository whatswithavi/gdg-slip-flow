/**
 * Custom skill: parse_slip_data
 *
 * Reusable capability: given a photo of a handwritten raw-material intake
 * slip, produce structured data. Owns the prompt contract and the expected
 * output schema, same pattern as Track B's review_diff skill.
 */

export interface SlipExtractionResult {
  item: string | null;
  quantity: number | null;
  unit: string | null;
  date: string | null;
  supplier: string | null;
  confidence: number;
  notes: string | null;
}

const OUTPUT_SCHEMA_HINT = `Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "item": string | null,
  "quantity": number | null,
  "unit": string | null,
  "date": string | null,
  "supplier": string | null,
  "confidence": number,
  "notes": string | null
}
"confidence" is your confidence in the overall extraction, from 0.0 (illegible/unsure) to 1.0 (fully legible and unambiguous).
If a field is illegible or absent from the slip, set it to null rather than guessing.
Use "notes" to flag anything a human reviewer should double-check (e.g. "quantity unit is ambiguous, could be kg or lbs").`;

export function buildExtractionPrompt(): string {
  return [
    "You are extracting structured data from a photo of a handwritten raw-material intake slip.",
    "Read the handwriting carefully and extract: the item/material name, quantity, unit of measure, date, and supplier name.",
    "Do not guess at illegible text — set the field to null and explain in notes instead.",
    "",
    OUTPUT_SCHEMA_HINT,
  ].join("\n");
}

export function parseExtractionResponse(raw: string): SlipExtractionResult {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.confidence !== "number") {
    throw new Error("Model response missing a numeric confidence score");
  }

  return {
    item: parsed.item ?? null,
    quantity: parsed.quantity ?? null,
    unit: parsed.unit ?? null,
    date: parsed.date ?? null,
    supplier: parsed.supplier ?? null,
    confidence: parsed.confidence,
    notes: parsed.notes ?? null,
  };
}
