import { Router, Request, Response } from "express";
import { runQuery, QueryAgentError } from "../agents/queryAgent";

export const queryRouter = Router();

queryRouter.post("/api/query", async (req: Request, res: Response) => {
  const { question } = req.body ?? {};

  if (typeof question !== "string") {
    return res.status(400).json({ error: "Request body must include a 'question' string" });
  }

  try {
    const result = await runQuery(question);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof QueryAgentError) {
      return res.status(422).json({ error: err.message });
    }
    console.error("Unexpected error in /api/query:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
