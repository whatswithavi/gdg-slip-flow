import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { extractRecordRouter } from "./routes/extractRecord";
import { recordsRouter } from "./routes/records";
import { registerTypesRouter } from "./routes/registerTypes";
import { queryRouter } from "./routes/query";
import { payrollRouter } from "./routes/payroll";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(extractRecordRouter);
app.use(recordsRouter);
app.use(registerTypesRouter);
app.use(queryRouter);
app.use(payrollRouter);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Slip Flow backend listening on http://localhost:${PORT}`);
  });
}

export { app };
