import { Router, Request, Response } from "express";
import { db } from "../firebase";
import { getRegisterType } from "../registerTypes";
import { sendReceiptEmail } from "../services/email";

export const recordsRouter = Router();

recordsRouter.get("/api/pending-records", async (req: Request, res: Response) => {
  try {
    const registerType = typeof req.query.registerType === "string" ? req.query.registerType : undefined;
    let query = db.collection("records_pending").orderBy("createdAt", "desc") as FirebaseFirestore.Query;
    if (registerType) {
      query = db.collection("records_pending").where("registerType", "==", registerType).orderBy("createdAt", "desc");
    }
    const snap = await query.get();
    return res.status(200).json(snap.docs.map((d) => d.data()));
  } catch (err) {
    console.error("Unexpected error in GET /api/pending-records:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

recordsRouter.get("/api/records", async (req: Request, res: Response) => {
  try {
    const registerType = typeof req.query.registerType === "string" ? req.query.registerType : undefined;
    let query = db.collection("records").orderBy("createdAt", "desc") as FirebaseFirestore.Query;
    if (registerType) {
      query = db.collection("records").where("registerType", "==", registerType).orderBy("createdAt", "desc");
    }
    const snap = await query.get();
    return res.status(200).json(snap.docs.map((d) => d.data()));
  } catch (err) {
    console.error("Unexpected error in GET /api/records:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

recordsRouter.post("/api/approve-record", async (req: Request, res: Response) => {
  const { id, fields } = req.body ?? {};

  if (typeof id !== "string" || id.length === 0) {
    return res.status(400).json({ error: "Request body must include a non-empty 'id' string" });
  }

  try {
    const pendingRef = db.collection("records_pending").doc(id);
    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      return res.status(404).json({ error: `No pending record with id ${id}` });
    }

    // Human-edited fields (from the approval form) override the original
    // extraction where provided — the approver is the source of truth once
    // they've reviewed the record.
    const original = pendingDoc.data()!;
    const approved = {
      ...original,
      fields: fields && typeof fields === "object" ? { ...original.fields, ...fields } : original.fields,
      status: "approved",
      approvedAt: Date.now(),
    };

    await db.collection("records").doc(id).set(approved);
    await pendingRef.delete();
    await db.collection("audit_log").add({
      type: "approved",
      registerType: original.registerType,
      recordId: id,
      timestamp: Date.now(),
    });

    // Non-blocking, same pattern as Storage image uploads: a failed email
    // must never fail the approval itself. The approval is already durably
    // recorded above; the email is a convenience layer on top of it.
    try {
      const typeConfig = getRegisterType(original.registerType);
      await sendReceiptEmail(
        { id, registerType: original.registerType, fields: approved.fields, approvedAt: approved.approvedAt },
        typeConfig.label,
        typeConfig.fields
      );
      await db.collection("audit_log").add({
        type: "receipt_emailed",
        recordId: id,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn(`Receipt email failed for record ${id} (approval still succeeded):`, (err as Error).message);
    }

    return res.status(200).json(approved);
  } catch (err) {
    console.error("Unexpected error in POST /api/approve-record:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

recordsRouter.post("/api/reject-record", async (req: Request, res: Response) => {
  const { id, reason } = req.body ?? {};

  if (typeof id !== "string" || id.length === 0) {
    return res.status(400).json({ error: "Request body must include a non-empty 'id' string" });
  }

  try {
    const pendingRef = db.collection("records_pending").doc(id);
    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      return res.status(404).json({ error: `No pending record with id ${id}` });
    }

    const original = pendingDoc.data()!;
    await pendingRef.delete();
    await db.collection("audit_log").add({
      type: "rejected",
      registerType: original.registerType,
      recordId: id,
      reason: reason ?? null,
      timestamp: Date.now(),
    });

    return res.status(200).json({ id, status: "rejected" });
  } catch (err) {
    console.error("Unexpected error in POST /api/reject-record:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
