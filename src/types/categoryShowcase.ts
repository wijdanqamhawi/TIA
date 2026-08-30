import type { Timestamp } from "firebase-admin/firestore";
import type { LocalizedString } from "./localizedString";

export type ShowcaseImage = {
  url: string;
  storagePath: string;
};

/**
 * `categoryShowcases/{showcaseId}` (data-model.md, spec FR-001a–FR-001f).
 * One document per core category's large homepage merchandising section.
 * The accompanying "Featured {Category}" product strip is never stored
 * here — it is always a live query (categoryShowcase.service.ts, spec
 * FR-001b), so it can never leak another category's products or go stale.
 */
export type CategoryShowcase = {
  id: string; // mirrors `showcaseId`
  categoryId: string;
  desktopImage: ShowcaseImage;
  mobileImage: ShowcaseImage | null;
  title: LocalizedString;
  subtitle: LocalizedString | null;
  cta: LocalizedString;
  displayOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
