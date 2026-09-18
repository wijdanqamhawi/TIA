"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { createSessionAction } from "@/actions/auth.actions";
import { mapAuthErrorToKey } from "@/lib/firebase/auth-error";
import { registerSchema } from "@/lib/validation/auth.schema";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function RegisterPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const intent = searchParams.get("intent") ?? undefined;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "redirecting">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const key =
        firstIssue?.path[0] === "email"
          ? "invalidEmail"
          : firstIssue?.path[0] === "password"
            ? "weakPassword"
            : "generic";
      setError(t(`errors.${key}`));
      return;
    }

    setStatus("creating");
    try {
      const credential = await createUserWithEmailAndPassword(clientAuth, parsed.data.email, parsed.data.password);
      await updateProfile(credential.user, { displayName: parsed.data.name });
      const idToken = await credential.user.getIdToken(true);
      const result = await createSessionAction({ idToken, intent });

      if (!result.ok) {
        setError(t("errors.generic"));
        setStatus("idle");
        return;
      }

      setStatus("redirecting");
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
      <Card className="w-full max-w-md shadow-elev-2">
        <CardHeader>
          <h1 className="text-center font-display text-3xl text-text-primary">{t("registerTitle")}</h1>
          <hr className="rule-gold mx-auto mt-4" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-medium tracking-wide text-text-primary/80">
                {t("nameLabel")}
              </label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isBusy}
              />
            </div>

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
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium tracking-wide text-text-primary/80">
                {t("passwordLabel")}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
              />
            </div>

            <FormError message={error} id="register-error" />

            <Button type="submit" disabled={isBusy} className="mt-2 w-full">
              {status === "creating" ? t("creatingAccount") : status === "redirecting" ? t("redirecting") : t("registerButton")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-primary/70">
            {t("haveAccount")}{" "}
            <Link
              href={{
                pathname: "/login",
                query:
                  next !== "/" || intent
                    ? { ...(next !== "/" ? { next } : {}), ...(intent ? { intent } : {}) }
                    : undefined,
              }}
              className="font-medium text-brand-burgundy underline-offset-4 transition-colors hover:text-brand-burgundy-light hover:underline"
            >
              {t("loginCta")}
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
