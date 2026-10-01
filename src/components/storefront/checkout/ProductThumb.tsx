import Image from "next/image";
import { isPlaceholderUrl } from "@/lib/config/demoImages";

/**
 * A 64px rounded product thumbnail, as used in the Checkout summary and on
 * the Order Confirmed page. A missing or placeholder photo shows the TIA mark.
 */
export function ProductThumb({ src }: { src: string | null | undefined }) {
  const real = !isPlaceholderUrl(src);
  return (
    <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-brand-cream">
      {real ? (
        <Image src={src as string} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <Image
          src="/brand/logo.svg"
          alt=""
          fill
          sizes="64px"
          className="object-contain p-3 opacity-50"
        />
      )}
    </span>
  );
}
