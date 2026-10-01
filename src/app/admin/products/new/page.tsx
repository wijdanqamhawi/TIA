import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import { ProductForm, type ProductFormInitial } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

const EMPTY_PRODUCT: ProductFormInitial = {
  name: { en: "", ar: null },
  description: { en: "", ar: null },
  material: { en: "", ar: null },
  price: 0,
  categoryId: "",
  options: [],
  stock: 0,
  availability: true,
  isNewArrival: false,
  isBestSeller: false,
  isOnSale: false,
  salePrice: null,
  saleStartAt: null,
  saleEndAt: null,
  images: [],
};

/** Admin — New Product (T151). Images are added after creation on the edit page (T148/T149). */
export default async function NewProductPage() {
  const [categories, { t }] = await Promise.all([
    getActiveCategories(),
    getAdminTranslator("AdminProductForm"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/admin/products"
          className="inline-flex min-h-8 items-center gap-2 text-[14px] text-brand-burgundy/85 transition-colors hover:text-brand-burgundy"
        >
          <DirectionalIcon icon={ArrowLeft} aria-hidden="true" className="size-4 stroke-[1.7]" />
          {t("back")}
        </Link>
        <h1 className="mt-1 font-display text-[34px] font-normal leading-[1.1] text-brand-burgundy lg:text-[38px] rtl:text-[28px] rtl:leading-[1.4] rtl:lg:text-[32px]">
          {t("newTitle")}
        </h1>
        <p className="mt-1.5 font-display text-[15px] leading-snug text-text-secondary rtl:font-body rtl:text-[14.5px]">
          {t("newSubtitle")}
        </p>
      </div>
      <ProductForm
        mode="create"
        initial={EMPTY_PRODUCT}
        categories={categories.map((c) => ({ id: c.id, nameEn: c.name.en }))}
      />
    </div>
  );
}
