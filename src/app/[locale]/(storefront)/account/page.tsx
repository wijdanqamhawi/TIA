import { EB_Garamond } from "next/font/google";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FileText, Heart, User } from "lucide-react";
import { getSessionClaims } from "@/lib/firebase/guards";
import { usersCollection } from "@/lib/firebase/firestore";
import { Link } from "@/lib/i18n/navigation";
import { ProfileForm } from "@/components/storefront/ProfileForm";
import { AccountSignOutButton } from "@/components/storefront/AccountSignOutButton";
import styles from "./account.module.css";

// Reads the caller's live profile on every request; `AccountLayout`
// already guards this route (Constitution Principle 7/9).
export const dynamic = "force-dynamic";

/**
 * The reference's headline serif (the same old-style Garamond the About
 * page uses). Loaded for this page only; Arabic keeps the site's Arabic
 * display face.
 */
const accountSerif = EB_Garamond({
  variable: "--font-account-serif",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

/**
 * The `/[locale]/account` page (T135, spec User Story 2), built to the
 * approved compact reference: the heading, the three account tabs (real
 * routes), the Profile Information card with Save Changes + Logout, and
 * the support line. Any signed-in user reaches it — CUSTOMER, ADMIN or
 * OWNER alike; staff roles are additive and never restrict storefront use.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });

  const claims = await getSessionClaims();
  // Layout and page render in parallel (Next.js 15), so the page cannot
  // rely on `AccountLayout`'s redirect having already run: guard here too.
  if (!claims) redirect(`/${locale}/login?next=/${locale}/account`);
  const userDoc = await usersCollection().doc(claims.uid).get();
  const user = userDoc.data()!;

  return (
    <main className={`${styles.page} ${accountSerif.variable}`}>
      <div className={styles.inner}>
        <header className={styles.heading}>
          <h1 className={styles.title}>{t("title")}</h1>
          <span className={styles.titleRule} aria-hidden="true" />
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </header>

        <nav className={styles.tabs} aria-label={t("tabsLabel")}>
          <Link href="/account" aria-current="page" className={`${styles.tab} ${styles.tabActive}`}>
            <User className={styles.tabIcon} aria-hidden="true" />
            <span className={styles.tabText}>
              <span className={styles.tabTitle}>{t("profileTab")}</span>
              <span className={styles.tabHint}>{t("profileTabHint")}</span>
            </span>
          </Link>
          <span className={styles.tabGap} aria-hidden="true" />
          <Link href="/account/orders" className={styles.tab}>
            <FileText className={styles.tabIcon} aria-hidden="true" />
            <span className={styles.tabText}>
              <span className={styles.tabTitle}>{t("viewOrders")}</span>
              <span className={styles.tabHint}>{t("ordersTabHint")}</span>
            </span>
          </Link>
          <span className={styles.tabGap} aria-hidden="true" />
          <Link href="/wishlist" className={styles.tab}>
            <Heart className={styles.tabIcon} aria-hidden="true" />
            <span className={styles.tabText}>
              <span className={styles.tabTitle}>{t("viewWishlist")}</span>
              <span className={styles.tabHint}>{t("wishlistTabHint")}</span>
            </span>
          </Link>
        </nav>

        <section className={styles.card} aria-labelledby="profile-card-title">
          <div className={styles.cardHead}>
            <span className={styles.cardIcon} aria-hidden="true">
              <User />
            </span>
            <div>
              <h2 id="profile-card-title" className={styles.cardTitle}>
                {t("profileCardTitle")}
              </h2>
              <p className={styles.cardHint}>{t("profileCardHint")}</p>
            </div>
          </div>

          <ProfileForm
            email={user.email}
            initialName={user.name}
            initialPhone={user.phone ?? ""}
            initialDateOfBirth={user.profile.dateOfBirth ?? null}
            actionsEnd={<AccountSignOutButton className={styles.logout} />}
          />
        </section>

        <p className={styles.support}>
          {t("supportPrompt")}{" "}
          <Link href="/contact" className={styles.supportLink}>
            {t("supportLink")}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
