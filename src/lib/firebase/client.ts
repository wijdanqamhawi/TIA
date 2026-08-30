"use client";

import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";

/**
 * Firebase CLIENT SDK — used only in Client Components, and only for:
 *  - Firebase Authentication sign-in/sign-up UI
 *  - direct-to-Firebase-Storage admin image upload
 * All Firestore reads/writes happen server-side via the Admin SDK
 * (src/lib/firebase/admin.ts) — never here (Constitution Principle 7).
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const clientAuth = getAuth(firebaseApp);
export const clientStorage = getStorage(firebaseApp);

// Connects to the Firebase Local Emulator Suite automatically in dev/test
// only, as a one-time module-load side effect — every consumer of
// `clientAuth`/`clientStorage` gets this for free, no per-page wiring.
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(clientAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectStorageEmulator(clientStorage, "127.0.0.1", 9199);
}
