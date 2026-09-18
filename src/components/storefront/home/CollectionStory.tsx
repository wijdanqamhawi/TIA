import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { DEMO_EDITORIAL } from "@/lib/config/demoImages";
import { cn } from "@/lib/utils/cn";
import { ARROW_ICON, ARROW_LINK, KICKER } from "./editorial";

/**
 * "THE COLLECTION" — brand story split: a large lifestyle photograph, a
 * quiet text panel, and a jewellery detail frame. Mirrors under RTL
 * because the grid follows the document direction.
 *
 * Warm white, not pearl: the two pearl bands above it ("Shop the Look" and
 * "Less Ordinary") already read as one continuous block, and a third would
 * turn the middle of the page into an undifferentiated grey run.
 */
export async function CollectionStory({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section className="bg-brand-ivory text-text-primary">
      <div className="grid sm:grid-cols-2 lg:min-h-[24rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.85fr)]">
        <div className="relative aspect-[4/3] sm:col-span-2 lg:col-span-1 lg:aspect-auto">
          <Image
            src={DEMO_EDITORIAL.storyModel}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover object-[center_40%]"
          />
        </div>

        <div className="flex flex-col items-start justify-center gap-5 px-4 py-12 sm:px-10 lg:px-12">
          <p className={cn(KICKER, "text-text-primary/80")}>{t("storyEyebrow")}</p>
          <h2 className="max-w-[14ch] font-display text-3xl font-light leading-[1.12] sm:text-4xl lg:text-[2.5rem]">
            {t("storyTitle")}
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-text-primary/80">{t("storyBody")}</p>
          <Link href="/about" className={cn(ARROW_LINK, "text-text-primary")}>
            {t("storyCta")}
            <ArrowRight aria-hidden="true" size={12} className={ARROW_ICON} />
          </Link>
        </div>

        <div className="relative hidden aspect-square sm:block lg:aspect-auto">
          <Image
            src={DEMO_EDITORIAL.storyDetail}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 1024px) 50vw, 30vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
