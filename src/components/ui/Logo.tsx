import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  locale?: string;
  className?: string;
  /** Sizing classes for the `<Image>` itself (e.g. `w-40 h-auto`) — `className` alone only affects the wrapping `<Link>`'s layout (e.g. `shrink-0`), not the image's rendered size, since `next/image` needs the size override on the `<img>` element. Optional; existing callers that only need Link-level layout tweaks are unaffected. */
  imageClassName?: string;
  priority?: boolean;
};

/**
 * Renders the single official ELORA JEWELLERY logo asset as-is.
 * Never mirrored under RTL, never regenerated, never substituted
 * (Constitution Principle 2, research.md §33).
 *
 * NOTE: `public/brand/logo.svg` currently holds a temporary placeholder
 * wordmark. Replace that file with the real official logo asset — this
 * component and every consumer require no code change when that happens.
 */
export function Logo({ locale, className, imageClassName, priority }: LogoProps) {
  const href = locale ? `/${locale}` : "/";

  return (
    <Link href={href} className={className} aria-label="ELORA JEWELLERY — Home">
      <Image
        src="/brand/logo.svg"
        alt="ELORA JEWELLERY"
        width={160}
        height={40}
        priority={priority}
        className={imageClassName}
        style={{ transform: "none" }}
      />
    </Link>
  );
}
