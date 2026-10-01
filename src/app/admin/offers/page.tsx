import { Timestamp } from "firebase-admin/firestore";
import { getAllProductsForAdmin } from "@/lib/domain/catalog/product.service";
import { buildOfferData } from "@/lib/domain/admin/offer-list";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { AdminOffersManager } from "@/components/admin/AdminOffersManager";

// Offer status is derived from the current time on every request — never cached.
export const dynamic = "force-dynamic";

/**
 * Admin — Special Offers (spec FR-113–FR-116): every product with an offer,
 * Active / Scheduled / Expired, read from the existing product fields
 * (`isOnSale`, `salePrice`, `saleStartAt`, `saleEndAt`). There is no offers
 * collection; saving goes through the same `updateProductAction` the product
 * form uses.
 */
export default async function AdminOffersPage() {
  const [products, { locale }] = await Promise.all([
    getAllProductsForAdmin(),
    getAdminTranslator("AdminOffers"),
  ]);
  const { offers, choices } = buildOfferData(products, Timestamp.now(), locale);

  return <AdminOffersManager offers={offers} choices={choices} />;
}
