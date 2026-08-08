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

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : path.resolve(__dirname, "..", "firebase-service-account.json");

if (getApps().length === 0) {
  initializeApp({
    credential: cert(credentialPath),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const db = getFirestore();
export const bucket = getStorage().bucket();
