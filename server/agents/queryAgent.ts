/**
 * Custom agent: QueryAgent
 *
 * Orchestrates a natural-language query end-to-end: fetches the approved
 * records and compliance docs from Firestore, invokes the
 * answer_from_records skill to build the prompt, calls the LLM (see
 * ../llm.ts for the Gemini-first-then-Groq-fallback provider logic),
 * validates the response, logs the query to audit_log, and returns the
 * answer with source citations. Never answers from the model's outside
 * knowledge — only from the fetched data.
 */

import { db } from "../firebase";
import { callLLMText, LLMError } from "../llm";
import { buildQueryPrompt, parseQueryResponse, QueryAnswer } from "../skills/answer_from_records";

export class QueryAgentError extends Error {}

export async function runQuery(question: string): Promise<QueryAnswer> {
  if (!question || !question.trim()) {
    throw new QueryAgentError("No question provided");
  }

  const [recordsSnap, docsSnap] = await Promise.all([
    db.collection("records").orderBy("createdAt", "desc").limit(200).get(),
    db.collection("compliance_docs").orderBy("createdAt", "desc").limit(50).get(),
  ]);
  const records = recordsSnap.docs.map((d) => d.data());
  const complianceDocs = docsSnap.docs.map((d) => d.data());

  const prompt = buildQueryPrompt(question, records, complianceDocs);

  let text: string;
  try {
    text = await callLLMText(prompt);
  } catch (err) {
    if (err instanceof LLMError) throw new QueryAgentError(err.message);
    throw err;
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
    citedDocIds: result.citedDocIds,
    timestamp: Date.now(),
  });

  return result;
}
