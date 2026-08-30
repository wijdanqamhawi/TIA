import type { Timestamp } from "firebase-admin/firestore";
import type { LocalizedString } from "./localizedString";

/**
 * `categories/{categoryId}` (data-model.md). Initial set: Bracelets,
 * Rings, Earrings, Watches — extensible with no code change, since every
 * catalog query parameterizes on `categoryId` rather than hardcoding the
 * category list (spec FR-046a).
 */
export type Category = {
  id: string; // mirrors `categoryId`
  name: LocalizedString;
  slug: string; // language-independent, derived from name.en
  description: LocalizedString | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
