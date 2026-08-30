"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { ProductImage } from "@/types/product";

/** Product-detail image gallery (spec FR-050c): stacked on mobile/tablet, multi-column on desktop. */
export function ImageGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return <div className="aspect-square w-full rounded-lg bg-brand-beige" />;
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-brand-beige">
        <Image
          src={active.url}
          alt={active.alt || name}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto lg:w-24 lg:flex-col lg:overflow-y-auto">
          {images.map((image, index) => (
            <button
              key={image.storagePath || image.url + index}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${name} ${index + 1}`}
              aria-current={index === activeIndex}
              className={cn(
                "relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border-2 lg:w-full",
                index === activeIndex ? "border-brand-burgundy" : "border-transparent",
              )}
            >
              <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
