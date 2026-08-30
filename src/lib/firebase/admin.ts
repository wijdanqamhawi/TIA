import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

/**
 * Cached Firebase Admin SDK app (research.md §2), initialized **lazily** on
 * first real use rather than at module import time. Several routes/layouts
 * import this module transitively just to reach `requireUser()`/
 * `requireAdmin()`; a top-level side-effecting `initializeApp()` would
 * throw during Next.js's build-time page-data collection for every such
 * route whenever real Firebase credentials aren't present in that
 * environment (e.g. CI without secrets configured yet). Lazy
 * initialization defers that failure to actual request handling, where it
 * belongs.
 *
 * In the Firebase Local Emulator Suite, the Admin SDK auto-connects via
 * the FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST /
 * FIREBASE_STORAGE_EMULATOR_HOST env vars set by `firebase emulators:start`
 * — no code branch needed here.
 */
let cachedApp: App | undefined;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Emulator Suite: a minimal projectId is enough, no real credentials needed.
    cachedApp = initializeApp({ projectId: projectId ?? "demo-elora", storageBucket });
    return cachedApp;
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin SDK credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
  return cachedApp;
}

let cachedAuth: Auth | undefined;
let cachedFirestore: Firestore | undefined;
let cachedStorage: Storage | undefined;

export function getAdminAuth(): Auth {
  return (cachedAuth ??= getAuth(getAdminApp()));
}

export function getAdminFirestore(): Firestore {
  return (cachedFirestore ??= getFirestore(getAdminApp()));
}

export function getAdminStorage(): Storage {
  return (cachedStorage ??= getStorage(getAdminApp()));
}
