import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Category } from "@/types/category";
import type { CategoryShowcase as CategoryShowcaseData } from "@/types/categoryShowcase";

/**
 * A large, full-width editorial homepage banner for one core category
 * (spec FR-001a, research.md §38): desktop/mobile imagery, bilingual
 * title/subtitle, and a bilingual CTA linking to that category's
 * dedicated page. Falls back to a responsively-cropped `desktopImage`
 * when no distinct `mobileImage` has been uploaded yet (data-model.md).
 */
export function CategoryShowcase({
  showcase,
  category,
  locale,
}: {
  showcase: CategoryShowcaseData;
  category: Category | null;
  locale: string;
}) {
  const title = resolveLocalizedString(showcase.title, locale);
  const subtitle = showcase.subtitle ? resolveLocalizedString(showcase.subtitle, locale) : null;
  const cta = resolveLocalizedString(showcase.cta, locale);
  const href = category ? `/shop/category/${category.slug}` : "/shop";

  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/7]">
        <Image
          src={showcase.desktopImage.url}
          alt={title}
          fill
          sizes="100vw"
          className="hidden object-cover sm:block"
          priority={showcase.displayOrder === 1}
        />
        <Image
          src={showcase.mobileImage?.url ?? showcase.desktopImage.url}
          alt={title}
          fill
          sizes="100vw"
          className="object-cover sm:hidden"
          priority={showcase.displayOrder === 1}
        />
        <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-text-on-dark">
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl">{title}</h2>
        {subtitle ? <p className="max-w-md text-sm sm:text-base">{subtitle}</p> : null}
        <Link
          href={href}
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-gold px-6 py-2.5 text-sm font-semibold text-brand-burgundy-dark hover:bg-brand-gold-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cream"
        >
          {cta}
        </Link>
      </div>
    </section>
  );
}
