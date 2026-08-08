import { Router, Request, Response } from "express";
import { runSlipExtraction, SlipExtractionAgentError } from "../agents/slipExtractionAgent";

export const extractSlipRouter = Router();

extractSlipRouter.post("/api/extract-slip", async (req: Request, res: Response) => {
  const { imageBase64, mimeType } = req.body ?? {};

  if (typeof imageBase64 !== "string" || typeof mimeType !== "string") {
    return res.status(400).json({ error: "Request body must include 'imageBase64' and 'mimeType' strings" });
  }

  try {
    const record = await runSlipExtraction(imageBase64, mimeType);
    return res.status(200).json(record);
  } catch (err) {
    if (err instanceof SlipExtractionAgentError) {
      return res.status(422).json({ error: err.message });
    }
    console.error("Unexpected error in /api/extract-slip:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
