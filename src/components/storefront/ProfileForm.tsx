"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarDays, Mail, PhoneCall, User } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { updateProfileAction } from "@/actions/account.actions";
import styles from "@/app/[locale]/(storefront)/account/account.module.css";

/** ISO `YYYY-MM-DD` → `DD/MM/YYYY` for display. */
function isoToDisplay(iso: string | null): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** `DD/MM/YYYY` → ISO `YYYY-MM-DD`; `null` when empty, `undefined` when malformed. */
function displayToIso(display: string): string | null | undefined {
  const value = display.trim();
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

/** Keeps digits only and inserts the slashes as the customer types. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

/**
 * The account profile edit form (T135, spec User Story 2), laid out as the
 * approved compact reference: Full Name + Email Address on the left, Mobile
 * Phone Number + optional Date of Birth on the right, then Save Changes and
 * the page-supplied Logout control.
 *
 * `email` is displayed read-only (Firebase-Auth-owned, never editable
 * here). The saved delivery address is not edited on this page, so it is
 * never sent — `updateProfileAction` leaves an omitted field untouched.
 */
export function ProfileForm({
  email,
  initialName,
  initialPhone,
  initialDateOfBirth,
  actionsEnd,
}: {
  email: string;
  initialName: string;
  initialPhone: string;
  initialDateOfBirth: string | null;
  /** Rendered at the end of the actions row (the Logout control). */
  actionsEnd?: ReactNode;
}) {
  const t = useTranslations("Account");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [dateOfBirth, setDateOfBirth] = useState(isoToDisplay(initialDateOfBirth));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const isoDateOfBirth = displayToIso(dateOfBirth);
    if (isoDateOfBirth === undefined) {
      setError(t("errors.dobInvalid"));
      return;
    }

    startTransition(async () => {
      const result = await updateProfileAction({
        name,
        phone: phone || null,
        dateOfBirth: isoDateOfBirth,
      });

      if (!result.ok) {
        const field = Object.keys(result.error.fieldErrors ?? {})[0];
        const key =
          field === "name"
            ? "nameRequired"
            : field === "phone"
              ? "phoneInvalid"
              : field === "dateOfBirth"
                ? "dobInvalid"
                : "generic";
        setError(t(`errors.${key}` as "errors.generic"));
        return;
      }

      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>{t("nameLabel")}</span>
          <span className={styles.control}>
            <User className={styles.controlIcon} aria-hidden="true" />
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              required
              autoComplete="name"
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("phoneLabel")}</span>
          <span className={styles.control}>
            <PhoneCall className={styles.controlIcon} aria-hidden="true" />
            <input
              className={styles.input}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
              placeholder={t("phonePlaceholder")}
              autoComplete="tel"
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("emailAddressLabel")}</span>
          <span className={styles.control}>
            <Mail className={styles.controlIcon} aria-hidden="true" />
            <input className={styles.input} type="email" value={email} disabled readOnly dir="ltr" />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            {t("dobLabel")} <span className={styles.labelOptional}>{t("dobOptional")}</span>
          </span>
          <span className={styles.control}>
            <CalendarDays className={styles.controlIcon} aria-hidden="true" />
            <input
              className={styles.input}
              inputMode="numeric"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(maskDate(e.target.value))}
              disabled={isPending}
              placeholder={t("dobPlaceholder")}
              autoComplete="bday"
              maxLength={10}
              // Digits stay left-to-right once typed; while empty, the
              // placeholder follows the page direction so it reads correctly.
              dir={dateOfBirth ? "ltr" : undefined}
            />
          </span>
        </label>
      </div>

      {error || success ? (
        <div className={styles.feedback}>
          <FormError message={error} />
          {success && !error ? (
            <p role="status" className={styles.success}>
              {t("saveSuccess")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={isPending} className={styles.save}>
          {isPending ? t("saving") : t("saveButton")}
        </button>
        {actionsEnd}
      </div>
    </form>
  );
}
