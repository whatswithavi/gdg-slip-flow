import { Router, Request, Response } from "express";
import { db } from "../firebase";
import { calculatePayroll, AttendanceRecord } from "../services/payroll";

export const payrollRouter = Router();

payrollRouter.get("/api/payroll", async (req: Request, res: Response) => {
  const wageRate = Number(req.query.wageRate);

  if (!Number.isFinite(wageRate) || wageRate < 0) {
    return res.status(400).json({ error: "Query param 'wageRate' must be a non-negative number" });
  }

  try {
    const snap = await db.collection("records").where("registerType", "==", "attendance").get();
    const records = snap.docs.map((d) => d.data()) as AttendanceRecord[];
    const summary = calculatePayroll(records, wageRate);
    return res.status(200).json({ wageRate, summary });
  } catch (err) {
    console.error("Unexpected error in GET /api/payroll:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
