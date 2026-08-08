/**
 * Custom agent: RegisterExtractionAgent
 *
 * Orchestrates a paper-register-upload request end-to-end, for any
 * configured register type (see registerTypes.ts): takes a document image
 * and a registerType id, invokes the extract_register_data skill to build
 * the type-specific prompt, calls Gemini's multimodal endpoint (image in,
 * structured JSON out — one call, no separate OCR step), uploads the image
 * to Storage, writes the result to records_pending, and logs the extraction
 * attempt to audit_log. Never writes to the approved `records` collection —
 * only a human approval action (see routes/records.ts) does that.
 *
 * Generalizes the original SlipExtractionAgent, which only handled one
 * hardcoded document type (raw-material intake).
 */

import { randomUUID } from "crypto";
import { db, bucket } from "../firebase";
import { getRegisterType, DEFAULT_COMPANY_ID } from "../registerTypes";
import { buildExtractionPrompt, parseExtractionResponse, RegisterExtractionResult } from "../skills/extract_register_data";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class RegisterExtractionAgentError extends Error {}

export interface RegisterRecord extends RegisterExtractionResult {
  id: string;
  registerType: string;
  companyId: string;
  imageUrl: string | null;
  status: "pending";
  createdAt: number;
}

async function callGeminiVision(
  imageBase64: string,
  mimeType: string,
  registerTypeId: string
): Promise<RegisterExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new RegisterExtractionAgentError("GEMINI_API_KEY is not set");
  }

  const config = getRegisterType(registerTypeId);

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildExtractionPrompt(config) },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new RegisterExtractionAgentError(`LLM request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new RegisterExtractionAgentError("LLM returned no content");
  }

  try {
    return parseExtractionResponse(text, config);
  } catch (err) {
    throw new RegisterExtractionAgentError(`Failed to parse LLM response as structured extraction: ${(err as Error).message}`);
  }
}

/**
 * Returns null (rather than throwing) if Storage isn't reachable — e.g. the
 * bucket hasn't been enabled in the Firebase Console yet. Extraction and the
 * approval workflow are still fully functional without an image reference;
 * this is a deliberately non-blocking degradation, not a silent swallow of
 * an error that should stop the request (logged either way).
 */
async function uploadRegisterImage(id: string, imageBase64: string, mimeType: string): Promise<string | null> {
  try {
    const ext = mimeType.split("/")[1] || "jpg";
    const file = bucket.file(`registers/${id}.${ext}`);
    const buffer = Buffer.from(imageBase64, "base64");

    await file.save(buffer, { contentType: mimeType });

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
    });

    return signedUrl;
  } catch (err) {
    console.warn(`Storage upload failed for record ${id} (continuing without an image reference):`, (err as Error).message);
    return null;
  }
}

export async function runRegisterExtraction(
  imageBase64: string,
  mimeType: string,
  registerTypeId: string
): Promise<RegisterRecord> {
  if (!imageBase64) {
    throw new RegisterExtractionAgentError("No image provided");
  }
  if (!registerTypeId) {
    throw new RegisterExtractionAgentError("No registerType provided");
  }

  // Throws a clear error early if the type is unknown, before spending a
  // Gemini call on a request we can't process.
  getRegisterType(registerTypeId);

  const id = randomUUID();
  const extraction = await callGeminiVision(imageBase64, mimeType, registerTypeId);
  const imageUrl = await uploadRegisterImage(id, imageBase64, mimeType);

  const record: RegisterRecord = {
    id,
    registerType: registerTypeId,
    companyId: DEFAULT_COMPANY_ID,
    ...extraction,
    imageUrl,
    status: "pending",
    createdAt: Date.now(),
  };

  await db.collection("records_pending").doc(id).set(record);

  await db.collection("audit_log").add({
    type: "extraction",
    registerType: registerTypeId,
    recordId: id,
    confidence: extraction.confidence,
    notes: extraction.notes,
    timestamp: Date.now(),
  });

  return record;
}
