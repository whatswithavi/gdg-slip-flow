/**
 * Custom agent: SlipExtractionAgent
 *
 * Orchestrates a slip-upload request end-to-end: takes a slip image, invokes
 * the parse_slip_data skill to build the prompt, calls Gemini's multimodal
 * endpoint (image in, structured JSON out — one call, no separate OCR step),
 * uploads the image to Storage, writes the result to slips_pending, and logs
 * the extraction attempt to audit_log. Never writes to the approved `slips`
 * collection — only a human approval action (see routes/approve.ts) does that.
 */

import { randomUUID } from "crypto";
import { db, bucket } from "../firebase";
import { buildExtractionPrompt, parseExtractionResponse, SlipExtractionResult } from "../skills/parse_slip_data";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class SlipExtractionAgentError extends Error {}

export interface SlipRecord extends SlipExtractionResult {
  id: string;
  imageUrl: string | null;
  status: "pending";
  createdAt: number;
}

async function callGeminiVision(imageBase64: string, mimeType: string): Promise<SlipExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new SlipExtractionAgentError("GEMINI_API_KEY is not set");
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildExtractionPrompt() },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new SlipExtractionAgentError(`LLM request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new SlipExtractionAgentError("LLM returned no content");
  }

  try {
    return parseExtractionResponse(text);
  } catch (err) {
    throw new SlipExtractionAgentError(`Failed to parse LLM response as structured extraction: ${(err as Error).message}`);
  }
}

/**
 * Returns null (rather than throwing) if Storage isn't reachable — e.g. the
 * bucket hasn't been enabled in the Firebase Console yet. Extraction and the
 * approval workflow are still fully functional without an image reference;
 * this is a deliberately non-blocking degradation, not a silent swallow of
 * an error that should stop the request (logged either way).
 */
async function uploadSlipImage(id: string, imageBase64: string, mimeType: string): Promise<string | null> {
  try {
    const ext = mimeType.split("/")[1] || "jpg";
    const file = bucket.file(`slips/${id}.${ext}`);
    const buffer = Buffer.from(imageBase64, "base64");

    await file.save(buffer, { contentType: mimeType });

    // Signed URL rather than makePublic() — modern Firebase Storage buckets
    // default to Uniform Bucket-Level Access, which rejects per-object ACL
    // calls like makePublic() outright. A long-lived signed URL works
    // regardless of that setting.
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
    });

    return signedUrl;
  } catch (err) {
    console.warn(`Storage upload failed for slip ${id} (continuing without an image reference):`, (err as Error).message);
    return null;
  }
}

export async function runSlipExtraction(imageBase64: string, mimeType: string): Promise<SlipRecord> {
  if (!imageBase64) {
    throw new SlipExtractionAgentError("No image provided");
  }

  const id = randomUUID();
  const extraction = await callGeminiVision(imageBase64, mimeType);
  const imageUrl = await uploadSlipImage(id, imageBase64, mimeType);

  const record: SlipRecord = {
    id,
    ...extraction,
    imageUrl,
    status: "pending",
    createdAt: Date.now(),
  };

  await db.collection("slips_pending").doc(id).set(record);

  await db.collection("audit_log").add({
    type: "extraction",
    slipId: id,
    confidence: extraction.confidence,
    notes: extraction.notes,
    timestamp: Date.now(),
  });

  return record;
}
