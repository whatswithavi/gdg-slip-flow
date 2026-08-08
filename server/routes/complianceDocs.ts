import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { db } from "../firebase";
import { DEFAULT_COMPANY_ID } from "../registerTypes";

export const complianceDocsRouter = Router();

/**
 * Text-based compliance documents (license text, safety norms, SOPs, ...).
 * Deliberately text-in, not PDF upload+parsing -- that's a real scope
 * expansion (extraction, storage, OCR-for-scanned-PDFs) that wasn't worth
 * the remaining time; pasting/typing the relevant text achieves the same
 * "ask questions with citations against your own compliance docs" goal.
 * expiryDate is provided by the uploader, not LLM-extracted -- avoids
 * spending more of the already-tight Gemini quota on a field a human
 * filling out a form can just type directly.
 */
complianceDocsRouter.post("/api/compliance-docs", async (req: Request, res: Response) => {
  const { title, content, expiryDate } = req.body ?? {};

  if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Request body must include non-empty 'title' and 'content' strings" });
  }

  try {
    const id = randomUUID();
    const doc = {
      id,
      companyId: DEFAULT_COMPANY_ID,
      title: title.trim(),
      content: content.trim(),
      expiryDate: typeof expiryDate === "string" && expiryDate.trim() ? expiryDate.trim() : null,
      createdAt: Date.now(),
    };
    await db.collection("compliance_docs").doc(id).set(doc);
    return res.status(200).json(doc);
  } catch (err) {
    console.error("Unexpected error in POST /api/compliance-docs:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

complianceDocsRouter.get("/api/compliance-docs", async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("compliance_docs").orderBy("createdAt", "desc").get();
    return res.status(200).json(snap.docs.map((d) => d.data()));
  } catch (err) {
    console.error("Unexpected error in GET /api/compliance-docs:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
