/**
 * Custom skill: answer_from_records
 *
 * Reusable capability used by QueryAgent: owns the "answer only from the
 * provided records, always cite" prompt contract. Keeps the no-hallucination
 * guarantee in one place, same pattern as Track B's review_diff skill.
 *
 * Generalized to work across any register type (not just intake slips) —
 * records now carry a `registerType` and a generic `fields` object rather
 * than a hardcoded intake-slip shape. Further extended (Part E) to also
 * accept compliance documents as citable context, so the same no-hallucination
 * guarantee covers "are we compliant with X" questions, not just operational
 * record lookups.
 */

export interface QueryAnswer {
  answer: string;
  citedRecordIds: string[];
  citedDocIds: string[];
}

const OUTPUT_SCHEMA_HINT = `Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "answer": string,
  "citedRecordIds": string[],
  "citedDocIds": string[]
}
"citedRecordIds" must list the "id" field of every operational record you actually used to answer. "citedDocIds" must list the "id" field of every compliance document you actually used. If nothing provided contains enough information to answer, say so plainly in "answer" and leave both citation lists empty — never fabricate an answer from outside knowledge.`;

export function buildQueryPrompt(
  question: string,
  records: Record<string, unknown>[],
  complianceDocs: Record<string, unknown>[]
): string {
  return [
    "You are answering a question for a business, using two kinds of source data provided below:",
    "1. Digitized paper records — raw-material intake, production/batch logs, dispatch/sales, worker attendance, or expense records (see each record's \"registerType\").",
    "2. Compliance documents — licenses, safety norms, SOPs the business has uploaded.",
    "You MUST answer only using the data provided below — never use outside knowledge, and never guess at data not present here.",
    "If neither source contains the answer, say so explicitly instead of guessing.",
    "",
    OUTPUT_SCHEMA_HINT,
    "",
    "Records (JSON array, each has an \"id\" and \"registerType\" field, and a \"fields\" object with the type-specific data):",
    JSON.stringify(records, null, 2),
    "",
    "Compliance documents (JSON array, each has an \"id\", \"title\", \"content\", and optional \"expiryDate\"):",
    JSON.stringify(complianceDocs, null, 2),
    "",
    `Question: ${question}`,
  ].join("\n");
}

export function parseQueryResponse(raw: string): QueryAnswer {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.answer !== "string" || !Array.isArray(parsed.citedRecordIds) || !Array.isArray(parsed.citedDocIds)) {
    throw new Error("Model response did not match the expected { answer, citedRecordIds, citedDocIds } shape");
  }

  return { answer: parsed.answer, citedRecordIds: parsed.citedRecordIds, citedDocIds: parsed.citedDocIds };
}
