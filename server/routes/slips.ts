import { Router, Request, Response } from "express";
import { db } from "../firebase";

export const slipsRouter = Router();

slipsRouter.get("/api/pending-slips", async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("slips_pending").orderBy("createdAt", "desc").get();
    return res.status(200).json(snap.docs.map((d) => d.data()));
  } catch (err) {
    console.error("Unexpected error in GET /api/pending-slips:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

slipsRouter.get("/api/slips", async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("slips").orderBy("createdAt", "desc").get();
    return res.status(200).json(snap.docs.map((d) => d.data()));
  } catch (err) {
    console.error("Unexpected error in GET /api/slips:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

slipsRouter.post("/api/approve-slip", async (req: Request, res: Response) => {
  const { id, item, quantity, unit, date, supplier } = req.body ?? {};

  if (typeof id !== "string" || id.length === 0) {
    return res.status(400).json({ error: "Request body must include a non-empty 'id' string" });
  }

  try {
    const pendingRef = db.collection("slips_pending").doc(id);
    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      return res.status(404).json({ error: `No pending slip with id ${id}` });
    }

    // Human-edited fields (from the approval form) override the original
    // extraction where provided — the approver is the source of truth once
    // they've reviewed the slip.
    const original = pendingDoc.data()!;
    const approved = {
      ...original,
      item: item ?? original.item,
      quantity: quantity ?? original.quantity,
      unit: unit ?? original.unit,
      date: date ?? original.date,
      supplier: supplier ?? original.supplier,
      status: "approved",
      approvedAt: Date.now(),
    };

    await db.collection("slips").doc(id).set(approved);
    await pendingRef.delete();
    await db.collection("audit_log").add({
      type: "approved",
      slipId: id,
      timestamp: Date.now(),
    });

    return res.status(200).json(approved);
  } catch (err) {
    console.error("Unexpected error in POST /api/approve-slip:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

slipsRouter.post("/api/reject-slip", async (req: Request, res: Response) => {
  const { id, reason } = req.body ?? {};

  if (typeof id !== "string" || id.length === 0) {
    return res.status(400).json({ error: "Request body must include a non-empty 'id' string" });
  }

  try {
    const pendingRef = db.collection("slips_pending").doc(id);
    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      return res.status(404).json({ error: `No pending slip with id ${id}` });
    }

    await pendingRef.delete();
    await db.collection("audit_log").add({
      type: "rejected",
      slipId: id,
      reason: reason ?? null,
      timestamp: Date.now(),
    });

    return res.status(200).json({ id, status: "rejected" });
  } catch (err) {
    console.error("Unexpected error in POST /api/reject-slip:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
