/**
 * Custom agent: FaceAttendanceAgent
 *
 * Orchestrates a photo-based attendance check-in end-to-end: fetches
 * enrolled workers (reference photos, stored as base64 in Firestore since
 * Firebase Storage isn't enabled — see registerTypes.ts/DECISIONS.md),
 * compares a freshly captured photo against them via the match_worker_face
 * skill, and — if matched with reasonable confidence — writes an attendance
 * record to records_pending, same human-approval gate as every other
 * register type (a face match is a strong signal, not a substitute for the
 * human-in-the-loop principle the rest of this app is built around).
 *
 * A general-purpose LLM comparing photos is meaningfully less reliable than
 * a purpose-built face-recognition model — acceptable for a small enrolled
 * team, not a claim of production-grade biometric accuracy.
 */

import { randomUUID } from "crypto";
import { db } from "../firebase";
import { callLLMMultiVision, LLMImage, LLMError } from "../llm";
import { DEFAULT_COMPANY_ID } from "../registerTypes";
import { buildMatchPrompt, parseMatchResponse, EnrolledWorker, FaceMatchResult } from "../skills/match_worker_face";

export class FaceAttendanceAgentError extends Error {}

const MIN_MATCH_CONFIDENCE = 0.5;

interface WorkerDoc extends EnrolledWorker {
  photoBase64: string;
  mimeType: string;
}

export interface FaceAttendanceResult extends FaceMatchResult {
  recordId: string | null;
}

export async function runFaceAttendance(imageBase64: string, mimeType: string): Promise<FaceAttendanceResult> {
  if (!imageBase64) {
    throw new FaceAttendanceAgentError("No image provided");
  }

  const snap = await db.collection("workers").get();
  const workers = snap.docs.map((d) => d.data() as WorkerDoc);

  if (workers.length === 0) {
    throw new FaceAttendanceAgentError("No workers enrolled yet — enroll at least one worker before checking in");
  }

  const images: LLMImage[] = [
    ...workers.map((w) => ({ base64: w.photoBase64, mimeType: w.mimeType })),
    { base64: imageBase64, mimeType },
  ];

  const prompt = buildMatchPrompt(workers.map((w) => ({ id: w.id, name: w.name })));

  let text: string;
  try {
    text = await callLLMMultiVision(prompt, images);
  } catch (err) {
    if (err instanceof LLMError) throw new FaceAttendanceAgentError(err.message);
    throw err;
  }

  let match: FaceMatchResult;
  try {
    match = parseMatchResponse(text);
  } catch (err) {
    throw new FaceAttendanceAgentError(`Failed to parse LLM response as structured match: ${(err as Error).message}`);
  }

  await db.collection("audit_log").add({
    type: "face_attendance",
    matchedWorkerId: match.matchedWorkerId,
    confidence: match.confidence,
    timestamp: Date.now(),
  });

  if (!match.matchedWorkerId || match.confidence < MIN_MATCH_CONFIDENCE) {
    return { ...match, recordId: null };
  }

  const id = randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  await db
    .collection("records_pending")
    .doc(id)
    .set({
      id,
      registerType: "attendance",
      companyId: DEFAULT_COMPANY_ID,
      fields: {
        workerName: match.matchedWorkerName,
        date: today,
        status: "present",
        hoursWorked: null,
      },
      confidence: match.confidence,
      notes: `Marked via face check-in. ${match.reasoning}`,
      imageUrl: null,
      status: "pending",
      createdAt: Date.now(),
    });

  return { ...match, recordId: id };
}
