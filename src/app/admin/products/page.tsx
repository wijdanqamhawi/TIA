import Link from "next/link";
import { Timestamp } from "firebase-admin/firestore";
import { getAllProductsForAdmin } from "@/lib/domain/catalog/product.service";
import { getAllCategories } from "@/lib/domain/catalog/category.service";
import { getOfferStatus } from "@/lib/domain/catalog/offer";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { AdminProductsTable, type AdminProductRow } from "@/components/admin/AdminProductsTable";

// Every /admin/* route makes a per-request decision from live Firestore
// data; it must never be statically prerendered/cached (mirrors T068/T070).
export const dynamic = "force-dynamic";

/** Admin — Products (T150): the full product management list, with a name search. */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [products, categories] = await Promise.all([getAllProductsForAdmin(), getAllCategories()]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name.en]));
  const now = Timestamp.now();

  const query = q?.trim().toLowerCase() ?? "";
  const filtered = query
    ? products.filter((product) => product.name.en.toLowerCase().includes(query) || product.name.ar?.toLowerCase().includes(query))
    : products;

  const rows: AdminProductRow[] = filtered.map((product) => ({
    id: product.id,
    nameEn: product.name.en,
    categoryNameEn: categoryNames.get(product.categoryId) ?? "—",
    price: product.price,
    stock: product.stock,
    isSoldOut: isSoldOut(product),
    availability: product.availability,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    offerStatus: getOfferStatus(product, now),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Products</h1>
          <p className="mt-1 text-sm text-text-primary/70">Manage the catalog, inventory, availability, and Special Offers.</p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand-burgundy px-4 py-2.5 font-medium text-text-on-dark transition-colors hover:bg-brand-burgundy-dark"
        >
          + New Product
        </Link>
      </div>
      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search products by name…"
          className="min-h-11 w-full max-w-sm rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
        />
        <button type="submit" className="min-h-11 rounded-md border border-border-luxury px-4 text-sm hover:bg-brand-beige">
          Search
        </button>
      </form>
      <AdminProductsTable products={rows} />
    </div>
  );
}
