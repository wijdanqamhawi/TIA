import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { productsCollection } from "@/lib/firebase/firestore";
import { logger } from "@/lib/utils/logger";
import {
  cleanupProductImages,
  NO_IMAGE_CLEANUP,
  type ImageCleanupResult,
} from "@/lib/domain/admin/product-images";

/** Firestore allows 500 writes per batch; stay well under it. */
const CHUNK_SIZE = 400;

export type BulkResult =
  | {
      ok: true;
      count: number;
      /** Delete All products only: what happened to the Storage images (never claims more than it did). */
      images?: ImageCleanupResult;
    }
  | {
      ok: false;
      /**
       * `STALE_COUNT` — the number the admin confirmed no longer matches what exists, so NOTHING was touched;
       * `PARTIAL_FAILURE` — some chunks committed before one failed (`done` of them);
       * `FAILED` — the first chunk failed, nothing changed.
       */
      code: "STALE_COUNT" | "PARTIAL_FAILURE" | "FAILED";
      done: number;
      remaining: number;
      /** Images of the products that WERE deleted before the failure (Delete All products only). */
      images?: ImageCleanupResult;
    };

/**
 * Applies one write per item in atomic chunks. Each chunk is all-or-nothing; if a later chunk fails the
 * earlier ones stay committed and the outcome says exactly how many were done, so the admin can see the
 * true state (and simply run it again: both bulk actions are idempotent). `committed` lists exactly the items
 * whose chunk committed, so follow-up work (Storage cleanup) only ever touches what was really changed.
 */
async function runChunked<T>(
  db: FirebaseFirestore.Firestore,
  items: T[],
  apply: (batch: FirebaseFirestore.WriteBatch, item: T) => void,
): Promise<{ result: BulkResult; committed: T[] }> {
  let done = 0;
  const committed: T[] = [];
  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    const slice = items.slice(start, start + CHUNK_SIZE);
    const batch = db.batch();
    slice.forEach((item) => apply(batch, item));
    try {
      await batch.commit();
    } catch (err) {
      logger.error("bulk admin action: a chunk failed", {
        done,
        total: items.length,
        error: String(err),
      });
      return {
        result: {
          ok: false,
          code: done > 0 ? "PARTIAL_FAILURE" : "FAILED",
          done,
          remaining: items.length - done,
        },
        committed,
      };
    }
    done += slice.length;
    committed.push(...slice);
  }
  return { result: { ok: true, count: done }, committed };
}

/**
 * Deletes every product document, then the Storage images those products own exclusively
 * (`cleanupProductImages` — only files provably in a deleted product's own `products/<id>/` folder; brand,
 * showcase, category and shared files are never touched). Past orders are unaffected (their lines are
 * immutable snapshots of name, option and price), carts and wishlists already treat a missing product as
 * silently absent, and categories, showcases, customers and orders are never read or written.
 *
 * Firestore and Storage are separate systems, so the outcome reports both honestly: `count` is the product
 * documents deleted, `images.failed` the owned image files that could NOT be deleted (they remain in
 * Storage). If a later chunk fails, the images of the products that were already deleted are still cleaned
 * up, and the products that remain keep their images.
 *
 * `expectedCount` is the number the admin saw in the confirmation dialog. If the catalog changed since
 * (a product added or removed elsewhere), nothing is deleted and the caller is told to reload, so the
 * deletion is always exactly what was confirmed.
 */
export async function deleteAllProducts(
  db: FirebaseFirestore.Firestore,
  expectedCount: number,
): Promise<BulkResult> {
  const snapshot = await productsCollection().get();
  if (snapshot.docs.length !== expectedCount) {
    return { ok: false, code: "STALE_COUNT", done: 0, remaining: snapshot.docs.length };
  }
  const { result, committed } = await runChunked(db, snapshot.docs, (batch, doc) =>
    batch.delete(doc.ref),
  );
  const images =
    committed.length > 0
      ? await cleanupProductImages(
          committed.map((doc) => ({ productId: doc.id, images: doc.data().images ?? [] })),
        )
      : NO_IMAGE_CLEANUP;
  return { ...result, images };
}

/**
 * Removes every product's Special Offer: clears the four offer fields (`isOnSale`, `salePrice`,
 * `saleStartAt`, `saleEndAt`) of each product that has one. The products themselves — name, price,
 * stock, images, everything else — are kept, and orders already placed keep the price they paid (it is
 * stored on the order line). Same stale-count guard as `deleteAllProducts`.
 */
export async function removeAllOffers(
  db: FirebaseFirestore.Firestore,
  expectedCount: number,
): Promise<BulkResult> {
  const snapshot = await productsCollection().get();
  // "Has an offer" is exactly what the Special Offers page lists: a stored sale price.
  const withOffer = snapshot.docs.filter((doc) => doc.data().salePrice != null);
  if (withOffer.length !== expectedCount) {
    return { ok: false, code: "STALE_COUNT", done: 0, remaining: withOffer.length };
  }
  const { result } = await runChunked(db, withOffer, (batch, doc) =>
    batch.update(doc.ref, {
      isOnSale: false,
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );
  return result;
}
