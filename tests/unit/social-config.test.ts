import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSocialConfig, buildInstagramHref, buildWhatsAppHref, type SocialConfig } from "@/lib/config/social";

/**
 * T211: `buildWhatsAppHref` selects the greeting matching the passed
 * locale (falling back to `en`) and URL-encodes it correctly; both
 * builders return `null` when unconfigured.
 *
 * The builders accept an explicit `config` argument, so most cases pass a
 * literal config rather than mutating `process.env` — `NEXT_PUBLIC_*` vars
 * are inlined at build time in real usage, and a test that reassigned them
 * would be verifying something the browser bundle never actually does. The
 * `getSocialConfig` block below still exercises the env-reading path
 * directly, since that is its whole job.
 */

function makeConfig(overrides: Partial<SocialConfig> = {}): SocialConfig {
  return {
    instagramUrl: "https://www.instagram.com/tia.jewellery/",
    whatsappPhone: "+15551234567",
    whatsappDefaultMessage: { en: "Hello ELORA!", ar: "مرحبا إيلورا!" },
    ...overrides,
  };
}

describe("buildInstagramHref", () => {
  it("returns the configured URL unmodified", () => {
    expect(buildInstagramHref(makeConfig())).toBe("https://www.instagram.com/tia.jewellery/");
  });

  it("returns null when unconfigured", () => {
    expect(buildInstagramHref(makeConfig({ instagramUrl: null }))).toBeNull();
  });
});

describe("buildWhatsAppHref", () => {
  it("returns null when no phone is configured", () => {
    expect(buildWhatsAppHref("en", undefined, makeConfig({ whatsappPhone: null }))).toBeNull();
  });

  it("returns null when the configured phone contains no digits", () => {
    expect(buildWhatsAppHref("en", undefined, makeConfig({ whatsappPhone: "+++" }))).toBeNull();
  });

  it("strips the leading + and any punctuation from the E.164 phone", () => {
    const href = buildWhatsAppHref("en", undefined, makeConfig({ whatsappPhone: "+1 (555) 123-4567" }));
    expect(href).toContain("https://wa.me/15551234567?text=");
  });

  it("selects the English greeting for the en locale", () => {
    const href = buildWhatsAppHref("en", undefined, makeConfig());
    expect(href).toBe(`https://wa.me/15551234567?text=${encodeURIComponent("Hello ELORA!")}`);
  });

  it("selects the Arabic greeting for the ar locale", () => {
    const href = buildWhatsAppHref("ar", undefined, makeConfig());
    expect(href).toBe(`https://wa.me/15551234567?text=${encodeURIComponent("مرحبا إيلورا!")}`);
  });

  it("falls back to the English greeting when Arabic is unset", () => {
    const config = makeConfig({ whatsappDefaultMessage: { en: "Hello ELORA!", ar: null } });
    expect(buildWhatsAppHref("ar", undefined, config)).toBe(
      `https://wa.me/15551234567?text=${encodeURIComponent("Hello ELORA!")}`,
    );
  });

  it("falls back to the English greeting for an unrecognized locale", () => {
    expect(buildWhatsAppHref("fr", undefined, makeConfig())).toBe(
      `https://wa.me/15551234567?text=${encodeURIComponent("Hello ELORA!")}`,
    );
  });

  it("URL-encodes a greeting containing spaces and special characters", () => {
    const config = makeConfig({ whatsappDefaultMessage: { en: "Hi! I'd like info & pricing?", ar: null } });
    const href = buildWhatsAppHref("en", undefined, config)!;
    expect(href).toContain("text=Hi!%20I'd%20like%20info%20%26%20pricing%3F");
    expect(href).not.toContain(" ");
  });

  it("prefers an explicit override message over both configured greetings", () => {
    const href = buildWhatsAppHref("ar", "Custom question", makeConfig());
    expect(href).toBe(`https://wa.me/15551234567?text=${encodeURIComponent("Custom question")}`);
  });

  it("omits the text parameter entirely when no greeting is configured", () => {
    const config = makeConfig({ whatsappDefaultMessage: { en: "", ar: null } });
    expect(buildWhatsAppHref("en", undefined, config)).toBe("https://wa.me/15551234567");
  });
});

describe("getSocialConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_INSTAGRAM_URL;
    delete process.env.NEXT_PUBLIC_WHATSAPP_PHONE;
    delete process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_EN;
    delete process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_AR;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reports everything as unconfigured when no env vars are set", () => {
    const config = getSocialConfig();
    expect(config.instagramUrl).toBeNull();
    expect(config.whatsappPhone).toBeNull();
    expect(config.whatsappDefaultMessage).toEqual({ en: "", ar: null });
  });

  it("treats an empty or whitespace-only value as unconfigured", () => {
    process.env.NEXT_PUBLIC_INSTAGRAM_URL = "   ";
    process.env.NEXT_PUBLIC_WHATSAPP_PHONE = "";
    const config = getSocialConfig();
    expect(config.instagramUrl).toBeNull();
    expect(config.whatsappPhone).toBeNull();
  });

  it("reads and trims configured values", () => {
    process.env.NEXT_PUBLIC_INSTAGRAM_URL = "  https://instagram.com/tia.jewellery  ";
    process.env.NEXT_PUBLIC_WHATSAPP_PHONE = "+15551234567";
    process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_EN = "Hello";
    const config = getSocialConfig();
    expect(config.instagramUrl).toBe("https://instagram.com/tia.jewellery");
    expect(config.whatsappPhone).toBe("+15551234567");
    expect(config.whatsappDefaultMessage.en).toBe("Hello");
    expect(config.whatsappDefaultMessage.ar).toBeNull();
  });

  it("both builders fail safe against a fully unconfigured environment", () => {
    const config = getSocialConfig();
    expect(buildInstagramHref(config)).toBeNull();
    expect(buildWhatsAppHref("en", undefined, config)).toBeNull();
  });
});
