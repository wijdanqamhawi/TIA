import net from "node:net";
import { assertEmulatorOnly, E2E_BASE_URL } from "./emulator-env";

/**
 * Runs once before any test (after the E2E web server is up). Re-checks the
 * emulator-only environment, confirms the emulators are actually reachable,
 * and confirms the E2E server's browser bundle is built for the demo project
 * — not the real one — before a single test or write can happen.
 */
function canConnect(hostPort: string): Promise<boolean> {
  const [host, port] = hostPort.replace(/^\[|\]/g, "").split(/:(?=\d+$)/);
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: Number(port), timeout: 3000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

export default async function globalSetup() {
  assertEmulatorOnly(process.env);

  for (const name of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"] as const) {
    const hostPort = process.env[name]!;
    if (!(await canConnect(hostPort))) {
      throw new Error(
        `\nE2E SAFETY STOP — ${name} (${hostPort}) is not reachable. Start the Firebase ` +
          "emulators first (npm run emulators). Nothing was run.\n",
      );
    }
  }

  // The browser SDK's project id is inlined into the client bundle at build
  // time, so the served JavaScript proves which Firebase project the pages
  // use. The login page is used because it always loads the Firebase client.
  const html = await (await fetch(`${E2E_BASE_URL}/en/login`)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  let sawDemoProject = false;
  for (const src of scripts) {
    const js = await (await fetch(new URL(src, E2E_BASE_URL))).text();
    if (js.includes("tia-jewllery")) {
      throw new Error(`\nE2E SAFETY STOP — the server at ${E2E_BASE_URL} is built for the PRODUCTION project. Nothing was run.\n`);
    }
    if (js.includes(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!)) sawDemoProject = true;
  }
  if (!sawDemoProject) {
    throw new Error(
      `\nE2E SAFETY STOP — could not confirm the server at ${E2E_BASE_URL} uses the emulator project ` +
        `"${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}". Nothing was run.\n`,
    );
  }

  await warmRoutes();
}

/**
 * The E2E server runs `next dev`, which compiles a route the first time it
 * is requested. That cost lands on whichever test happens to touch the
 * route first — one arbitrary test pays tens of seconds for work that has
 * nothing to do with what it asserts, and with several workers the same
 * test also competes for the compiler. Requesting every route once here,
 * before any test starts, moves that cost into setup where it belongs and
 * takes a whole class of "timed out on page.goto" flakes with it.
 *
 * One request per route *pattern* is enough — a dynamic segment compiles
 * once for every parameter — so a 404 or a redirect (an admin route with
 * no session, a confirmation page for an order that doesn't exist) warms
 * it just as well as a hit. Failures are ignored on purpose: this is a
 * warm-up, never a check.
 */
async function warmRoutes(): Promise<void> {
  const localized = [
    "",
    "/about",
    "/account",
    "/account/orders",
    "/account/orders/ELR-00000000-0000",
    "/cart",
    "/checkout",
    "/contact",
    "/login",
    "/order-confirmation/ELR-00000000-0000",
    "/privacy-policy",
    "/register",
    "/returns-exchange",
    "/shipping-delivery",
    "/shop",
    "/shop/category/bracelets",
    "/shop/golden-bangle-bracelet",
    "/terms-conditions",
    "/wishlist",
  ];
  const paths = [
    ...["en", "ar"].flatMap((locale) => localized.map((path) => `/${locale}${path}`)),
    "/admin",
    "/admin/categories",
    "/admin/customers",
    "/admin/exports",
    "/admin/locations",
    "/admin/customers/warm-up",
    "/admin/orders",
    "/admin/orders/warm-up",
    "/admin/products",
    "/admin/products/new",
    "/admin/products/warm-up/edit",
    "/admin/showcases",
    "/admin/team",
    "/manifest.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
  ];

  // Sequential, not parallel: the point is to let the dev compiler work
  // through the graph once without contention, exactly as a single early
  // test would have made it do.
  for (const path of paths) {
    try {
      const response = await fetch(`${E2E_BASE_URL}${path}`, { redirect: "manual" });
      await response.arrayBuffer();
    } catch {
      // Ignored — warming only.
    }
  }
}
