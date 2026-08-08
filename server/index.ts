import dotenv from "dotenv";
import express from "express";
import { extractSlipRouter } from "./routes/extractSlip";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(extractSlipRouter);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Slip Flow backend listening on http://localhost:${PORT}`);
  });
}

export { app };
