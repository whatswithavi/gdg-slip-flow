/**
 * Custom skill: extract_register_data
 *
 * Reusable capability: given a photo of a handwritten paper register (of any
 * configured type — intake, production, dispatch, attendance, expense, ...)
 * produce structured data matching that type's field schema. Generalizes the
 * original single-purpose parse_slip_data skill so a new paper form is a new
 * RegisterTypeConfig entry, not new prompt/parsing code.
 */

import { RegisterTypeConfig } from "../registerTypes";

export interface RegisterExtractionResult {
  fields: Record<string, string | number | null>;
  confidence: number;
  notes: string | null;
}

function buildSchemaHint(config: RegisterTypeConfig): string {
  const fieldLines = config.fields
    .map((f) => `    "${f.key}": ${f.type === "number" ? "number | null" : "string | null"}  // ${f.label}`)
    .join("\n");

  return `Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "fields": {
${fieldLines}
  },
  "confidence": number,
  "notes": string | null
}
"confidence" is your confidence in the overall extraction, from 0.0 (illegible/unsure) to 1.0 (fully legible and unambiguous).
If a field is illegible or absent from the document, set it to null rather than guessing.
Use "notes" to flag anything a human reviewer should double-check.`;
}

export function buildExtractionPrompt(config: RegisterTypeConfig): string {
  return [
    `You are extracting structured data from a photo of ${config.description}.`,
    `Read the handwriting carefully and extract exactly these fields: ${config.fields.map((f) => f.label).join(", ")}.`,
    "Do not guess at illegible text — set the field to null and explain in notes instead.",
    "",
    buildSchemaHint(config),
  ].join("\n");
}

export function parseExtractionResponse(raw: string, config: RegisterTypeConfig): RegisterExtractionResult {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.confidence !== "number") {
    throw new Error("Model response missing a numeric confidence score");
  }
  if (!parsed.fields || typeof parsed.fields !== "object") {
    throw new Error("Model response missing a 'fields' object");
  }

  const fields: Record<string, string | number | null> = {};
  for (const f of config.fields) {
    fields[f.key] = parsed.fields[f.key] ?? null;
  }

  return {
    fields,
    confidence: parsed.confidence,
    notes: parsed.notes ?? null,
  };
}
