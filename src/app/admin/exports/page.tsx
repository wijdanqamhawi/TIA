import { categoriesCollection } from "@/lib/firebase/firestore";
import { ExportsManager } from "@/components/admin/ExportsManager";

export const dynamic = "force-dynamic";

/** `/admin/exports` (T303, spec FR-099). Admin-only via `admin/layout.tsx`'s guard; every actual download additionally re-verifies admin via its own Route Handler (T306). */
export default async function AdminExportsPage() {
  const categoriesSnapshot = await categoriesCollection().orderBy("displayOrder", "asc").get();
  const categories = categoriesSnapshot.docs.map((doc) => ({ id: doc.id, nameEn: doc.data().name.en }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Exports</h1>
        <p className="mt-1 text-sm text-text-primary/70">
          Download a real, up-to-the-moment `.xlsx` report generated directly from live store data.
          There is no import path back into TIA — editing a downloaded file has no effect on the
          store.
        </p>
      </div>
      <ExportsManager categories={categories} />
    </div>
  );
}
