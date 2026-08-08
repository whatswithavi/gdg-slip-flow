import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { extractSlipRouter } from "./routes/extractSlip";
import { slipsRouter } from "./routes/slips";
import { queryRouter } from "./routes/query";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(extractSlipRouter);
app.use(slipsRouter);
app.use(queryRouter);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Slip Flow backend listening on http://localhost:${PORT}`);
  });
}

export { app };
