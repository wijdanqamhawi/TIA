import "server-only";
import { getAdminStorage } from "@/lib/firebase/admin";
import { categoryShowcasesCollection, productsCollection } from "@/lib/firebase/firestore";
import { logger } from "@/lib/utils/logger";

/**
 * Storage cleanup for deleted products — the ONE implementation used by the single delete, Delete All and
 * remove-image. It deletes a file only when it can PROVE the file belongs exclusively to the product(s)
 * being removed; anything it cannot prove is left in Storage.
 *
 * How ownership is proven. Product photos are uploaded to `products/{productId}/{file}` (the admin
 * uploader and `storage.rules`), and the product document records each one as `{ url, storagePath }`. An
 * image is OWNED by product P only if ALL of these hold:
 *
 *  1. `storagePath` is exactly `products/<P>/<one file name>` — P's own folder, one segment, no `.`/`..`;
 *  2. `url` is an absolute http(s) Firebase download URL whose object path (`…/o/<encoded path>`) decodes to
 *     that very same `storagePath` — so the URL and the path agree about which object it is;
 *  3. when the bucket name is known, the URL's bucket (`…/b/<bucket>/o/…`) is our bucket;
 *  4. no OTHER document (a remaining product or a homepage showcase) still references that path.
 *
 * So these are never deletable, by construction: root-relative assets such as `/brand/logo.svg`, anything
 * outside `products/<P>/` (brand and hero assets, `showcases/…`, category images, the `seed/products/…`
 * demo files), another product's folder, and any path whose ownership cannot be shown.
 */

export type ProductImageLike = { url?: string | null; storagePath?: string | null };

export type ImageCleanupResult = {
  /** Files removed from Storage (or already gone). */
  deleted: number;
  /** Owned files whose deletion failed — they are still in Storage. */
  failed: number;
  /** Images deliberately left alone: not provably product-owned, or still referenced elsewhere. */
  skipped: number;
};

export const NO_IMAGE_CLEANUP: ImageCleanupResult = { deleted: 0, failed: 0, skipped: 0 };

const OWNED_PATH = /^products\/([^/]+)\/([^/]+)$/;
const DELETE_BATCH = 20;

/** The decoded object path and bucket of a Firebase Storage download URL, or `null` if it is not one. */
function parseDownloadUrl(url: string): { bucket: string | null; path: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const object = /\/o\/([^/]+)$/.exec(parsed.pathname);
    if (!object) return null;
    const bucket = /\/b\/([^/]+)\/o\//.exec(parsed.pathname);
    return { bucket: bucket?.[1] ?? null, path: decodeURIComponent(object[1]) };
  } catch {
    return null;
  }
}

/** Pure ownership rule (1–3 above). `bucketName`, when given, must match the URL's bucket. */
export function isOwnedProductImage(
  productId: string,
  image: ProductImageLike,
  bucketName?: string,
): boolean {
  const path = image.storagePath;
  if (typeof path !== "string" || typeof image.url !== "string") return false;
  const match = OWNED_PATH.exec(path);
  if (!match || match[1] !== productId) return false;
  if (match[2] === "." || match[2] === "..") return false;
  const fromUrl = parseDownloadUrl(image.url);
  if (!fromUrl || fromUrl.path !== path) return false;
  if (bucketName && fromUrl.bucket !== bucketName) return false;
  return true;
}

/** Every storage path still referenced by a product or a homepage showcase (rule 4). Throws if it can't be read. */
async function loadReferencedPaths(): Promise<Set<string>> {
  const [products, showcases] = await Promise.all([
    productsCollection().get(),
    categoryShowcasesCollection().get(),
  ]);
  const paths = new Set<string>();
  for (const doc of products.docs) {
    for (const image of doc.data().images ?? []) {
      if (image.storagePath) paths.add(image.storagePath);
    }
  }
  for (const doc of showcases.docs) {
    const showcase = doc.data();
    for (const image of [showcase.desktopImage, showcase.mobileImage]) {
      if (image?.storagePath) paths.add(image.storagePath);
    }
  }
  return paths;
}

/**
 * Deletes the Storage files owned by the given (already-removed) products' images and reports exactly what
 * happened. Call it AFTER the Firestore documents are gone: the "still referenced" check then sees only what
 * remains. It never throws — if Storage or the reference check cannot be used, nothing is deleted and every
 * owned file is reported as `failed`, so the caller can say so honestly. Deleting is per file, so one
 * failure never stops the others, and a file already missing counts as deleted.
 */
export async function cleanupProductImages(
  removed: Array<{ productId: string; images: ProductImageLike[] }>,
): Promise<ImageCleanupResult> {
  let bucketName: string | undefined;
  let bucket: ReturnType<ReturnType<typeof getAdminStorage>["bucket"]> | null = null;
  try {
    bucket = getAdminStorage().bucket();
    bucketName = bucket.name;
  } catch (err) {
    logger.error("product image cleanup: Storage unavailable", { error: String(err) });
  }

  const candidates = new Set<string>();
  let skipped = 0;
  for (const { productId, images } of removed) {
    for (const image of images) {
      if (isOwnedProductImage(productId, image, bucketName))
        candidates.add(image.storagePath as string);
      else skipped += 1;
    }
  }
  if (candidates.size === 0) return { deleted: 0, failed: 0, skipped };
  if (!bucket) return { deleted: 0, failed: candidates.size, skipped };

  let referenced: Set<string>;
  try {
    referenced = await loadReferencedPaths();
  } catch (err) {
    // Cannot prove nothing else uses these files: delete none of them.
    logger.error("product image cleanup: could not verify references", { error: String(err) });
    return { deleted: 0, failed: candidates.size, skipped };
  }

  const toDelete: string[] = [];
  for (const path of candidates) {
    if (referenced.has(path)) skipped += 1;
    else toDelete.push(path);
  }

  let deleted = 0;
  let failed = 0;
  for (let start = 0; start < toDelete.length; start += DELETE_BATCH) {
    const batch = toDelete.slice(start, start + DELETE_BATCH);
    const outcomes = await Promise.allSettled(
      batch.map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
    );
    outcomes.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") deleted += 1;
      else {
        failed += 1;
        logger.error("product image cleanup: a file could not be deleted", {
          path: batch[index],
          error: String(outcome.reason),
        });
      }
    });
  }
  return { deleted, failed, skipped };
}

/**
 * Deletes ONE product's document and then its owned Storage images — the single-delete path, sharing
 * `cleanupProductImages` with Delete All. The document goes first, so a product is never left pointing
 * at files that were already removed. A product that does not exist is a no-op.
 */
export async function deleteProductWithImages(productId: string): Promise<ImageCleanupResult> {
  const ref = productsCollection().doc(productId);
  const snapshot = await ref.get();
  const images = snapshot.exists ? (snapshot.data()!.images ?? []) : [];
  await ref.delete();
  if (images.length === 0) return NO_IMAGE_CLEANUP;
  return cleanupProductImages([{ productId, images }]);
}
