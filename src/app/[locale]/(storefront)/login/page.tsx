"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { createSessionAction } from "@/actions/auth.actions";
import { mapAuthErrorToKey } from "@/lib/firebase/auth-error";
import { loginSchema } from "@/lib/validation/auth.schema";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const intent = searchParams.get("intent") ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "signing-in" | "redirecting">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(t(`errors.${parsed.error.issues[0]?.path[0] === "email" ? "invalidEmail" : "invalidCredentials"}`));
      return;
    }

    setStatus("signing-in");
    try {
      const credential = await signInWithEmailAndPassword(clientAuth, parsed.data.email, parsed.data.password);
      const idToken = await credential.user.getIdToken();
      const result = await createSessionAction({ idToken, intent });

      if (!result.ok) {
        setError(result.error.code === "RATE_LIMITED" ? result.error.message : t("errors.generic"));
        setStatus("idle");
        return;
      }

      setStatus("redirecting");
      if (next.startsWith("/admin")) {
        // The Admin Dashboard is deliberately outside the `[locale]`
        // segment (research.md §32, English-only chrome) — the i18n-aware
        // router below always prefixes a path with the current locale,
        // which would send an admin to the non-existent `/en/admin`. A
        // full navigation both avoids that prefix and forces a fresh
        // server render, so `requireAdmin()` re-evaluates the just-created
        // session cookie immediately.
        window.location.href = next;
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(t(`errors.${mapAuthErrorToKey(err)}`));
      setStatus("idle");
    }
  }

  const isBusy = status !== "idle";

  return (
    <main className="container-luxury flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="font-display text-2xl text-text-primary">{t("loginTitle")}</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-text-primary">
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
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text-primary">
                {t("passwordLabel")}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
              />
            </div>

            <FormError message={error} id="login-error" />

            <Button type="submit" disabled={isBusy} className="mt-2 w-full">
              {status === "signing-in" ? t("signingIn") : status === "redirecting" ? t("redirecting") : t("loginButton")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-primary/70">
            {t("noAccount")}{" "}
            <Link
              href={{
                pathname: "/register",
                query:
                  next !== "/" || intent
                    ? { ...(next !== "/" ? { next } : {}), ...(intent ? { intent } : {}) }
                    : undefined,
              }}
              className="font-medium text-brand-burgundy hover:underline"
            >
              {t("registerCta")}
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
