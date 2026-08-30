import { afterAll, beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type firebase from "firebase/compat/app";

/**
 * T234 (research.md §11/§22): proves `storage.rules` (T147/T232) actually
 * rejects a non-admin upload and an oversized/non-image file, for both
 * `products/**` and `showcases/**`, via a *client SDK* simulation. The
 * client-side content-type/size checks in `ImageUploader` (T148) are UX
 * only — this suite proves the server-enforced rule is what actually
 * matters, independent of anything the browser sends.
 *
 * Requires the Firebase Local Emulator Suite (Storage) running, with
 * `FIREBASE_STORAGE_EMULATOR_HOST` set in the environment. Skipped
 * automatically otherwise.
 */
const hasEmulator = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);

const ONE_KB_JPEG = Buffer.alloc(1024, 0);
const NINE_MB = Buffer.alloc(9 * 1024 * 1024, 0);

// `UploadTask` is thenable (Promise/A+-compatible) but not nominally typed
// as a `Promise`, which `assertFails`/`assertSucceeds` require — wrapping
// it satisfies the type checker without changing runtime behavior.
function put(ref: firebase.storage.Reference, data: Buffer, contentType: string): Promise<unknown> {
  return Promise.resolve(ref.put(data, { contentType }));
}

describe.skipIf(!hasEmulator)("Storage Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora",
      storage: { rules: readFileSync("storage.rules", "utf8") },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  for (const basePath of ["products/p1", "showcases/s1"] as const) {
    describe(basePath, () => {
      it("allows anyone to read", async () => {
        const unauthed = testEnv.unauthenticatedContext();
        // Reading a non-existent object still exercises the read rule
        // (a 404 from Storage itself, not a rules rejection, is fine —
        // `assertSucceeds` only fails on a permission-denied response).
        await assertSucceeds(
          unauthed
            .storage()
            .ref(`${basePath}/photo.jpg`)
            .getDownloadURL()
            .catch((err: { code?: string }) => {
              if (err?.code === "storage/object-not-found") return null;
              throw err;
            }),
        );
      });

      it("denies an unauthenticated upload", async () => {
        const unauthed = testEnv.unauthenticatedContext();
        await assertFails(put(unauthed.storage().ref(`${basePath}/photo.jpg`), ONE_KB_JPEG, "image/jpeg"));
      });

      it("denies a signed-in, non-admin upload", async () => {
        const customer = testEnv.authenticatedContext("customer-uid", { role: "CUSTOMER" });
        await assertFails(put(customer.storage().ref(`${basePath}/photo.jpg`), ONE_KB_JPEG, "image/jpeg"));
      });

      it("denies an admin upload over the size ceiling", async () => {
        const admin = testEnv.authenticatedContext("admin-uid", { role: "ADMIN" });
        await assertFails(put(admin.storage().ref(`${basePath}/too-big.jpg`), NINE_MB, "image/jpeg"));
      });

      it("denies an admin upload with a non-image content-type", async () => {
        const admin = testEnv.authenticatedContext("admin-uid", { role: "ADMIN" });
        await assertFails(
          put(admin.storage().ref(`${basePath}/not-an-image.txt`), Buffer.from("hello"), "text/plain"),
        );
      });

      it("allows a valid, in-size-limit admin image upload", async () => {
        const admin = testEnv.authenticatedContext("admin-uid", { role: "ADMIN" });
        await assertSucceeds(put(admin.storage().ref(`${basePath}/valid.jpg`), ONE_KB_JPEG, "image/jpeg"));
      });
    });
  }

  it("denies read/write on any other path", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", { role: "ADMIN" });
    await assertFails(put(admin.storage().ref("other/anything.jpg"), ONE_KB_JPEG, "image/jpeg"));
    await assertFails(admin.storage().ref("other/anything.jpg").getDownloadURL());
  });
});
