import { categoriesCollection } from "@/lib/firebase/firestore";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { ExportsManager } from "@/components/admin/ExportsManager";

export const dynamic = "force-dynamic";

/** `/admin/exports` (T303, spec FR-099). Admin-only via `admin/layout.tsx`'s guard; every actual download additionally re-verifies admin via its own Route Handler (T306). */
export default async function AdminExportsPage() {
  const [categoriesSnapshot, { t }] = await Promise.all([
    categoriesCollection().orderBy("displayOrder", "asc").get(),
    getAdminTranslator("AdminExports"),
  ]);
  const categories = categoriesSnapshot.docs.map((doc) => ({
    id: doc.id,
    nameEn: doc.data().name.en,
    nameAr: doc.data().name.ar ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <h1 className="font-display text-[32px] font-normal leading-[1.1] text-brand-burgundy lg:text-[38px] rtl:text-[28px] rtl:leading-[1.4] rtl:lg:text-[32px]">
          {t("title")}
        </h1>
        <p className="mt-1.5 font-display text-[15px] leading-snug text-text-secondary lg:text-[16px] rtl:font-body rtl:text-[14.5px]">
          {t("subtitle")}
        </p>
      </div>
      <ExportsManager categories={categories} />
    </div>
  );
}
