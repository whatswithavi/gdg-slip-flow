/**
 * LLM provider abstraction with automatic fallback.
 *
 * All three agents (RegisterExtractionAgent, QueryAgent, DailyDigestAgent)
 * previously duplicated near-identical "fetch the Gemini API" boilerplate.
 * Centralizing it here does two things: removes that duplication, and adds
 * the multi-provider resilience the hackathon brief itself recommends —
 * Gemini is tried first (it's the primary, already-proven provider), and
 * only on a quota/rate-limit error (429) does this fall back to Groq, not
 * on every other failure mode (a malformed request should fail loudly, not
 * silently retry against a different provider and mask the bug).
 */

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_TEXT_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TEXT_MODEL = "openai/gpt-oss-20b";
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";

export class LLMError extends Error {}

export interface LLMImage {
  base64: string;
  mimeType: string;
}

function isQuotaError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("(429)");
}

/**
 * Groq's Qwen vision/text models run in "thinking mode" by default, which
 * prepends a `<think>...</think>` reasoning block before the actual answer
 * — Gemini never does this. Every caller here asks for a bare JSON response,
 * so strip it centrally rather than teaching every skill's parser about a
 * provider-specific quirk it shouldn't need to know about.
 */
function stripThinkingBlock(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function callGeminiText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMError("GEMINI_API_KEY is not set");

  const res = await fetch(`${GEMINI_TEXT_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new LLMError(`Gemini request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new LLMError("Gemini returned no content");
  return text;
}

async function callGeminiVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMError("GEMINI_API_KEY is not set");

  const res = await fetch(`${GEMINI_TEXT_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new LLMError(`Gemini request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new LLMError("Gemini returned no content");
  return text;
}

async function callGeminiMultiVision(prompt: string, images: LLMImage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMError("GEMINI_API_KEY is not set");

  const res = await fetch(`${GEMINI_TEXT_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new LLMError(`Gemini request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new LLMError("Gemini returned no content");
  return text;
}

async function callGroqText(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new LLMError("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new LLMError(`Groq request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new LLMError("Groq returned no content");
  return stripThinkingBlock(text);
}

async function callGroqVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new LLMError("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new LLMError(`Groq request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new LLMError("Groq returned no content");
  return stripThinkingBlock(text);
}

async function callGroqMultiVision(prompt: string, images: LLMImage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new LLMError("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
            })),
          ],
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new LLMError(`Groq request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new LLMError("Groq returned no content");
  return stripThinkingBlock(text);
}

export async function callLLMText(prompt: string): Promise<string> {
  try {
    return await callGeminiText(prompt);
  } catch (err) {
    if (isQuotaError(err) && process.env.GROQ_API_KEY) {
      console.warn("Gemini quota exceeded — falling back to Groq (text)");
      return await callGroqText(prompt);
    }
    throw err;
  }
}

export async function callLLMVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  try {
    return await callGeminiVision(prompt, imageBase64, mimeType);
  } catch (err) {
    if (isQuotaError(err) && process.env.GROQ_API_KEY) {
      console.warn("Gemini quota exceeded — falling back to Groq (vision)");
      return await callGroqVision(prompt, imageBase64, mimeType);
    }
    throw err;
  }
}

/**
 * Multiple images in one call — used by FaceAttendanceAgent to compare a
 * captured photo against several enrolled worker reference photos in a
 * single request rather than one call per worker.
 */
export async function callLLMMultiVision(prompt: string, images: LLMImage[]): Promise<string> {
  try {
    return await callGeminiMultiVision(prompt, images);
  } catch (err) {
    if (isQuotaError(err) && process.env.GROQ_API_KEY) {
      console.warn("Gemini quota exceeded — falling back to Groq (multi-vision)");
      return await callGroqMultiVision(prompt, images);
    }
    throw err;
  }
}
