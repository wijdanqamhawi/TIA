import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ProductCard, type ProductCardProduct } from "../ProductCard";
import { ARROW_LINK, KICKER } from "./editorial";
import { RevealOnView } from "./RevealOnView";

/** Position in the entrance sequence; each step is 100ms (globals.css). */
const revealStep = (index: number) => ({ "--reveal-i": index }) as CSSProperties;

/**
 * "BEST SELLERS" — an editorial product row on the ivory ground: a small
 * kicker and serif title on the start side, SEE ALL on the end side, and
 * up to four balanced portrait columns (2 on phones/tablets, 3 on small
 * laptops, 4 from `xl`).
 *
 * The page passes real products only (live Best Sellers first, then the
 * store's own popularity-ordered catalogue as a presentation fallback —
 * never a duplicated product). The grid is capped at the number of
 * products it has, and centred, so a short list never leaves a wide empty
 * area beside it.
 *
 * Motion (this section only): a quiet one-time entrance — kicker fades,
 * title rises, the rule draws from the start edge, cards follow on a
 * 100ms stagger — plus the cards' `motion` hover set. All of it is
 * removed under `prefers-reduced-motion`.
 *
 * Each card is the shared `ProductCard` in its `editorial` presentation, so
 * links, wishlist, offer pricing, Sold Out and Quick View behave exactly
 * as everywhere else.
 */
export async function BestSellers({
  products,
  locale,
}: {
  products: ProductCardProduct[];
  locale: string;
}) {
  const [tHome, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

  if (products.length === 0) return null;
  const columns = Math.min(products.length, 4);

  // Asymmetric padding: the row keeps its generous opening, but closes
  // tighter so the brand-statement band below reads as connected.
  return (
    <section className="bg-brand-ivory pb-10 pt-16 text-text-primary sm:pb-12 sm:pt-20 lg:pb-16 lg:pt-24">
      <RevealOnView className="container-luxury">
        <div className="flex items-end justify-between gap-6 pb-6">
          <div className="flex flex-col items-start gap-3">
            <p data-reveal="fade" style={revealStep(0)} className={cn(KICKER, "text-text-primary/80")}>
              {tHome("bestSellers")}
            </p>
            <h2 data-reveal="up" style={revealStep(1)} className="font-display text-4xl font-light leading-none sm:text-5xl">
              {tHome("bestSellers")}
            </h2>
          </div>
          <Link
            href="/shop?sort=popularity"
            data-reveal="fade"
            style={revealStep(2)}
            className={cn(ARROW_LINK, "shrink-0 text-text-primary hover:opacity-100")}
          >
            {/* Thin underline drawn from the start edge on hover. */}
            <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-luxury group-hover/arrow:bg-[length:100%_1px] group-focus-visible/arrow:bg-[length:100%_1px] motion-reduce:transition-none rtl:bg-[position:100%_100%]">
              {tCommon("seeAll")}
            </span>
            <ArrowRight
              aria-hidden="true"
              size={12}
              className="transition-transform duration-500 ease-luxury group-hover/arrow:translate-x-[5px] rtl:-scale-x-100 rtl:group-hover/arrow:-translate-x-[5px] motion-reduce:!translate-x-0"
            />
          </Link>
        </div>

        {/* The section rule, drawn horizontally from the start edge. */}
        <span aria-hidden="true" data-reveal="line" style={revealStep(2)} className="mb-10 block h-px w-full bg-hairline sm:mb-12" />

        <ul
          className={cn(
            "mx-auto grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6",
            "lg:max-w-[calc(var(--bs-cols-lg)*24rem)] lg:grid-cols-[repeat(var(--bs-cols-lg),minmax(0,1fr))] lg:gap-x-8",
            "xl:max-w-[calc(var(--bs-cols)*24rem)] xl:grid-cols-[repeat(var(--bs-cols),minmax(0,1fr))] xl:gap-x-10",
          )}
          style={{ "--bs-cols": columns, "--bs-cols-lg": Math.min(columns, 3) } as CSSProperties}
        >
          {products.map((product, index) => (
            // On small laptops (3 columns) a fourth product would sit alone
            // on a second row; it returns from `xl`, where there are 4.
            <li
              key={product.id}
              data-reveal="up"
              style={revealStep(3 + index)}
              className={index === 3 ? "lg:hidden xl:block" : undefined}
            >
              <ProductCard product={product} locale={locale} variant="editorial" motion />
            </li>
          ))}
        </ul>
      </RevealOnView>
    </section>
  );
}
