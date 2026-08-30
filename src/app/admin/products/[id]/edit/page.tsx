import { notFound } from "next/navigation";
import { getProductById } from "@/lib/domain/catalog/product.service";
import { getActiveCategories, getCategoryOrThrow } from "@/lib/domain/catalog/category.service";
import { ProductForm, type ProductFormInitial } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

/** Admin — Edit Product (T152): full field edit plus image management (T148/T149). */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, activeCategories] = await Promise.all([getProductById(id), getActiveCategories()]);

  if (!product) {
    notFound();
  }

  // `CategorySelect` (T153) only ever offers active categories — but if
  // this product currently sits in a category that's since been
  // deactivated, its own category must still appear so the form doesn't
  // silently switch it to a different one on save.
  const categories = activeCategories.some((c) => c.id === product.categoryId)
    ? activeCategories
    : [...activeCategories, await getCategoryOrThrow(product.categoryId)];

  const initial: ProductFormInitial = {
    productId: product.id,
    name: product.name,
    description: product.description,
    material: product.material,
    price: product.price,
    categoryId: product.categoryId,
    options: product.options,
    stock: product.stock,
    availability: product.availability,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    isOnSale: product.isOnSale,
    salePrice: product.salePrice,
    saleStartAt: product.saleStartAt ? product.saleStartAt.toDate().toISOString() : null,
    saleEndAt: product.saleEndAt ? product.saleEndAt.toDate().toISOString() : null,
    images: product.images,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Edit Product</h1>
        <p className="mt-1 text-sm text-text-primary/70">{product.name.en}</p>
      </div>
      <ProductForm mode="edit" initial={initial} categories={categories.map((c) => ({ id: c.id, nameEn: c.name.en }))} />
    </div>
  );
}
