import { Router, Request, Response } from "express";
import { REGISTER_TYPES } from "../registerTypes";

export const registerTypesRouter = Router();

// Lets the Flutter app render the register-type picker and dynamic field
// forms from this single source of truth instead of hardcoding the field
// list client-side too.
registerTypesRouter.get("/api/register-types", (_req: Request, res: Response) => {
  res.status(200).json(Object.values(REGISTER_TYPES));
});
