import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Drives the real end-to-end workflow (extract -> approve -> query) through
 * the same REST API the Flutter UI calls, against the real Gemini API and
 * the real Firestore project — turning the manual curl verification done
 * during development into a permanent regression test. This is the
 * strongest coverage available given Flutter Web's canvas rendering isn't
 * reliably UI-automatable here (see app-loads.spec.ts and DECISIONS.md).
 *
 * Note: this writes one real record to the `slips`/`audit_log` collections
 * each run (a genuine, correctly-extracted example) rather than a synthetic
 * no-op — there's no delete endpoint (out of scope for the 12h build), so
 * a manual cleanup pass happens before the final demo. See DECISIONS.md.
 */

const API_BASE = "http://localhost:3000";
const FIXTURE_PATH = path.join(__dirname, "fixtures", "test_slip.png");

test("extract -> approve -> query works end-to-end against the real backend", async ({ request }) => {
  const imageBase64 = fs.readFileSync(FIXTURE_PATH).toString("base64");

  const extractRes = await request.post(`${API_BASE}/api/extract-slip`, {
    data: { imageBase64, mimeType: "image/png" },
  });
  expect(extractRes.ok(), await extractRes.text()).toBeTruthy();
  const extracted = await extractRes.json();

  expect(extracted.item).toContain("Steel Rods");
  expect(extracted.quantity).toBe(250);
  expect(extracted.supplier).toContain("ABC Metals");
  expect(extracted.confidence).toBeGreaterThan(0.5);

  const approveRes = await request.post(`${API_BASE}/api/approve-slip`, {
    data: { id: extracted.id },
  });
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

  const pendingRes = await request.get(`${API_BASE}/api/pending-slips`);
  const pending = await pendingRes.json();
  expect(pending.find((s: { id: string }) => s.id === extracted.id)).toBeUndefined();

  const queryRes = await request.post(`${API_BASE}/api/query`, {
    data: { question: "How many units of steel rods did we receive, and from which supplier?" },
  });
  expect(queryRes.ok(), await queryRes.text()).toBeTruthy();
  const answer = await queryRes.json();

  expect(answer.answer.toLowerCase()).toContain("250");
  expect(answer.citedSlipIds).toContain(extracted.id);
});

test("reject removes a slip from the pending queue without approving it", async ({ request }) => {
  const imageBase64 = fs.readFileSync(FIXTURE_PATH).toString("base64");

  const extractRes = await request.post(`${API_BASE}/api/extract-slip`, {
    data: { imageBase64, mimeType: "image/png" },
  });
  const extracted = await extractRes.json();

  const rejectRes = await request.post(`${API_BASE}/api/reject-slip`, {
    data: { id: extracted.id, reason: "e2e test rejection" },
  });
  expect(rejectRes.ok(), await rejectRes.text()).toBeTruthy();

  const pendingRes = await request.get(`${API_BASE}/api/pending-slips`);
  const pending = await pendingRes.json();
  expect(pending.find((s: { id: string }) => s.id === extracted.id)).toBeUndefined();

  const approvedRes = await request.get(`${API_BASE}/api/slips`);
  const approved = await approvedRes.json();
  expect(approved.find((s: { id: string }) => s.id === extracted.id)).toBeUndefined();
});
