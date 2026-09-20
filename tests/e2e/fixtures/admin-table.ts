import type { Locator, Page } from "@playwright/test";

/**
 * One record in an admin `DataTable`, at any viewport.
 *
 * `DataTable` renders both presentations at once — a card list below `md`
 * and a real `<table>` from `md` up — with the other hidden by a CSS
 * breakpoint. So `getByRole("row")` finds nothing on a phone (there is no
 * table in the accessibility tree there), and a text query can land on the
 * hidden variant. Both presentations carry `data-testid="admin-row"`;
 * filtering to the visible one picks whichever this viewport actually
 * shows.
 */
export function adminRow(page: Page, text: string): Locator {
  return page.getByTestId("admin-row").filter({ hasText: text }).filter({ visible: true }).first();
}
