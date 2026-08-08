import path from "path";
import dotenv from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Loaded here (not just in index.ts) because ES/CommonJS imports are
// hoisted and evaluated before any other code in the importing module runs
// — index.ts's dotenv.config() call executes too late to affect the
// environment this module reads at import time.
dotenv.config();

// Serverless hosts (Vercel, etc.) have no writable/persistent filesystem to
// point GOOGLE_APPLICATION_CREDENTIALS at, so the service account can also
// be supplied as a raw JSON string via FIREBASE_SERVICE_ACCOUNT_JSON — the
// same value CI writes to a file, just consumed directly instead. File path
// stays the default for local dev, where the file already exists.
function resolveCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path.resolve(__dirname, "..", "firebase-service-account.json");
  return cert(credentialPath);
}

if (getApps().length === 0) {
  initializeApp({
    credential: resolveCredential(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const db = getFirestore();
export const bucket = getStorage().bucket();
