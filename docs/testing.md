# Manual Device Verification Checklist (Pre-Release)

Automated coverage (`tests/e2e/responsive.spec.ts`, T187) checks horizontal overflow, grid column
counts, touch-target sizes, and stacking behavior at fixed viewport sizes across every Playwright
device project (`mobile`, `mobile-ios`, `tablet`, `laptop`, `desktop`). This checklist is the
**manual** pass to run before a release on real or emulated devices, since automated viewport
checks cannot catch everything (OS-level browser chrome, real touch behavior, actual font
rendering, momentum scrolling, PWA install prompts).

Run once in **English (LTR)** and once in **Arabic (RTL)**, on each device category below. Repeat
after any change touching layout, the design tokens, or a shared primitive (`Button`, `Input`,
`DataTable`, `StatCard`, `CartLineItem`).

## Device matrix

- **iPhone** (real device or Safari iOS simulator) — portrait and landscape
- **Android phone** (real device or Chrome DevTools device emulation) — portrait and landscape
- **iPad / Android tablet** — portrait and landscape
- **Laptop** (~1366×768)
- **Desktop / large desktop** (~1920×1080 and above)

## What to check on every device

- [ ] No horizontal scrollbar or scroll gesture on any page (Home, Shop, category, product detail,
      Cart, Wishlist, Checkout, Order Confirmation, Account + Account Orders, Login/Register, and
      every `/admin/*` page)
- [ ] The product grid shows the expected column count for the viewport (2 on phone, 2–3 on
      tablet, 3–4 on laptop/desktop) and never grows past 4 columns or lets cards stretch
      awkwardly on an ultra-wide monitor
- [ ] Every tappable control (buttons, links, quantity steppers, form inputs, nav items, the
      floating WhatsApp button) is comfortably tappable with a thumb — nothing feels cramped or
      accidentally triggers a neighboring control
- [ ] The mobile hamburger menu opens/closes smoothly, covers the full height, never overlaps the
      floating WhatsApp button or a mobile Add-to-Cart bar, and every destination available on
      desktop nav is reachable from it
- [ ] Product images fill their card without distortion or cropping that hides the product; no
      layout shift as images load
- [ ] Every dialog/modal (image lightbox, admin edit dialogs, delivery-location selector) is fully
      visible without needing to scroll the page behind it, and its own content scrolls internally
      if it's taller than the viewport
- [ ] The Cart/Checkout line items render as stacked cards below tablet width and as a compact
      row at tablet width and above, with the price/quantity/remove controls all reachable
- [ ] Admin data tables (Products, Orders, Customers) render as a card list below tablet width and
      as a real table at tablet width and above; if a table still needs horizontal scroll at very
      narrow desktop widths, only the table scrolls — never the whole page
- [ ] The admin dashboard's stat tiles stack vertically on phone and arrange in a row on
      laptop/desktop
- [ ] Text remains legible at every size — no truncated/overlapping text, no font so small it's
      hard to read on a phone, no heading so large it wraps awkwardly
- [ ] Rotating the device (portrait ↔ landscape) never breaks the layout or introduces horizontal
      scrolling
- [ ] If testing an installed PWA (Phase 12+): the standalone window behaves identically to the
      browser tab for everything above

## RTL-specific checks (repeat the full list above in Arabic, plus)

- [ ] The mobile nav drawer slides in from the correct (trailing/start) edge for RTL, not the LTR
      edge
- [ ] Icons that imply direction (back arrows, chevrons) are mirrored correctly
- [ ] Text alignment, padding, and margins read correctly right-to-left — nothing is visibly
      "flipped LTR content with RTL text" (mismatched spacing on one side)
- [ ] Numbers, prices, and the order-number/date formats remain readable and correctly positioned

## Accessibility spot-checks (either language)

- [ ] Every interactive control has a visible focus outline when tabbed to with a keyboard
- [ ] Screen reader (VoiceOver on iOS, TalkBack on Android, or a desktop screen reader) announces
      the mobile menu button, dialogs, and form errors sensibly
- [ ] Color contrast remains acceptable in direct sunlight / low-brightness settings (spot-check,
      not a substitute for the automated contrast checks elsewhere in this project)

## Recording results

File a note (or a quick issue) for anything that fails, referencing the exact device, orientation,
language, and page. Do not ship a release with an unresolved horizontal-overflow or unreachable-
control finding from this checklist.
