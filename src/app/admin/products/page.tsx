import Link from "next/link";
import { Timestamp } from "firebase-admin/firestore";
import { Box, Package, Plus, Tag, TriangleAlert } from "lucide-react";
import { getAllProductsForAdmin } from "@/lib/domain/catalog/product.service";
import { getAllCategories } from "@/lib/domain/catalog/category.service";
import { getOfferStatus } from "@/lib/domain/catalog/offer";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { StatCard } from "@/components/admin/StatCard";
import { BulkActionButton } from "@/components/admin/BulkActionButton";
import { AdminProductsTable, type AdminProductRow } from "@/components/admin/AdminProductsTable";

// Every /admin/* route makes a per-request decision from live Firestore
// data; it must never be statically prerendered/cached (mirrors T068/T070).
export const dynamic = "force-dynamic";

/** Admin — Products (T150): the full product management list, with search and filters. */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [products, categories, { t, locale }] = await Promise.all([
    getAllProductsForAdmin(),
    getAllCategories(),
    getAdminTranslator("AdminProducts"),
  ]);
  const localized = (name: { en: string; ar: string | null }) =>
    locale === "ar" ? name.ar || name.en : name.en;
  const categoryNames = new Map(categories.map((c) => [c.id, localized(c.name)]));
  const now = Timestamp.now();

  const rows: AdminProductRow[] = products.map((product) => ({
    id: product.id,
    name: localized(product.name),
    nameEn: product.name.en,
    nameAr: product.name.ar,
    slug: product.slug,
    imageUrl: [...product.images].sort((a, b) => a.position - b.position)[0]?.url ?? null,
    categoryId: product.categoryId,
    categoryName: categoryNames.get(product.categoryId) ?? t("uncategorized"),
    price: product.price,
    salePrice: product.salePrice ?? null,
    stock: product.stock,
    isSoldOut: isSoldOut(product),
    availability: product.availability,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    offerStatus: getOfferStatus(product, now),
  }));

  const soldOutCount = rows.filter((row) => row.isSoldOut).length;
  const stats = [
    { key: "total", value: rows.length, icon: Box },
    { key: "inStock", value: rows.length - soldOutCount, icon: Package },
    { key: "soldOut", value: soldOutCount, icon: TriangleAlert },
    { key: "offers", value: rows.filter((row) => row.offerStatus === "ACTIVE").length, icon: Tag },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-1">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] font-normal leading-[1.1] text-brand-burgundy lg:text-[38px] rtl:text-[28px] rtl:leading-[1.4] rtl:lg:text-[32px]">
            {t("title")}
          </h1>
          <p className="mt-1.5 font-display text-[15px] leading-snug text-text-secondary lg:text-[16px] rtl:font-body rtl:text-[14.5px]">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <BulkActionButton kind="products" count={rows.length} />
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-burgundy px-5 text-[14.5px] font-medium text-text-on-dark shadow-[0_8px_20px_-12px_rgba(16,28,54,0.6)] transition-colors hover:bg-brand-burgundy-light"
          >
            <Plus aria-hidden="true" className="size-[17px] stroke-[2]" />
            {t("newProduct")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-[13px] xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={t(`stats.${stat.key}`)}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <AdminProductsTable
        products={rows}
        categories={categories.map((category) => ({
          id: category.id,
          name: localized(category.name),
        }))}
        initialQuery={q ?? ""}
      />
    </div>
  );
}
