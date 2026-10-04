import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { REMEMBERED_EMAIL_STORAGE_KEY } from "@/lib/auth/remembered-email";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInMock = vi.fn();
const createSessionMock = vi.fn();
const sendResetMock = vi.fn();

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  Link: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/firebase/client", () => ({ clientAuth: { languageCode: null } }));
vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...a: unknown[]) => signInMock(...a),
  sendPasswordResetEmail: (...a: unknown[]) => sendResetMock(...a),
}));
vi.mock("@/actions/auth.actions", () => ({ createSessionAction: (...a: unknown[]) => createSessionMock(...a) }));

const { default: LoginPage } = await import("@/app/[locale]/(storefront)/login/page");
const { default: ForgotPasswordPage } = await import("@/app/[locale]/(storefront)/forgot-password/page");

type Locale = "en" | "ar";

function renderPage(Page: () => React.JSX.Element, locale: Locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={(locale === "ar" ? ar : en) as never}>
      <Page />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  signInMock.mockResolvedValue({ user: { getIdToken: async () => "id-token" } });
});
afterEach(cleanup);

describe("login: remember customer email", () => {
  it("prefills the remembered email, never a password", async () => {
    window.localStorage.setItem(REMEMBERED_EMAIL_STORAGE_KEY, "customer@example.com");
    renderPage(LoginPage);
    await waitFor(() =>
      expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("customer@example.com"),
    );
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });

  it("does not overwrite what the visitor already typed", () => {
    window.localStorage.setItem(REMEMBERED_EMAIL_STORAGE_KEY, "customer@example.com");
    renderPage(LoginPage);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "typed@example.com" } });
    expect(input.value).toBe("typed@example.com");
  });

  async function submit(role: string) {
    createSessionMock.mockResolvedValue({ ok: true, data: { uid: "u1", role } });
    renderPage(LoginPage);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Customer@Example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "supersecret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalled());
  }

  it("remembers only the email after a successful customer sign-in", async () => {
    await submit("CUSTOMER");
    await waitFor(() =>
      expect(window.localStorage.getItem(REMEMBERED_EMAIL_STORAGE_KEY)).toBe("Customer@Example.com"),
    );
    // Nothing else, in particular no password or token, is written anywhere.
    expect(window.localStorage.length).toBe(1);
    const everything = JSON.stringify({ ...window.localStorage, ...window.sessionStorage });
    expect(everything).not.toContain("supersecret123");
    expect(everything).not.toContain("id-token");
    expect(window.sessionStorage.length).toBe(0);
  });

  it.each(["ADMIN", "OWNER"])("does not remember an email signed in as %s", async (role) => {
    await submit(role);
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(window.localStorage.getItem(REMEMBERED_EMAIL_STORAGE_KEY)).toBeNull();
  });

  it("does not remember an email when sign-in fails", async () => {
    signInMock.mockRejectedValue(Object.assign(new Error("x"), { code: "auth/invalid-credential" }));
    renderPage(LoginPage);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    await screen.findByRole("alert");
    expect(window.localStorage.getItem(REMEMBERED_EMAIL_STORAGE_KEY)).toBeNull();
  });
});

describe("login: forgot password link", () => {
  it("links to the forgot-password page in English and Arabic", () => {
    renderPage(LoginPage, "en");
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
    cleanup();
    renderPage(LoginPage, "ar");
    expect(screen.getByRole("link", { name: ar.Auth.forgotPassword }).getAttribute("href")).toBe("/forgot-password");
  });
});

describe("forgot-password page", () => {
  function request(email: string, locale: Locale = "en") {
    const t = locale === "ar" ? ar.Auth : en.Auth;
    renderPage(ForgotPasswordPage, locale);
    fireEvent.change(screen.getByLabelText(t.emailLabel), { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: t.sendResetLink }));
  }

  it.each(["en", "ar"] as const)(
    "shows the same neutral success for a registered and an unknown email (%s)",
    async (locale) => {
      const message = (locale === "ar" ? ar : en).Auth.resetSent;

      sendResetMock.mockResolvedValueOnce(undefined);
      request("registered@example.com", locale);
      expect((await screen.findByTestId("reset-sent")).textContent).toBe(message);
      cleanup();

      sendResetMock.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/user-not-found" }));
      request("nobody@example.com", locale);
      expect((await screen.findByTestId("reset-sent")).textContent).toBe(message);
    },
  );

  it("shows an error for an invalid email without calling Firebase", async () => {
    request("not-an-email");
    expect((await screen.findByRole("alert")).textContent).toBe(en.Auth.errors.invalidEmail);
    expect(sendResetMock).not.toHaveBeenCalled();
  });

  it("shows rate-limit failures and does not claim success", async () => {
    sendResetMock.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/too-many-requests" }));
    request("a@b.co");
    expect((await screen.findByRole("alert")).textContent).toBe(en.Auth.errors.tooManyRequests);
    expect(screen.queryByTestId("reset-sent")).toBeNull();
  });

  it("requests the email in the page's language and offers a way back to sign in", async () => {
    sendResetMock.mockResolvedValueOnce(undefined);
    request("a@b.co", "ar");
    await screen.findByTestId("reset-sent");
    expect(sendResetMock.mock.calls[0][0]).toMatchObject({ languageCode: "ar" });
    expect(screen.getByRole("link", { name: ar.Auth.backToLogin }).getAttribute("href")).toBe("/login");
  });
});

describe("translations", () => {
  const keys = [
    "forgotPassword",
    "forgotTitle",
    "forgotIntro",
    "sendResetLink",
    "sendingResetLink",
    "resetSent",
    "backToLogin",
  ] as const;

  it.each(keys)("Auth.%s exists in English and Arabic", (key) => {
    expect(en.Auth[key]).toBeTruthy();
    expect(ar.Auth[key]).toBeTruthy();
    expect(ar.Auth[key]).not.toBe(en.Auth[key]);
  });
});
