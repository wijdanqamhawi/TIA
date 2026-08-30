import { getActiveCategories } from "@/lib/domain/catalog/category.service";
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
  const categories = await getActiveCategories();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">New Product</h1>
        <p className="mt-1 text-sm text-text-primary/70">
          Create the product first, then add images on the next screen.
        </p>
      </div>
      <ProductForm mode="create" initial={EMPTY_PRODUCT} categories={categories.map((c) => ({ id: c.id, nameEn: c.name.en }))} />
    </div>
  );
}
