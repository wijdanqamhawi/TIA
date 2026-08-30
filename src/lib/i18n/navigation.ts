import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link/useRouter/redirect — always keep the current locale prefix. */
export const { Link, useRouter, usePathname, redirect } = createNavigation(routing);
