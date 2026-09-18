import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Category } from "@/types/category";
import type { CategoryShowcase as CategoryShowcaseData } from "@/types/categoryShowcase";
import { resolveCollectionImage } from "@/lib/config/demoImages";

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
  variant = "banner",
}: {
  showcase: CategoryShowcaseData;
  category: Category | null;
  locale: string;
  /**
   * `banner` — the full-width editorial banner. `tile` — a portrait tile
   * for the homepage's "Shop by Category" grid. Same showcase data (title,
   * subtitle, CTA, imagery) and the same destination in both.
   */
  variant?: "banner" | "tile";
}) {
  const title = resolveLocalizedString(showcase.title, locale);
  const subtitle = showcase.subtitle ? resolveLocalizedString(showcase.subtitle, locale) : null;
  const cta = resolveLocalizedString(showcase.cta, locale);
  const href = category ? `/shop/category/${category.slug}` : "/shop";
  // Real uploaded showcase artwork always wins; the demo image stands in
  // only while the showcase still points at the brand placeholder.
  const desktop = resolveCollectionImage(showcase.desktopImage.url, category?.slug ?? "");
  const mobile = resolveCollectionImage(
    showcase.mobileImage?.url ?? showcase.desktopImage.url,
    category?.slug ?? "",
  );

  if (variant === "tile") {
    return (
      <article className="group relative isolate overflow-hidden">
        <div className="relative aspect-[3/4] w-full">
          <Image
            src={mobile.url}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover object-center transition-transform duration-700 ease-luxury group-hover:scale-105"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-brand-espresso/75 via-brand-espresso/10 to-transparent"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-4 text-text-on-dark sm:p-6">
          <h3 className="font-display text-2xl font-light sm:text-3xl">{title}</h3>
          {subtitle ? <p className="hidden max-w-xs text-xs leading-relaxed text-text-on-dark/80 sm:block">{subtitle}</p> : null}
          <Link
            href={href}
            className="mt-1 inline-flex min-h-11 items-center border-b border-text-on-dark/70 text-[0.625rem] font-medium uppercase tracking-[0.22em] text-text-on-dark transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-on-dark rtl:text-xs rtl:normal-case rtl:tracking-normal"
          >
            {cta}
          </Link>
        </div>
      </article>
    );
  }

  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/6]">
        <Image
          src={desktop.url}
          alt={title}
          fill
          sizes="100vw"
          className="hidden object-cover object-center sm:block"
          priority={showcase.displayOrder === 1}
        />
        <Image
          src={mobile.url}
          alt={title}
          fill
          sizes="100vw"
          className="object-cover object-center sm:hidden"
          priority={showcase.displayOrder === 1}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-brand-burgundy-dark/65 via-brand-burgundy-dark/20 to-brand-burgundy-dark/35"
        />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-text-on-dark">
        <h2 className="max-w-2xl font-display text-4xl font-light drop-shadow-sm sm:text-5xl md:text-6xl">{title}</h2>
        
        {subtitle ? (
          <p className="max-w-md text-sm leading-relaxed text-text-on-dark/85 sm:text-base">
            {subtitle}
          </p>
        ) : null}
        <Link
          href={href}
          className="mt-4 inline-flex min-h-12 items-center justify-center border border-text-on-dark/70 px-10 py-3 text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-text-on-dark transition-colors duration-300 hover:bg-text-on-dark hover:text-brand-burgundy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-on-dark rtl:text-xs rtl:normal-case rtl:tracking-normal"
        >
          {cta}
        </Link>
      </div>
    </section>
  );
}
