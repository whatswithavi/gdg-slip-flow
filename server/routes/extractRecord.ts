import { Router, Request, Response } from "express";
import { runRegisterExtraction, RegisterExtractionAgentError } from "../agents/registerExtractionAgent";

export const extractRecordRouter = Router();

extractRecordRouter.post("/api/extract-record", async (req: Request, res: Response) => {
  const { imageBase64, mimeType, registerType } = req.body ?? {};

  if (typeof imageBase64 !== "string" || typeof mimeType !== "string" || typeof registerType !== "string") {
    return res.status(400).json({ error: "Request body must include 'imageBase64', 'mimeType', and 'registerType' strings" });
  }

  try {
    const record = await runRegisterExtraction(imageBase64, mimeType, registerType);
    return res.status(200).json(record);
  } catch (err) {
    if (err instanceof RegisterExtractionAgentError) {
      return res.status(422).json({ error: err.message });
    }
    console.error("Unexpected error in /api/extract-record:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
