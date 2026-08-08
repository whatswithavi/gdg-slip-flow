import { Router, Request, Response } from "express";
import { runFaceAttendance, FaceAttendanceAgentError } from "../agents/faceAttendanceAgent";

export const faceAttendanceRouter = Router();

faceAttendanceRouter.post("/api/mark-attendance", async (req: Request, res: Response) => {
  const { imageBase64, mimeType } = req.body ?? {};

  if (typeof imageBase64 !== "string" || typeof mimeType !== "string") {
    return res.status(400).json({ error: "Request body must include 'imageBase64' and 'mimeType' strings" });
  }

  try {
    const result = await runFaceAttendance(imageBase64, mimeType);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof FaceAttendanceAgentError) {
      return res.status(422).json({ error: err.message });
    }
    console.error("Unexpected error in /api/mark-attendance:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
