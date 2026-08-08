/**
 * Custom agent: DailyDigestAgent
 *
 * Orchestrates an owner-facing activity digest end-to-end: gathers recent
 * approved-record counts (by register type), flags low-confidence pending
 * items that need human attention, tallies recent audit_log activity, hands
 * that to the summarize_activity skill, calls Gemini, and returns a short
 * written report. Unlike RegisterExtractionAgent/QueryAgent (reactive — they
 * respond to a specific upload or question), this agent is proactive: it
 * summarizes what happened without being asked about anything specific.
 */

import { db } from "../firebase";
import { buildDigestPrompt, parseDigestResponse, DigestInput, DigestResult } from "../skills/summarize_activity";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class DailyDigestAgentError extends Error {}

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const LOOKBACK_MS = 1000 * 60 * 60 * 24 * 7; // 7 days — a small demo dataset needs a wider window than "today" to have anything to summarize

async function gatherDigestInput(): Promise<DigestInput> {
  const since = Date.now() - LOOKBACK_MS;

  const [approvedSnap, pendingSnap, auditSnap] = await Promise.all([
    db.collection("records").where("approvedAt", ">=", since).get(),
    db.collection("records_pending").get(),
    db.collection("audit_log").where("timestamp", ">=", since).get(),
  ]);

  const approvedCounts: Record<string, number> = {};
  for (const doc of approvedSnap.docs) {
    const type = (doc.data().registerType as string) ?? "unknown";
    approvedCounts[type] = (approvedCounts[type] ?? 0) + 1;
  }

  const lowConfidencePending = pendingSnap.docs
    .map((d) => d.data())
    .filter((r) => (r.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD)
    .map((r) => ({ id: r.id, registerType: r.registerType, confidence: r.confidence, notes: r.notes ?? null }));

  const recentActivityCounts = { extractions: 0, approvals: 0, rejections: 0, queries: 0 };
  for (const doc of auditSnap.docs) {
    const type = doc.data().type as string;
    if (type === "extraction") recentActivityCounts.extractions += 1;
    else if (type === "approved") recentActivityCounts.approvals += 1;
    else if (type === "rejected") recentActivityCounts.rejections += 1;
    else if (type === "query") recentActivityCounts.queries += 1;
  }

  return {
    periodLabel: "the last 7 days",
    approvedCounts,
    lowConfidencePending,
    recentActivityCounts,
  };
}

export async function runDailyDigest(): Promise<DigestResult & { input: DigestInput }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new DailyDigestAgentError("GEMINI_API_KEY is not set");
  }

  const input = await gatherDigestInput();
  const prompt = buildDigestPrompt(input);

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new DailyDigestAgentError(`LLM request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new DailyDigestAgentError("LLM returned no content");
  }

  let result: DigestResult;
  try {
    result = parseDigestResponse(text);
  } catch (err) {
    throw new DailyDigestAgentError(`Failed to parse LLM response as structured digest: ${(err as Error).message}`);
  }

  await db.collection("audit_log").add({
    type: "digest",
    summary: result.summary,
    timestamp: Date.now(),
  });

  return { ...result, input };
}
