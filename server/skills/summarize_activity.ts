/**
 * Custom skill: summarize_activity
 *
 * Reusable capability used by DailyDigestAgent: owns the prompt contract for
 * turning raw recent activity (approved records, pending items, audit log
 * entries) into a short, owner-facing written digest. Distinct from
 * answer_from_records: that skill answers a specific question from records;
 * this one proactively summarizes what happened, unprompted.
 */

export interface DigestInput {
  periodLabel: string;
  approvedCounts: Record<string, number>; // registerType -> count approved in period
  lowConfidencePending: { id: string; registerType: string; confidence: number; notes: string | null }[];
  recentActivityCounts: { extractions: number; approvals: number; rejections: number; queries: number };
}

export interface DigestResult {
  summary: string;
  highlights: string[];
}

const OUTPUT_SCHEMA_HINT = `Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "summary": string,
  "highlights": string[]
}
"summary" is a short (2-4 sentence) plain-language paragraph a busy business owner can read in ten seconds.
"highlights" is 2-5 short bullet-point strings covering the most actionable items (e.g. items needing review, notable volume changes) — not a restatement of every number.`;

export function buildDigestPrompt(input: DigestInput): string {
  return [
    `You are writing a short daily activity digest for the owner of a business, covering ${input.periodLabel}.`,
    "Base the digest ONLY on the data below — do not invent figures or events not present here.",
    "Be direct and specific (use actual counts/names from the data), not generic filler.",
    "",
    OUTPUT_SCHEMA_HINT,
    "",
    "Data:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

export function parseDigestResponse(raw: string): DigestResult {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.highlights)) {
    throw new Error("Model response did not match the expected { summary, highlights } shape");
  }

  return { summary: parsed.summary, highlights: parsed.highlights };
}
