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
 * Updated for the generalized register-type API (was slip-only, see
 * DECISIONS.md Part A): every record now carries a `registerType` and a
 * generic `fields` object instead of hardcoded intake-slip fields.
 *
 * Note: this writes one real record to the `records`/`audit_log`
 * collections each run (a genuine, correctly-extracted example) rather than
 * a synthetic no-op — there's no delete endpoint (out of scope for the
 * hackathon build), so a manual cleanup pass happens before the final demo.
 */

const API_BASE = "http://localhost:3000";
const FIXTURE_PATH = path.join(__dirname, "fixtures", "test_slip.png");

test("extract -> approve -> query works end-to-end against the real backend", async ({ request }) => {
  const imageBase64 = fs.readFileSync(FIXTURE_PATH).toString("base64");

  const extractRes = await request.post(`${API_BASE}/api/extract-record`, {
    data: { imageBase64, mimeType: "image/png", registerType: "intake" },
  });
  expect(extractRes.ok(), await extractRes.text()).toBeTruthy();
  const extracted = await extractRes.json();

  expect(extracted.registerType).toBe("intake");
  expect(extracted.fields.item).toContain("Steel Rods");
  expect(extracted.fields.quantity).toBe(250);
  expect(extracted.fields.supplier).toContain("ABC Metals");
  expect(extracted.confidence).toBeGreaterThan(0.5);

  const approveRes = await request.post(`${API_BASE}/api/approve-record`, {
    data: { id: extracted.id },
  });
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

  const pendingRes = await request.get(`${API_BASE}/api/pending-records`);
  const pending = await pendingRes.json();
  expect(pending.find((r: { id: string }) => r.id === extracted.id)).toBeUndefined();

  // Asks about this specific record by id rather than "how many units of
  // steel rods total" — this test suite has run against the same real
  // Firestore project many times over this build, so multiple similar
  // intake records have accumulated (documented above: no delete endpoint,
  // manual cleanup happens before the final demo, not after every run).
  // An aggregate-quantity question correctly sums ALL matching approved
  // records, which grows over time — asserting a fixed total would make
  // this test flaky by construction, not because of a real regression (this
  // happened once already: 11 accumulated entries summed to 2,750, not the
  // 250 from just this run). Citation + a non-aggregated fact (supplier
  // name) are what's actually worth asserting here.
  const queryRes = await request.post(`${API_BASE}/api/query`, {
    data: { question: `Which supplier is on the intake record with id ${extracted.id}?` },
  });
  expect(queryRes.ok(), await queryRes.text()).toBeTruthy();
  const answer = await queryRes.json();

  expect(answer.answer.toLowerCase()).toContain("abc metals");
  expect(answer.citedRecordIds).toContain(extracted.id);
});

test("reject removes a record from the pending queue without approving it", async ({ request }) => {
  const imageBase64 = fs.readFileSync(FIXTURE_PATH).toString("base64");

  const extractRes = await request.post(`${API_BASE}/api/extract-record`, {
    data: { imageBase64, mimeType: "image/png", registerType: "intake" },
  });
  expect(extractRes.ok(), await extractRes.text()).toBeTruthy();
  const extracted = await extractRes.json();

  const rejectRes = await request.post(`${API_BASE}/api/reject-record`, {
    data: { id: extracted.id, reason: "e2e test rejection" },
  });
  expect(rejectRes.ok(), await rejectRes.text()).toBeTruthy();

  const pendingRes = await request.get(`${API_BASE}/api/pending-records`);
  const pending = await pendingRes.json();
  expect(pending.find((r: { id: string }) => r.id === extracted.id)).toBeUndefined();

  const approvedRes = await request.get(`${API_BASE}/api/records`);
  const approved = await approvedRes.json();
  expect(approved.find((r: { id: string }) => r.id === extracted.id)).toBeUndefined();
});
