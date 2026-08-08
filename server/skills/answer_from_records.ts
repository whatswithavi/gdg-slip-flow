/**
 * Custom skill: answer_from_records
 *
 * Reusable capability used by QueryAgent: owns the "answer only from the
 * provided records, always cite" prompt contract. Keeps the no-hallucination
 * guarantee in one place, same pattern as Track B's review_diff skill.
 *
 * Generalized to work across any register type (not just intake slips) —
 * records now carry a `registerType` and a generic `fields` object rather
 * than a hardcoded intake-slip shape.
 */

export interface QueryAnswer {
  answer: string;
  citedRecordIds: string[];
}

const OUTPUT_SCHEMA_HINT = `Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "answer": string,
  "citedRecordIds": string[]
}
"citedRecordIds" must list the "id" field of every record you actually used to answer. If the records don't contain enough information to answer, say so plainly in "answer" and leave "citedRecordIds" empty — never fabricate an answer from outside knowledge.`;

export function buildQueryPrompt(question: string, records: Record<string, unknown>[]): string {
  return [
    "You are answering a question about a business's digitized paper records — these may be raw-material intake, production/batch logs, dispatch/sales, worker attendance, or expense records (see each record's \"registerType\").",
    "You MUST answer only using the records provided below — never use outside knowledge, and never guess at data not present here.",
    "If the records don't contain the answer, say so explicitly instead of guessing.",
    "",
    OUTPUT_SCHEMA_HINT,
    "",
    "Records (JSON array, each has an \"id\" and \"registerType\" field, and a \"fields\" object with the type-specific data):",
    JSON.stringify(records, null, 2),
    "",
    `Question: ${question}`,
  ].join("\n");
}

export function parseQueryResponse(raw: string): QueryAnswer {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.answer !== "string" || !Array.isArray(parsed.citedRecordIds)) {
    throw new Error("Model response did not match the expected { answer, citedRecordIds } shape");
  }

  return { answer: parsed.answer, citedRecordIds: parsed.citedRecordIds };
}
