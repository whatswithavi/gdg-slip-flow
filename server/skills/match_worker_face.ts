/**
 * Custom skill: match_worker_face
 *
 * Reusable capability used by FaceAttendanceAgent: owns the prompt contract
 * for comparing a freshly captured photo against a set of enrolled worker
 * reference photos and identifying the best match (or no match). This is an
 * LLM doing visual comparison, not a purpose-built face-recognition model —
 * good enough for a small team, not a substitute for dedicated biometric
 * systems at scale. See DECISIONS.md for the reliability/privacy discussion.
 */

export interface EnrolledWorker {
  id: string;
  name: string;
}

export interface FaceMatchResult {
  matchedWorkerId: string | null;
  matchedWorkerName: string | null;
  confidence: number;
  reasoning: string;
}

const OUTPUT_SCHEMA_HINT = `Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "matchedWorkerId": string | null,
  "matchedWorkerName": string | null,
  "confidence": number,
  "reasoning": string
}
"confidence" is 0.0 (no plausible match) to 1.0 (certain match). If no enrolled worker's reference photo plausibly matches the new photo, set matchedWorkerId and matchedWorkerName to null and confidence to 0 — never guess a match you're not reasonably confident in.`;

/**
 * The reference images are provided to the model in the same order as
 * `workers`, immediately followed by the new photo to identify (the last
 * image). This function only builds the text prompt — the caller (the
 * agent) is responsible for assembling the actual image array in that order.
 */
export function buildMatchPrompt(workers: EnrolledWorker[]): string {
  const workerList = workers.map((w, i) => `Image ${i + 1}: reference photo of "${w.name}" (id: ${w.id})`).join("\n");

  return [
    "You are comparing a newly captured photo against a set of enrolled workers' reference photos to identify who is in the new photo, for attendance check-in purposes.",
    "",
    `You are given ${workers.length} reference photo(s), followed by exactly one new photo (the last image) to identify:`,
    workerList,
    `Image ${workers.length + 1}: the new photo to identify`,
    "",
    "Compare the new photo against each reference photo. If it clearly matches one specific enrolled worker, return that worker's id and name. If it's ambiguous, matches no one, or you're not confident, return null — do not guess.",
    "",
    OUTPUT_SCHEMA_HINT,
  ].join("\n");
}

export function parseMatchResponse(raw: string): FaceMatchResult {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.confidence !== "number" || typeof parsed.reasoning !== "string") {
    throw new Error("Model response did not match the expected FaceMatchResult shape");
  }

  return {
    matchedWorkerId: parsed.matchedWorkerId ?? null,
    matchedWorkerName: parsed.matchedWorkerName ?? null,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
  };
}
