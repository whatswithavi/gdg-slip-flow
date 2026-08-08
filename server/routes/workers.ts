import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { db } from "../firebase";
import { DEFAULT_COMPANY_ID } from "../registerTypes";

export const workersRouter = Router();

/**
 * Enroll a worker's reference photo for face-recognition attendance.
 * Stored as base64 directly in Firestore (not Firebase Storage — not
 * enabled, see DECISIONS.md), so the client should send a reasonably
 * compressed photo, not a full-resolution camera capture.
 */
workersRouter.post("/api/workers", async (req: Request, res: Response) => {
  const { name, photoBase64, mimeType } = req.body ?? {};

  if (typeof name !== "string" || !name.trim() || typeof photoBase64 !== "string" || typeof mimeType !== "string") {
    return res.status(400).json({ error: "Request body must include 'name', 'photoBase64', and 'mimeType'" });
  }

  try {
    const id = randomUUID();
    const worker = {
      id,
      companyId: DEFAULT_COMPANY_ID,
      name: name.trim(),
      photoBase64,
      mimeType,
      createdAt: Date.now(),
    };
    await db.collection("workers").doc(id).set(worker);
    // Don't echo the photo back — the caller already has it, and it's dead weight in the response.
    return res.status(200).json({ id, name: worker.name, createdAt: worker.createdAt });
  } catch (err) {
    console.error("Unexpected error in POST /api/workers:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

workersRouter.get("/api/workers", async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("workers").orderBy("createdAt", "desc").get();
    // Same reasoning: list view doesn't need each worker's full photo payload.
    return res.status(200).json(snap.docs.map((d) => {
      const data = d.data();
      return { id: data.id, name: data.name, createdAt: data.createdAt };
    }));
  } catch (err) {
    console.error("Unexpected error in GET /api/workers:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
