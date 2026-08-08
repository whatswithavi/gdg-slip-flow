/**
 * Custom agent: QueryAgent
 *
 * Orchestrates a natural-language query end-to-end: fetches the approved
 * records from Firestore, invokes the answer_from_records skill to build
 * the prompt, calls Gemini, validates the response, logs the query to
 * audit_log, and returns the answer with source citations. Never answers
 * from the model's outside knowledge — only from the fetched records.
 */

import { db } from "../firebase";
import { buildQueryPrompt, parseQueryResponse, QueryAnswer } from "../skills/answer_from_records";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class QueryAgentError extends Error {}

export async function runQuery(question: string): Promise<QueryAnswer> {
  if (!question || !question.trim()) {
    throw new QueryAgentError("No question provided");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new QueryAgentError("GEMINI_API_KEY is not set");
  }

  const snap = await db.collection("records").orderBy("createdAt", "desc").limit(200).get();
  const records = snap.docs.map((d) => d.data());

  const prompt = buildQueryPrompt(question, records);

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new QueryAgentError(`LLM request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new QueryAgentError("LLM returned no content");
  }

  let result: QueryAnswer;
  try {
    result = parseQueryResponse(text);
  } catch (err) {
    throw new QueryAgentError(`Failed to parse LLM response as structured answer: ${(err as Error).message}`);
  }

  await db.collection("audit_log").add({
    type: "query",
    question,
    answer: result.answer,
    citedRecordIds: result.citedRecordIds,
    timestamp: Date.now(),
  });

  return result;
}
