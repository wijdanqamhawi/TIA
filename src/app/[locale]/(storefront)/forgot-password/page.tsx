"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clientAuth } from "@/lib/firebase/client";
import { requestPasswordReset } from "@/lib/firebase/password-reset";
import { readRememberedEmail } from "@/lib/auth/remembered-email";
import { emailSchema } from "@/lib/validation/auth.schema";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  // Same convenience as the login form; read after mount so SSR and hydration match.
  useEffect(() => {
    const remembered = readRememberedEmail();
    if (remembered) setEmail((current) => current || remembered);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(t("errors.invalidEmail"));
      return;
    }

    setStatus("sending");
    const outcome = await requestPasswordReset(clientAuth, parsed.data, locale);
    if (!outcome.ok) {
      setError(t(`errors.${outcome.errorKey}`));
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  const isBusy = status === "sending";

  return (
    <main className="container-luxury flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-md shadow-elev-2">
        <CardHeader>
          <h1 className="text-center font-display text-3xl text-text-primary">{t("forgotTitle")}</h1>
          <hr className="rule-gold mx-auto mt-4" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          {status === "sent" ? (
            <p role="status" data-testid="reset-sent" className="text-center text-sm leading-relaxed text-text-primary/80">
              {t("resetSent")}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-text-primary/70">{t("forgotIntro")}</p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium tracking-wide text-text-primary/80">
                  {t("emailLabel")}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isBusy}
                  aria-describedby={error ? "forgot-error" : undefined}
                />
              </div>

              <FormError message={error} id="forgot-error" />

              <Button type="submit" disabled={isBusy} className="mt-2 w-full">
                {isBusy ? t("sendingResetLink") : t("sendResetLink")}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm">
            <Link
              href="/login"
              className="font-medium text-brand-burgundy underline-offset-4 transition-colors hover:text-brand-burgundy-light hover:underline"
            >
              {t("backToLogin")}
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
