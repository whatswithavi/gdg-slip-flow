import { Router, Request, Response } from "express";
import { runDailyDigest, DailyDigestAgentError } from "../agents/dailyDigestAgent";

export const digestRouter = Router();

digestRouter.get("/api/digest", async (_req: Request, res: Response) => {
  try {
    const result = await runDailyDigest();
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof DailyDigestAgentError) {
      return res.status(422).json({ error: err.message });
    }
    console.error("Unexpected error in GET /api/digest:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
