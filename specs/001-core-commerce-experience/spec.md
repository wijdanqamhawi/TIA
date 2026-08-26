# Feature Specification: Core Commerce Experience

**Feature Branch**: `001-core-commerce-experience`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Build the complete core e-commerce experience for ELORA JEWELLERY, a luxury jewelry brand intended for real customers. The purpose of this feature is to provide customers with a complete online shopping journey, while providing the store owner with the essential tools needed to manage products, customers, and orders. Supports Guest customer, Registered customer, and Administrator. Covers home page, shop browsing/search/filter/sort, product details, cart, checkout (Cash on Delivery, extensible payment architecture), order creation and confirmation, customer accounts and order history, wishlist, storefront navigation/collections/about/contact/footer, and the full admin experience (product management, order management, customer management, dashboard statistics). Data must be real and persistent, not hardcoded. Brand identity (official logo, luxury color palette, elegant tone) must be preserved throughout, and the experience must be mobile-first and responsive across devices."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Purchase as a Guest (Priority: P1)

A visitor arrives at ELORA JEWELLERY, browses the catalog, opens a product she likes, adds it to
her cart, and completes checkout with delivery details and Cash on Delivery — without needing to
create an account first. Account creation may be offered afterward as an optional step.

**Why this priority**: This is the entire reason the store exists — revenue depends on a visitor
being able to go from "interested" to "ordered" without friction. Every other capability supports
this core transaction.

**Independent Test**: Starting from the homepage with no prior session, a shopper can search or
browse to a product, add a valid quantity to the cart, proceed through checkout, submit valid
delivery details with Cash on Delivery, and land on an order confirmation page showing a unique
order number, the correct items, and the correct total. The order is then visible in the admin
order list.

**Acceptance Scenarios**:

1. **Given** the homepage, **When** the shopper selects "Shop Now" or one of the four Featured
   Category cards (Bracelets, Rings, Earrings, Watches), **Then** she is taken to the shop catalog
   or, for a category card, directly to that category's own dedicated page showing only products
   from that category.
2. **Given** the shop catalog, **When** the shopper searches, filters by category or price, or
   sorts by newest/price/popularity, **Then** the displayed products update to match the applied
   criteria; **When** she instead opens a category's own dedicated page (e.g., Rings) and applies
   search/price filter/sort there, **Then** only Ring products are shown and update accordingly.
3. **Given** a product detail page, **When** the shopper selects a valid quantity within available
   stock and adds it to the cart, **Then** the cart reflects the updated item and quantity.
4. **Given** a product with only N units in stock, **When** the shopper attempts to select a
   quantity greater than N, **Then** the system prevents the selection and explains the available
   stock.
5. **Given** a product whose stock is 0, **When** the shopper views it in the shop listing or on
   its product detail page, **Then** she sees a "SOLD OUT" badge/label, and Add to Cart and
   quantity selection are disabled so the product cannot be purchased.
6. **Given** items in the cart, **When** the shopper proceeds to checkout and submits all required
   delivery information with a valid format, **Then** the order is accepted, persisted, and the
   stock of every ordered product is decremented by its ordered quantity accordingly.
7. **Given** a product in the shopper's cart whose stock has dropped below the cart quantity (or
   reached 0) since it was added, **When** she proceeds to checkout, **Then** the system re-checks
   the authoritative current stock, blocks the order, and shows a clear message identifying the
   affected product so she can adjust the quantity before retrying.
8. **Given** incomplete or invalid checkout information (e.g., missing phone number, malformed
   email), **When** the shopper attempts to submit, **Then** the system blocks submission and shows
   field-level validation messages.
9. **Given** a successfully placed order, **When** the order is created, **Then** the shopper is
   redirected to an order confirmation page showing the order number, ordered products, quantities,
   total, and payment method.

---

### User Story 2 - Manage an Account and Order History (Priority: P2)

A shopper creates an ELORA JEWELLERY account (or already has one), signs in, updates her profile,
and reviews the status of past orders.

**Why this priority**: Repeat customers are core to a luxury brand's retention; customers need
confidence that their order history and status are tracked and visible, which also reduces
customer-service inquiries.

**Independent Test**: A new user can register, log in, view and update her profile, place an order
while authenticated, and later see that order — including its current status — in her order
history without help from any other feature.

**Acceptance Scenarios**:

1. **Given** the registration form, **When** a visitor submits valid account details, **Then** an
   account is created and she is signed in.
2. **Given** valid credentials, **When** a registered customer logs in, **Then** she reaches her
   account area; **When** she logs out, **Then** her session ends and account pages are no longer
   accessible.
3. **Given** a signed-in customer, **When** she updates her profile information with valid data,
   **Then** the changes are saved and reflected the next time she views her profile.
4. **Given** a signed-in customer with past orders, **When** she opens her order history, **Then**
   she sees each order's number, date, total, and current status (Pending, Confirmed, Preparing,
   Shipped, Delivered, or Cancelled).
5. **Given** an order in her history, **When** she opens it, **Then** she sees the full order detail
   (items, quantities, pricing, delivery information, payment method, and current status).

---

### User Story 3 - Maintain a Wishlist (Priority: P3)

A registered customer saves jewelry pieces she is considering for later, revisits her wishlist
across sessions, and moves an item into her cart when she is ready to buy.

**Why this priority**: Wishlisting is a well-established driver of return visits and conversion in
jewelry e-commerce (higher-consideration purchases), but the store is still functional without it.

**Independent Test**: A signed-in customer can add a product to her wishlist from the shop or
product page, see it persist across a new session, remove it, and move it to her cart — all
independent of checkout or admin functionality.

**Acceptance Scenarios**:

1. **Given** a signed-in customer viewing a product, **When** she selects "Add to Wishlist," **Then**
   the product appears in her wishlist.
2. **Given** her wishlist, **When** she removes a product, **Then** it no longer appears there.
3. **Given** a product in her wishlist, **When** she chooses to move it to her cart, **Then** it is
   added to her cart (subject to stock availability) and removed from the wishlist.
4. **Given** the same customer signs in from a different device, **When** she opens her wishlist,
   **Then** she sees the same saved products.

---

### User Story 4 - Manage Products as an Administrator (Priority: P4)

A store administrator signs in to a protected admin area and keeps the product catalog accurate:
adding new pieces, updating price/stock/description, organizing by category, and flagging pieces
as New Arrival or Best Seller.

**Why this priority**: Without reliable product management, the storefront cannot stay accurate,
which directly undermines Story 1. This is ranked after the customer-facing purchase and account
flows because those define the product/order data the admin experience operates on, but it is
still essential to daily store operation.

**Independent Test**: An authenticated administrator can create a new product with all required
fields, see it appear in the live storefront catalog, edit its price/stock/category/description,
toggle its Best Seller / New Arrival / availability flags, and delete it — each verifiable without
touching order or customer management.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** she attempts to reach any admin page or perform
   any admin action (including directly, bypassing the UI), **Then** access is denied.
2. **Given** a signed-in administrator, **When** she creates a product with name, description,
   price, category, at least one image, material, stock quantity, and availability, **Then** the
   product is saved and immediately visible in the storefront (if marked available).
3. **Given** an existing product, **When** the administrator edits its price, stock, category,
   description, material, colors/options, or availability, **Then** the storefront reflects the
   updated values.
4. **Given** the product management list, **When** the administrator views it, **Then** she can see
   each product's current stock quantity and readily identify which products are currently Sold
   Out.
5. **Given** a product with stock greater than 0, **When** the administrator edits its stock down
   to 0 and saves, **Then** the product automatically becomes Sold Out on the storefront (badge
   shown, Add to Cart disabled) with no separate "mark as Sold Out" step required.
6. **Given** a Sold Out product (stock = 0), **When** the administrator increases its stock above
   0 and saves, **Then** the product automatically becomes purchasable again on the storefront with
   no separate "unmark Sold Out" step required.
7. **Given** the product edit form, **When** the administrator attempts to save a negative stock
   value, **Then** the system rejects the submission with a clear validation message.
8. **Given** an existing product, **When** the administrator marks or unmarks it as Best Seller or
   New Arrival, **Then** the storefront's corresponding sections update accordingly.
9. **Given** an existing product, **When** the administrator deletes it, **Then** it no longer
   appears in the storefront, while any historical orders that included it remain unaffected and
   accurate.
10. **Given** a signed-in registered customer (non-admin), **When** she attempts any admin action,
    **Then** the system denies it regardless of what the interface displays.

---

### User Story 5 - Manage Orders and Customers as an Administrator (Priority: P5)

An administrator reviews incoming orders, updates their status as they progress through
fulfillment, and looks up customer records and their order history; she also checks the dashboard
for a snapshot of store performance.

**Why this priority**: Order fulfillment and customer support are essential ongoing operations, but
they depend on orders and customers already existing (Stories 1 and 2), so this closes the loop
rather than opening it.

**Independent Test**: An authenticated administrator can view the full order list, open an order to
see its full detail, change its status, and see that status change reflected in the customer's
order history; she can also open a customer record to see that customer's orders, and see
dashboard statistics update to reflect current store data.

**Acceptance Scenarios**:

1. **Given** the admin order list, **When** the administrator searches or filters orders, **Then**
   the list updates to match.
2. **Given** an order, **When** the administrator opens it, **Then** she sees customer information,
   delivery information, purchased products, quantities, total price, payment method, and current
   status.
3. **Given** an order, **When** the administrator changes its status, **Then** the new status is
   saved and immediately visible to the customer in her order history.
4. **Given** the admin customer list, **When** the administrator opens a customer record, **Then**
   she sees that customer's profile information and full order history.
5. **Given** the admin dashboard, **When** the administrator views it, **Then** she sees total
   sales, total orders, total customers, total products, recent orders, and best-selling products,
   all reflecting current persisted store data.

---

### User Story 6 - Install and Use ELORA JEWELLERY as an App (Priority: P6)

A shopper on her phone, tablet, or computer installs ELORA JEWELLERY to her home screen or app
list from her browser, so it launches like a native app (its own icon, its own window, no browser
address bar where the platform supports that) while remaining exactly the same storefront —
browsing, cart, wishlist, checkout, and her account all work identically to the browser version.

**Why this priority**: Installability is a polish/engagement layer on top of the fully-functional
responsive storefront (Stories 1–5) — the store is completely usable without it, so it is
correctly the lowest priority, but it meaningfully improves repeat-visit convenience for a retail
brand's customers on the devices they already use.

**Independent Test**: On a platform that supports it, a shopper can install ELORA JEWELLERY from
her browser, see it launch with the ELORA name and logo in standalone mode, and complete the full
Home → Shop → Product → Cart → Checkout → Confirmation flow inside the installed app exactly as
she could in the browser — verifiable without any other feature needing to change.

**Acceptance Scenarios**:

1. **Given** a browser/platform that supports installable web apps, **When** the shopper is
   offered the option, **Then** she sees a clear, unobtrusive "Install ELORA JEWELLERY App" option
   rather than an aggressive or repeated interruption.
2. **Given** she installs the app, **When** it launches, **Then** it opens using the name "ELORA
   JEWELLERY," the official ELORA logo as its icon, a standalone window (no browser address bar)
   where the platform supports that display mode, and a polished branded launch/loading moment.
3. **Given** the installed app, **When** she browses, adds to cart, checks out, or manages her
   account/wishlist, **Then** every one of those operations behaves identically to the ordinary
   browser experience — the same live, authoritative store data, the same validation, the same
   order creation.
4. **Given** a platform (such as iOS Safari) where the browser does not offer a programmatic
   install prompt, **When** the shopper wants to install the app, **Then** she is shown clear,
   platform-appropriate instructions (e.g., using the Share menu's "Add to Home Screen") rather
   than a non-functional install button or a false claim that one-tap installation is available.
5. **Given** the app is already installed, or the current browser does not support installation,
   **When** the shopper visits the site, **Then** she is not shown the install option at all (or
   it is not repeatedly re-offered after she has dismissed it), avoiding a nagging experience.
6. **Given** the installed app with no network connectivity, **When** the shopper opens it, **Then**
   she sees a clear, branded, professional offline message rather than a broken page, and any
   previously-cached safe/static content (e.g., static page shell, branding) may still display;
   **When** she attempts to check out or perform any operation that requires live store data,
   **Then** the system clearly communicates that connectivity is required and does not create or
   claim to create an order.

---

### User Story 7 - Shop ELORA JEWELLERY in Arabic or English (Priority: P7)

A shopper switches ELORA JEWELLERY between Arabic and English from the Navbar, and the entire
storefront — browsing, product content, cart, checkout, order confirmation, her account, and the
installed app — responds correctly in her chosen language and reading direction, and stays that
way as she navigates, refreshes, and returns later.

**Why this priority**: The store is fully functional in a single language without this (Stories
1–6 all work), so it is correctly the lowest priority, but it materially widens who can
comfortably shop ELORA JEWELLERY and is explicitly required as a complete, not partial,
capability.

**Independent Test**: A shopper switches to Arabic from the Navbar; the layout mirrors correctly
to right-to-left, product names/descriptions/category labels/checkout fields/order statuses all
display in Arabic, the choice survives a page refresh and a full checkout, and switching back to
English restores the left-to-right layout and English content everywhere — all independent of any
other story's own functional correctness (guest checkout, wishlist, admin management, etc. all
still work identically regardless of language).

**Acceptance Scenarios**:

1. **Given** any storefront page, **When** the shopper selects Arabic from the Navbar language
   switcher, **Then** the page immediately re-renders right-to-left, the document's language and
   direction are set to Arabic/RTL, and all storefront text (navigation, product listings, product
   detail, cart, wishlist, checkout, account, order history, footer, Instagram/WhatsApp labels,
   install/offline PWA messaging) appears in Arabic.
2. **Given** she has selected Arabic, **When** she navigates to another page, refreshes the
   browser, or closes and reopens the site (including the installed PWA) later, **Then** Arabic
   remains selected without being asked again.
3. **Given** Arabic is selected, **When** she views a product, a category page, or a homepage
   category showcase, **Then** she sees the Arabic product name/description/material/option
   labels and the Arabic category name (e.g., "أساور" for Bracelets) — the underlying product and
   category identity, URL routing, and category membership remain exactly the same as in English.
4. **Given** Arabic is selected, **When** she completes checkout, **Then** the checkout form
   fields, validation messages, and the order confirmation are presented in Arabic with correct
   RTL form layout, while the price/stock/total values themselves are computed identically to the
   English flow — language never changes an authoritative amount.
5. **Given** she placed an order while using Arabic, **When** she (or an administrator) later
   views that order after the product's translations have since been edited, **Then** the order
   still displays a correct, understandable snapshot of what was purchased at the time, in the
   language(s) captured at purchase.
6. **Given** Arabic is selected, **When** she opens the mobile hamburger menu, the floating
   WhatsApp button, or an install/offline PWA message, **Then** each is correctly mirrored/labeled
   for RTL and remains fully usable — none of them break, overlap, or become unreadable.
7. **Given** English is selected (the default), **When** she uses the storefront, **Then**
   everything renders left-to-right exactly as previously approved, with no regression from this
   feature.

---

### User Story 8 - Select a Delivery Location (Priority: P8)

A shopper opens a location selector from the Navbar, chooses her service region (West Bank or
Inside/1948 Areas) and her specific city/area, and that selection is remembered as she browses and
is used to prefill her delivery details at checkout — with the store never accepting an order for
a location it doesn't actually service.

**Why this priority**: The store is fully functional without this — a shopper can already type any
delivery details at checkout (Stories 1–7 all work) — so it is correctly the lowest priority, but
it is explicitly required to keep delivery expectations honest and to make checkout faster for
returning shoppers.

**Independent Test**: A shopper opens the location selector, searches for and picks a supported
city/area, sees her selection reflected in the Navbar, has it prefilled (and still editable) at
checkout, sees checkout reject an attempt to proceed with a location the store has since stopped
servicing, and finds her selection still in place after a refresh or reopening the installed PWA.

**Acceptance Scenarios**:

1. **Given** any storefront page, **When** the shopper opens the location selector from the
   Navbar, **Then** an elegant modal/drawer opens showing exactly two service regions — "West
   Bank" / "الضفة الغربية" and "Inside / 1948 Areas" / "الداخل" — and no worldwide country list of
   any kind.
2. **Given** the location selector is open, **When** she selects a region and searches for a
   city/area by name (in Arabic or English), **Then** matching supported cities/areas for that
   region appear, localized in her current language, and selecting one closes the selector and
   updates the Navbar to show her chosen location.
3. **Given** she has selected a location, **When** she navigates to another page, refreshes the
   browser, or reopens the installed PWA later, **Then** her selection is still shown without
   being asked again, and she can open the selector at any time to change it.
4. **Given** she has a selected location, **When** she reaches checkout, **Then** her region and
   city/area are prefilled into the delivery details, and she can still review and change them
   before placing the order.
5. **Given** a location that was supported when she selected it has since been deactivated by an
   administrator, **When** she attempts to complete checkout with it, **Then** the system rejects
   the order, shows a clear localized message, and lets her pick another supported location — it
   never silently creates the order or silently substitutes a different location.
6. **Given** no location has been selected yet, **When** she reaches checkout, **Then** she can
   still select or type her delivery city/area there, and whatever she submits is validated
   against the same supported-location rules as an earlier selector-based choice.
7. **Given** she switches the storefront language, **When** she reopens the location selector,
   **Then** the same underlying region/city selection is still in effect, now displayed in the new
   language — switching language never changes which location is actually selected.

---

### Edge Cases

- What happens when a shopper's cart contains a product whose stock drops below the cart quantity,
  or reaches 0 and becomes Sold Out, (e.g., another customer purchased it first, or an admin
  corrected the stock) before she completes checkout? The system MUST re-validate stock
  authoritatively at checkout, reject the order for the affected line, and show a clear message
  telling her to adjust that line's quantity — the order MUST NOT be silently created with an
  adjusted/reduced quantity on her behalf.
- What happens when two customers try to buy the last unit(s) of the same product at nearly the
  same time? The order-creation transaction MUST ensure only as many units as are actually in
  stock are sold in total — one customer's order succeeds and decrements stock to 0 (making the
  product Sold Out for the other), and the other customer's order, if it would drive stock
  negative, MUST be rejected with a clear message rather than both orders succeeding.
- What happens when an administrator reduces a product's stock (including down to 0) or removes
  its availability while it sits in an existing customer's cart or wishlist? The customer MUST see
  accurate, current availability/Sold Out state at checkout time, even if the cart/wishlist view
  was stale; a product that reached 0 stock MUST show as Sold Out automatically, with no admin
  action beyond updating the stock number itself.
- What happens when an administrator edits or deletes a product that appears in past orders? Past
  orders MUST retain the product name, price, and details exactly as they were at purchase time,
  independent of later catalog edits.
- What happens when a shopper attempts to check out with an empty cart? The system MUST prevent
  checkout and direct her back to the shop.
- What happens when a shopper submits a checkout form with a quantity that is no longer valid
  (zero, negative, non-numeric, or exceeding stock)? The system MUST reject the submission with a
  clear validation message.
- What happens when an administrator restocks a Sold Out product (raises stock from 0 to a
  positive number)? The product MUST automatically stop being treated as Sold Out and become
  purchasable again, with no separate manual "relist" step.
- What happens when an administrator attempts to set a negative price or negative stock quantity?
  The system MUST reject the input.
- What happens when a guest attempts to view order history or account pages? She MUST be directed
  to register or sign in rather than seeing an error or another customer's data.
- What happens when two administrators edit the same order or product at nearly the same time? The
  system MUST apply changes consistently so the record does not end up in a contradictory state.
- What happens when a search or filter combination in the shop returns no matching products? The
  shopper MUST see a clear empty-state message rather than a blank or broken page.
- What happens when a customer rotates her device between portrait and landscape, or resizes a
  browser window, mid-session (e.g., while on the cart, checkout, or an admin data table)? The
  layout MUST re-adapt fluidly to the new width/orientation without losing entered form data,
  cart contents, or scroll context, and without introducing unintended horizontal scrolling.
- What happens when an admin data table (orders, products, customers) is viewed on a narrow
  tablet or phone screen? It MUST present a mobile-appropriate alternative (responsive card
  layout, prioritized columns, or table-confined scrolling) rather than forcing the entire page to
  scroll horizontally or rendering the table unusably cramped.
- What happens when a shopper attempts to complete checkout while offline or while connectivity to
  the store's backend is unavailable? The system MUST NOT create an order or indicate success —
  checkout MUST require a successful round-trip to the trusted server/Firebase backend, whether
  the shopper is using the installed app or the ordinary browser.
- What happens when a shopper revisits ELORA JEWELLERY (installed or in-browser) after prices,
  stock, or Sold Out state have changed? She MUST see current, authoritative data from the server
  — any offline/cached content is limited to safe static assets (branding, static page shell) and
  MUST NOT be presented as current pricing, inventory, or order information.
- What happens on a browser/platform that offers no programmatic install prompt (e.g., iOS
  Safari)? The system MUST show accurate, platform-appropriate manual installation instructions
  rather than a non-functional "Install" button or a claim of one-tap installation that platform
  does not support.
- What happens if a shopper dismisses the install option? The system MUST NOT immediately
  re-prompt her on every subsequent page view; repeated aggressive prompting is not acceptable.
- What happens if the Instagram URL or WhatsApp number has not yet been configured with real
  values? The corresponding control MUST fail safely (hidden or disabled with an explanatory
  label) rather than linking to a fake or empty destination (spec FR-006h).
- What happens when the floating WhatsApp button is shown on a small mobile screen alongside a
  visible Add to Cart bar, cart controls, or a PWA install prompt? The floating button MUST be
  positioned so it never covers any of them; if space is genuinely too constrained to guarantee
  that, the floating button MUST be hidden on that page/state rather than obstructing a primary
  action.
- What happens to the floating WhatsApp button when ELORA JEWELLERY is running as an installed PWA
  in standalone mode? It MUST continue to function and hand off to WhatsApp (app or web) without
  breaking or exiting the installed app's standalone navigation context.
- What happens when a homepage category showcase has no admin-provided content yet (no image/
  title configured), or when a category has fewer products than a "Featured" section wants to
  display? The showcase MUST degrade gracefully (e.g., an appropriate placeholder or the section
  simply not rendering) rather than showing a broken image, empty text, or a visibly incomplete
  layout.
- What happens when a product shown in a homepage "Featured" section reaches 0 stock? It MUST show
  SOLD OUT and be non-purchasable there exactly as it would on the Shop page or its own category
  page — the homepage MUST NOT bypass inventory rules or present a separate, less-authoritative
  view of the product.
- What happens if a product or category has not yet been given Arabic content by the admin? The
  system MUST NOT silently machine-translate or show a blank value; it MUST fall back to a clearly
  defined behavior (e.g., displaying the English content until Arabic is provided) rather than
  presenting a broken or empty field.
- What happens when a shopper switches language while she has items in her cart or mid-checkout?
  The cart contents, quantities, and any already-entered checkout field values MUST be preserved —
  only the display language and direction change, never the underlying commerce state.
- What happens when an admin edits a product's Arabic or English content while that product is
  sitting in an active customer's cart or a pending order? The customer's already-placed order's
  historical snapshot MUST remain unaffected (per the existing snapshot rule, now bilingual); a
  not-yet-completed cart simply reflects the corrected translation the next time it's read.
- What happens if a shopper's browser or device is configured for a language ELORA JEWELLERY
  doesn't support (neither Arabic nor English)? The system MUST fall back to the default language
  (English) rather than erroring or showing untranslated placeholder keys.
- What happens when Arabic (RTL) is active and the shopper opens a dialog, the mobile hamburger
  menu, or the PWA install prompt? Each MUST mirror correctly (close controls, icons, and reading
  order on the correct side) rather than presenting an LTR-positioned control inside an
  otherwise-RTL page.
- What happens when a shopper attempts to complete checkout for a city/area the store does not
  (or no longer) service? The system MUST reject the checkout attempt with a clear, localized
  message and let her pick a different supported location — it MUST NOT silently accept the
  order, silently substitute a "closest" supported location, or invent a delivery promise for an
  unsupported area.
- What happens if an administrator deactivates a city/area while it is a shopper's currently
  selected/persisted location? Her stored selection MAY remain displayed for convenience, but the
  system MUST re-validate it authoritatively at checkout time and reject it if it is no longer
  active, exactly like any other unsupported-location attempt.
- What happens when a shopper has no selected location yet and reaches checkout? She MUST still be
  able to choose or enter her delivery city/area directly in checkout, validated by the same
  supported-location rules as a selector-based choice — the location selector is a convenience,
  not a mandatory gate before checkout can even be reached.
- What happens when a shopper is offline (or the installed PWA is showing cached content) and her
  previously-selected location is displayed? That cached display MAY remain visible, but it MUST
  NOT be treated as authoritative for order creation — final delivery-location eligibility MUST be
  revalidated against the live Firestore configuration before an order is created, exactly like
  price and stock.
- What happens when a shopper switches the storefront language while a location is selected? The
  underlying selected region/city identity MUST remain exactly the same — only its displayed
  label changes — so switching language never silently changes, clears, or invalidates her
  delivery-location choice.

## Requirements *(mandatory)*

### Functional Requirements

**Storefront — Home, Navigation, Content**

- **FR-001**: The system MUST present a homepage featuring the official ELORA JEWELLERY logo, a
  hero section with a headline and short brand tagline, a "Shop Now" call-to-action, then, per
  FR-001a–FR-001i, a large full-width showcase-and-featured-products section for each of the four
  core categories in turn, followed by a **Featured Categories** quick-entry section, New
  Arrivals, Best Sellers, Special Offers, and a brand introduction section — an elegant
  merchandising sequence (Hero → Bracelets showcase+featured → Rings showcase+featured → Earrings
  showcase+featured → Watches showcase+featured → remaining promotional/brand sections), not a
  duplicate listing of the same categories twice with no relationship between the sections.
- **FR-001a**: For each of the four core categories, the homepage MUST include a large, full-width
  editorial showcase section distinct from the Featured Categories quick-entry cards: large
  category-appropriate imagery, the category name, an optional short subtitle/tagline, and a
  clear call-to-action (e.g., "Shop Bracelets") that navigates directly to that category's
  dedicated page (spec FR-007a). The showcase area MUST be obviously interactive (e.g., the whole
  banner or its CTA is clickable) so a customer immediately understands she can enter the
  category from it.
- **FR-001b**: Each category showcase MUST be immediately accompanied by a curated, responsive
  selection of real products from that same category ("Featured Bracelets," "Featured Rings,"
  etc.), sourced from persisted catalog data — never hardcoded sample products. A category's
  featured-products selection MUST contain only products belonging to that category; 0% may leak
  from a different category.
- **FR-001c**: Products shown in a homepage featured-products selection MUST obey exactly the same
  inventory rules as everywhere else in the storefront: a product at `stock === 0` MUST display
  SOLD OUT there too, with Add to Cart/purchase disabled, per FR-015a — the homepage MUST NOT be a
  separate, less-authoritative view of a product's availability, and MUST NOT allow bypassing
  stock validation.
- **FR-001d**: The visual content of each category showcase (its imagery, title, subtitle, and
  CTA text) MUST be maintainable by an authorized administrator without a source-code change —
  normal content updates (a new seasonal image, a reworded tagline) MUST NOT require a developer
  to edit and redeploy the application.
- **FR-001e**: Category showcase sections MUST follow the official ELORA JEWELLERY visual
  identity (Burgundy + Gold + Cream/Ivory/Soft Beige, spec FR-051) and MUST NOT copy another
  brand's logo, imagery, text, or layout pixel-for-pixel — the official ELORA logo and ELORA's own
  original imagery/copy are used throughout.
- **FR-001f**: Each category showcase MUST use a mobile-appropriate image composition, not merely
  a shrunk version of its desktop banner, and MUST remain fully responsive — readable title/CTA,
  no text obscuring important product/jewelry detail, touch-friendly interaction, and no
  horizontal overflow — across the same device range as the rest of the storefront (spec FR-050).
- **FR-002**: The system MUST provide primary storefront navigation containing the ELORA JEWELLERY
  logo, Home, Shop, Collections, About, Contact, Search, Wishlist, Cart, and Account, available on
  every public page, with clear access to the individual product categories (Bracelets, Rings,
  Earrings, Watches) from that navigation — e.g., as a Shop/Categories menu that lists them —
  rather than requiring the customer to first land on the Shop page and filter manually. On desktop,
  the navigation MUST also include a direct Instagram link, a direct WhatsApp contact action
  (spec FR-006a–FR-006g), and a language switcher (spec FR-066), presented as small, elegant
  controls rather than large buttons, without crowding or displacing Home/Shop/Collections/About/
  Contact/Search/Wishlist/Cart/Account.
- **FR-003**: On mobile viewports, the system MUST present primary navigation through a
  collapsible (hamburger-style) menu that preserves access to all navigation destinations,
  including direct access to each product category, Instagram, WhatsApp, and the language
  switcher — without sacrificing the usability of Search, Wishlist, Cart, Account, or the
  hamburger control itself, and without causing the mobile header to become crowded or cluttered.
  Instagram, WhatsApp, and the language switcher MAY be placed inside the hamburger menu itself if
  that gives the best mobile experience, rather than as additional icons in the compact header bar.
- **FR-004**: The system MUST provide an About page describing the ELORA JEWELLERY brand concept
  and identity.
- **FR-005**: The system MUST provide a Contact page presenting the store's contact details and
  channels; these details MUST be sourced from store-provided/configurable content rather than
  invented placeholder values.
- **FR-006**: The system MUST provide a footer, present on all storefront pages, containing ELORA
  JEWELLERY branding and links to Shop, About Us, Contact, Shipping & Delivery, Returns &
  Exchange, Privacy Policy, Terms & Conditions, and the brand's Instagram, TikTok, and WhatsApp
  channels; the underlying policy text, legal content, and social/contact links MUST come from
  store-provided content rather than invented text or URLs. The footer's Instagram and WhatsApp
  links MUST read from the same centralized configuration as every other Instagram/WhatsApp
  placement (spec FR-006a).

**Instagram & WhatsApp Contact**

- **FR-006a**: The official Instagram profile URL, the official WhatsApp business phone number,
  and an optional configurable WhatsApp default greeting message MUST be stored in one centralized
  configuration/environment source — never hardcoded or independently duplicated inside the
  navbar, footer, floating WhatsApp button, or any other individual component. Every Instagram or
  WhatsApp control anywhere in the application MUST read from that same source, so updating the
  real store information in one place updates it everywhere.
- **FR-006b**: The system MUST NOT invent or hardcode a fake/placeholder Instagram URL or WhatsApp
  phone number. Until the store owner supplies the real values, the centralized configuration MUST
  remain clearly present and documented as pending real values (spec Assumptions), and any
  Instagram/WhatsApp control MUST handle a not-yet-configured destination safely (spec FR-006h)
  rather than linking anywhere fake.
- **FR-006c**: Clicking/tapping the Instagram control MUST open the official ELORA JEWELLERY
  Instagram profile: on a mobile device where the Instagram app is available, the system MUST
  allow the Instagram app to handle the link; otherwise it MUST open in the browser. The link MUST
  open safely (i.e., without granting the opened page unnecessary access back to the ELORA
  application).
- **FR-006d**: Clicking/tapping the WhatsApp control MUST open a conversation with the official
  ELORA JEWELLERY WhatsApp business number, pre-filled with the configured greeting message (e.g.,
  "Hello ELORA JEWELLERY, I would like to ask about a product.") when one is configured. On mobile,
  the system MUST hand off to the WhatsApp app where available; on desktop, it MUST use the
  appropriate WhatsApp Web destination.
- **FR-006e**: In addition to the navbar (FR-002/FR-003) and footer (FR-006), the storefront MUST
  provide an elegant, unobtrusive **floating WhatsApp contact action** on appropriate
  customer-facing storefront pages. It MUST remain touch-friendly, carry an accessible label, be
  clearly recognizable as a WhatsApp contact action even though represented primarily by an icon,
  and MUST NOT visually cover or otherwise interfere with Add to Cart, checkout/buy actions, cart
  controls, primary navigation, PWA install controls, cookie/consent notices, forms, product
  information, or any other important on-page action, at any supported screen size.
- **FR-006f**: Instagram and WhatsApp access (navbar, footer, and the floating WhatsApp action)
  MUST continue to work correctly when ELORA JEWELLERY is launched as an installed PWA (spec
  FR-053): activating one MUST hand off to the corresponding installed app where the operating
  system supports it, or the appropriate browser/web destination otherwise, without breaking or
  exiting the installed app's standalone navigation.
- **FR-006g**: Every Instagram/WhatsApp control (navbar, footer, floating button) MUST be
  accessible: it MUST have an accessible name/label (not conveyed by icon shape alone), MUST be
  keyboard-operable where the platform's interaction model calls for it, MUST show a visible focus
  state, MUST meet the same touch-target-size and contrast expectations as other interactive
  controls (spec FR-050b/FR-050h), and MUST remain visually consistent with the Burgundy + Gold +
  Cream/Ivory identity (spec FR-051) — including using a WhatsApp treatment that reads as WhatsApp
  without resorting to the platform's standard bright green if that would clash with the brand
  palette.
- **FR-006h**: If the Instagram URL or WhatsApp number has not yet been configured with real
  values, any control that would otherwise link to it MUST fail safely — e.g., remaining hidden or
  visibly disabled with an explanatory accessible label — rather than linking to an empty,
  placeholder, or fabricated destination.
- **FR-007**: The system MUST let customers browse products grouped into collections, including at
  minimum the core categories **Bracelets, Rings, Earrings, and Watches**. Categories represent the
  product taxonomy every product belongs to; collections are curated groupings (e.g., New Arrivals,
  Best Sellers, Special Offers, seasonal edits) that may span multiple categories. The four core
  categories also serve as the primary entry points into the catalog from the homepage and
  navigation. The system MUST support adding further categories later without requiring a
  redesign of the catalog browsing experience (spec Assumptions).
- **FR-007a**: Each product category MUST have its own dedicated, SEO-friendly category page (a
  distinct route per category, e.g. `/shop/category/bracelets`) that displays **only** the
  products belonging to that category — opening the Bracelets category MUST show bracelet
  products only, opening Rings MUST show ring products only, and likewise for Earrings and
  Watches. The storefront MUST NOT present products from different categories intermixed with no
  way to isolate a single category.
- **FR-007b**: The main Shop page MAY display products from every category together, but MUST
  provide a clear, quickly-switchable category filter/navigation control (e.g., "All Products /
  Bracelets / Rings / Earrings / Watches") so a customer can immediately narrow the view to a
  single category without leaving the Shop page, in addition to being able to navigate directly to
  a category's own dedicated page (FR-007a).
- **FR-007c**: Within any single category (whether on a dedicated category page or the Shop page
  filtered to that category), search, price filtering, and all three sort modes (newest, price,
  popularity) MUST continue to function exactly as they do across the full catalog — e.g., a
  customer MUST be able to open Rings and sort by newest, open Bracelets and filter by price, or
  open Watches and sort by popularity, each scoped to that category's products only.
- **FR-007d**: A product's category MUST be a required, valid reference to an existing category —
  a product MUST NOT be creatable or editable into an invalid or missing category.

**Storefront — Shop, Product Details**

- **FR-008**: The system MUST let customers view the full catalog of available products.
- **FR-009**: The system MUST let customers search products by keyword.
- **FR-010**: The system MUST let customers filter products by category and by price range.
- **FR-011**: The system MUST let customers sort products by newest, by price, and by popularity.
- **FR-012**: Each product listing MUST show the product image, name, price, category,
  availability (including a **"SOLD OUT" badge** when the product's stock quantity is 0, per
  FR-015a), and controls to wishlist it, quick-view it, and add it to the cart.
- **FR-013**: The system MUST provide a dedicated product detail page showing large product
  images, name, price, description, material, available colors/options, current stock quantity
  (or a **"SOLD OUT"** indicator when stock is 0, per FR-015a), a quantity selector, Add to Cart,
  Add to Wishlist, and related products.
- **FR-014**: The system MUST prevent a customer from selecting or submitting a product quantity
  that is not a positive whole number, that is 0, or that exceeds the product's currently
  available stock, both when adding to cart and at checkout (e.g., if stock is 3, quantities 1–3
  are valid and 4+ are rejected).
- **FR-015**: The system MUST clearly indicate when a product is unavailable (hidden by an
  administrator) or sold out, both in listings and on its detail page, and MUST prevent adding an
  unavailable or sold-out product to the cart.
- **FR-015a**: A product's **Sold Out** state MUST be derived automatically from its stock
  quantity — whenever `stock === 0`, the system MUST treat the product as Sold Out without any
  separate manual admin action: display a "SOLD OUT" label/badge on its product card and product
  detail page, disable its Add to Cart control, disable quantity selection for purchase, and
  prevent it from being checked out. A Sold Out product MUST remain visible in the storefront
  catalog — including within its own category page and the Shop page filtered to that category
  (FR-007a/FR-007b), not just the general catalog — (it is browsable, just not purchasable) unless
  an administrator has separately and explicitly hidden/deactivated it via the product's
  admin-controlled visibility setting (FR-038) — Sold Out and "hidden by admin" are independent
  states, and reaching 0 stock MUST NOT itself hide the product from its category or the catalog.
  As soon as stock rises above 0 again (e.g., an admin restock), the Sold Out state MUST clear
  automatically and normal purchasing MUST resume, again with no manual admin action required.

**Cart**

- **FR-016**: The system MUST let customers add products to a cart, remove products from it, and
  increase or decrease the quantity of each cart line, always constrained by current available
  stock; a Sold Out product (FR-015a) MUST NOT be addable to the cart at all.
- **FR-016a**: If a product already sitting in a customer's cart becomes Sold Out, or its stock
  drops below the quantity already in the cart, while the customer is browsing elsewhere, the cart
  view MUST clearly reflect the reduced/zero availability (not silently keep showing the stale
  quantity as purchasable) the next time that cart is displayed.
- **FR-017**: The system MUST display, for the cart, each line's current quantity, the cart
  subtotal, and the cart total.
- **FR-018**: The system MUST let customers continue shopping from the cart and proceed from the
  cart to checkout.
- **FR-019**: The cart's contents MUST persist as the customer navigates the storefront within a
  session, and MUST persist across sessions for a signed-in customer.

**Checkout, Order Creation, Confirmation**

- **FR-020**: The system MUST collect, during checkout, the customer's full name, phone number,
  delivery region and city/area (prefilled from her selected location where available, per spec
  FR-091, and still reviewable/changeable here), full address, email, optional order notes, and a
  selected payment method.
- **FR-021**: The system MUST validate all required checkout fields before an order can be
  submitted, rejecting the submission with clear, field-level messages when data is missing or
  invalid — including rejecting an unsupported delivery region/city per spec FR-092/FR-093.
- **FR-022**: The system MUST support Cash on Delivery as the initial payment method, and MUST
  represent payment method as a distinct, extensible piece of order data so additional payment
  methods can be introduced later without redesigning the checkout experience.
- **FR-023**: Upon successful checkout, the system MUST create a persisted order containing a
  unique order number, the customer's information, delivery information, the ordered products,
  their quantities, each product's price at the moment of purchase, the order subtotal, the order
  total, the selected payment method, the order's status, and its creation timestamp.
- **FR-024**: The system MUST decrement product stock to reflect a newly created order's
  quantities as part of order creation, and this decrement MUST be performed securely, server-side,
  as part of the same atomic operation that creates the order (never as a separate, later step).
  Under no circumstance MUST a product's stock be allowed to go below 0 — an order that would drive
  any line's stock negative MUST be rejected rather than partially applied.
- **FR-025**: After an order is successfully created, the system MUST redirect the customer to an
  order confirmation page showing a confirmation message, the unique order number, the ordered
  products, their quantities, the order total, and the payment method.
- **FR-026**: The system MUST re-validate the authoritative, currently-stored stock and
  availability/Sold Out state of every cart line at the moment of order submission — even for a
  line that was validated when it was originally added to the cart — and MUST NOT create an order
  for any line whose requested quantity is no longer available. If any line has become invalid
  (stock reduced below the requested quantity, or the product became Sold Out or hidden) since it
  was added to the cart, the system MUST reject the checkout submission with a clear message
  identifying the affected product(s) and MUST require the customer to adjust the affected
  quantity/line before checkout can proceed, rather than silently adjusting or dropping the line
  on the customer's behalf.

**Customer Accounts**

- **FR-027**: The system MUST let a visitor register a new account, log in, and log out.
- **FR-028**: A signed-in customer MUST be able to view her own account information and update her
  own profile information, subject to validation.
- **FR-029**: A signed-in customer MUST be able to view her order history and open any individual
  order she placed to see its current status and full detail.
- **FR-030**: An order's status MUST be one of: Pending, Confirmed, Preparing, Shipped, Delivered,
  or Cancelled, and the customer-visible status MUST always reflect the store's current record.
- **FR-031**: A guest (non-signed-in visitor) MUST be able to browse products, use search/filter/
  sort, view product details, and use the cart, without being required to sign in.
- **FR-031a**: A guest MUST be able to complete checkout and place an order without registering or
  signing in first (guest checkout). The system MAY offer account creation as an optional step
  during or after order confirmation, but MUST NOT require it to place the order.

**Wishlist**

- **FR-032**: A signed-in customer MUST be able to add a product to her wishlist, remove a product
  from it, view it, and move a wishlisted product into her cart.
- **FR-033**: A customer's wishlist MUST persist across sessions and devices for the same account.
- **FR-033a**: The wishlist is a registered-customer feature. When a guest attempts to add a
  product to the wishlist, the system MUST prompt her to sign in or register rather than saving a
  wishlist entry; no wishlist data is retained for an unauthenticated visitor.

**Admin — Access Control**

- **FR-034**: Only authenticated users holding an administrator role MUST be able to reach the
  admin area or perform any admin operation; this restriction MUST be enforced by the system
  itself for every admin request, not only by hiding admin links or pages in the interface.
- **FR-035**: A registered customer without administrator privileges MUST be denied when attempting
  any admin operation, even if attempted directly rather than through the visible interface.

**Admin — Product Management**

- **FR-036**: An administrator MUST be able to view, add, edit, and delete products, including
  uploading product images, and setting/updating price, stock quantity, category, description,
  material, and available colors/options.
- **FR-036a**: When adding a new product, the administrator MUST enter its initial stock quantity
  (which may be 0). When editing an existing product, the administrator MUST be able to both
  increase stock (restock) and decrease/correct stock, and MUST always be able to see the
  product's current stock quantity in the product management interface (both the product list and
  the product edit view). The system MUST reject any attempt to set stock to a negative number,
  whether on create or edit.
- **FR-036b**: The admin product list MUST let an administrator readily identify which products
  are currently Sold Out (stock = 0, per FR-015a) — e.g., a visible status indicator per row —
  distinct from which products are hidden/unavailable (FR-038), since the two are independent
  states.
- **FR-036c**: When adding or editing a product, the administrator MUST choose the product's
  category from the set of existing, valid categories through a simple, clear selection control
  (e.g., a dropdown/select listing every active category by name) — never by typing a free-text
  category value. A product MUST always be associated with exactly one valid category; the system
  MUST reject saving a product with no category or with a category that does not exist.
- **FR-037**: An administrator MUST be able to mark a product as Best Seller or remove that
  designation, and mark a product as New Arrival or remove that designation, independently of each
  other.
- **FR-038**: An administrator MUST be able to control a product's storefront **visibility**
  (shown vs. hidden from the catalog entirely) as a setting distinct and independent from stock
  quantity. Reaching 0 stock automatically makes a product Sold Out (FR-015a) but does not hide
  it; hiding a product is always a separate, explicit administrator action.
- **FR-039**: Product changes made by an administrator — including any stock update — MUST be
  reflected in the live storefront data customers see — the admin experience and storefront MUST
  operate on the same persisted product records.

**Admin — Order Management**

- **FR-040**: An administrator MUST be able to view all orders, search orders, and filter orders.
- **FR-041**: An administrator MUST be able to open an individual order and see its customer
  information, delivery information, purchased products, quantities, total price, payment method,
  and current status.
- **FR-042**: An administrator MUST be able to change an order's status among the defined statuses
  (Pending, Confirmed, Preparing, Shipped, Delivered, Cancelled), and this change MUST be
  immediately reflected to the customer.

**Admin — Customer Management**

- **FR-043**: An administrator MUST be able to view the list of registered customers, open an
  individual customer's record, and see that customer's profile information and order history.

**Admin — Dashboard**

- **FR-044**: The admin dashboard MUST display total sales, total orders, total customers, total
  products, a list of recent orders, and best-selling products, all computed from persisted store
  data (not fixed or sample figures).
- **FR-045**: Total sales MUST be calculated from orders that have not been cancelled (a cancelled
  order's amount MUST NOT count toward total sales), and best-selling products MUST be ranked by
  total quantity sold across non-cancelled orders.

**Data Integrity**

- **FR-046**: Every product record MUST retain, at minimum, name, description, price, a valid
  reference to exactly one category (FR-007d/FR-036c), images, material, available colors/options,
  a non-negative stock quantity, an administrator-controlled visibility/availability flag
  (independent of stock, per FR-038), New Arrival and Best Seller designations, and its creation
  date. Sold Out (FR-015a) is never stored as its own field — it is always derived at read time
  from `stock === 0`, so it can never drift out of sync with the actual stock number.
- **FR-046a**: Every category record MUST retain, at minimum, name, description, a display order
  (governing the sequence categories appear in on the homepage's Featured Categories section,
  storefront navigation, and the Shop page's category switcher), and an active/inactive state.
  Only active categories MUST be offered for selection when adding/editing a product (FR-036c) or
  shown in customer-facing category navigation; an inactive category's own page and any products
  still assigned to it are not required to remain reachable through navigation, but existing
  products keep their category reference regardless. The catalog MUST support adding further
  categories later purely as new category records, with no redesign of the browsing experience
  required (spec Assumptions).
- **FR-047**: Every order record MUST retain the purchase-time snapshot of product name and price
  for each ordered item, so that later edits or deletion of the underlying product do not alter the
  historical accuracy of any past order.
- **FR-048**: All customer-facing and admin-facing data (products, categories, users, carts,
  wishlists, orders, order items, administrator authorization) MUST be backed by real, persistent
  storage; the storefront and admin area MUST NOT rely on hardcoded or fabricated data as their
  operating data source. Seed data MAY be used only for development/testing purposes.

**Cross-Cutting Quality**

- **FR-049**: The system MUST present appropriate loading, success, validation-error, operational-
  error, and empty states for every user-facing operation described above, without silently losing
  or corrupting cart, wishlist, order, or account data on failure.
- **FR-050**: The entire storefront and admin experience MUST function correctly and remain
  production-ready across the full common range of device sizes — small and large smartphones
  (including iPhone and Android), tablets (including iPad), small and standard laptops, desktop
  computers, and large desktop monitors — using a **mobile-first, fluidly responsive** approach
  (layouts adapt continuously to available width and to orientation changes) rather than a fixed
  set of discrete device breakpoints designed in isolation. This applies to every storefront area
  (header, navigation and hamburger menu, hero, Featured Categories, New Arrivals, Best Sellers,
  Special Offers, product grids for every category including Bracelets/Rings/Earrings/Watches,
  product cards, product detail and its image gallery, search, filters, sorting, wishlist, cart,
  checkout, order confirmation, login, registration, account, order history, about, contact, and
  footer) and to the entire Admin Dashboard, with the primary customer flow (Home → Shop →
  Product → Add to Cart → Cart → Checkout → Place Order → Order Confirmation) and the primary
  admin flow (Admin Login → Dashboard → Products / Orders / Customers) fully usable on mobile as a
  first-class experience, not a secondary/degraded one.
- **FR-050a**: The product grid MUST adapt its column count naturally and progressively as
  available width increases — as a guideline, not a rigid fixed layout: roughly 2 columns on
  small smartphones, roughly 2–3 columns on tablets, roughly 3–4 columns on laptops/desktops, and
  on large desktop monitors the grid MUST use the available space elegantly (e.g., a wider
  multi-column layout and/or a constrained maximum content width) rather than stretching product
  cards to excessive width.
- **FR-050b**: On phone-width viewports, the system MUST specifically ensure: navigation collapses
  into a clean hamburger menu where appropriate; search, Wishlist, Cart, and Account remain
  reachable from every page; product images scale correctly without distortion or overflow;
  product information (name, price, description) remains readable without excessive shrinking;
  Add to Cart and quantity controls are sized as touch-friendly targets easy to tap accurately;
  SOLD OUT labels (spec FR-015a) remain clearly visible and legible; filters and sorting controls
  are usable without visually overcrowding the screen (e.g., via a collapsible panel/sheet rather
  than cramming every control inline); and checkout forms fit naturally within the viewport width
  without requiring horizontal scrolling.
- **FR-050c**: On smaller screens, the product detail page's image gallery and product information
  MUST stack vertically; on larger screens (laptop/desktop), the page MUST use an elegant
  multi-column layout (e.g., gallery beside product information) where appropriate.
- **FR-050d**: Cart and checkout MUST remain fully usable on small mobile screens without relying
  on a desktop-style wide table that forces horizontal scrolling — cart line items MUST adapt into
  a mobile-friendly stacked/card-style layout at narrow widths rather than a fixed multi-column
  table row.
- **FR-050e**: The Admin Dashboard MUST also be fully responsive on mobile/tablet: admin
  navigation MUST collapse appropriately; product management, order management, and customer
  management MUST all remain usable; dashboard statistic cards MUST reorganize responsively
  (e.g., stacking or wrapping rather than being forced into a fixed wide row); wide data tables
  MUST use an appropriate mobile presentation (e.g., a responsive card layout, prioritized/hidden
  columns, or deliberately controlled horizontal scrolling confined to the table itself rather than
  the whole page); and Add/Edit Product forms — including stock quantity management (spec
  FR-036a) — MUST remain fully usable at narrow widths.
- **FR-050f**: Product and jewelry images MUST be responsive and optimized: preserving their
  aspect ratio at every width, never causing layout overflow, never downloading an unnecessarily
  oversized image for the rendering size, remaining sharp on high-density ("Retina"-class)
  displays, and using appropriately sized image variants per viewport rather than one fixed
  resolution for all screens.
- **FR-050g**: Normal application pages MUST NOT produce unintended horizontal scrolling on mobile
  devices — any horizontal scroll that does occur (e.g., within an admin data table, per FR-050e)
  MUST be intentional and confined to that specific element, never the page as a whole.
- **FR-050h**: Typography, spacing, headings, buttons, and section layout MUST scale
  appropriately between the smallest and largest supported screen sizes, and the ELORA JEWELLERY
  Burgundy + Gold + Cream/Ivory visual identity (spec FR-051) MUST remain visually consistent at
  every screen size — responsive adaptation changes layout and sizing, never the brand's colors,
  tone, or logo treatment. Responsive behavior MUST also preserve accessibility at every size:
  readable text, sufficient color contrast, keyboard accessibility, visible focus states,
  touch-friendly control sizing, and accessible navigation (spec FR requirements are unaffected by
  viewport — see also Constitution Principle 16).
- **FR-051**: The system MUST consistently use the official ELORA JEWELLERY logo (never a
  generated or substitute logo, and never auto-recolored) and MUST maintain the brand's visual
  identity — deep burgundy/wine red as the primary brand color, elegant metallic gold as the
  accent, warm cream/soft ivory/light beige as secondary backgrounds, and burgundy or very dark
  neutral text on light backgrounds with cream/ivory text on burgundy backgrounds — across every
  storefront and admin page, avoiding bright red, orange, pink-heavy palettes, rose-gold/champagne
  as a primary metallic accent, chocolate/brown as the main brand color, or other bright/unrelated
  colors.
- **FR-052**: Public storefront pages (home, shop, product detail, collections, about, contact)
  MUST use semantic, search-engine-friendly structure and metadata sufficient for search engines to
  index and correctly represent products and categories.

**Progressive Web App (Installability)**

- **FR-053**: The storefront MUST be installable, where the visitor's browser/platform supports
  web app installation, on iPhone, iPad, Android phones, Android tablets, Windows computers, Mac
  computers, and other modern browsers/platforms that support it. This MUST be the same responsive
  Next.js ELORA JEWELLERY application serving every device and the installed experience — not a
  separate application, and not an iPhone-only or single-platform app.
- **FR-054**: The system MUST provide a valid web app manifest declaring, at minimum: the
  application name "ELORA JEWELLERY," a short name, a description, a start URL, a scope, standalone
  display mode, a theme color and background color drawn from the official Burgundy + Gold +
  Cream/Ivory palette (spec FR-051) — never the previous chocolate/champagne/rose-gold palette —
  and a set of application icons.
- **FR-055**: Application iconography (including any maskable icon variant, Apple Touch Icon, and
  favicon/browser icons) MUST use the official ELORA JEWELLERY logo supplied by the project owner.
  The logo itself MUST NOT be regenerated, substituted, or altered; where a platform requires
  specific icon padding or a background treatment for compatibility (e.g., a maskable icon's safe
  zone), only the surrounding icon canvas MUST be adapted, never the logo artwork itself
  (Constitution Principle 2).
- **FR-056**: When launched from an installed icon on a platform that supports standalone display,
  the application MUST open without ordinary browser chrome/address bar and MUST present a
  polished, brand-consistent launch/loading moment before the storefront becomes interactive.
- **FR-057**: Every feature available in the ordinary browser experience — storefront browsing,
  cart, wishlist, account, checkout, and order history — MUST behave identically when running as an
  installed app: the same live, authoritative data and validation rules apply; installation MUST
  NOT create a second, divergent version of the store.
- **FR-058**: The system MUST offer a clear, unobtrusive "Install ELORA JEWELLERY App" option on
  platforms/browsers where a programmatic install capability is available, and MUST NOT
  aggressively interrupt the shopper with it (e.g., not immediately on page load, not repeatedly
  after she has already dismissed it or already installed the app).
- **FR-059**: On a platform/browser where no programmatic install prompt is available (for
  example, iOS Safari), the system MUST instead present clear, accurate, platform-appropriate
  manual installation instructions (e.g., "use the Share menu, then Add to Home Screen") rather
  than a non-functional install control or a claim of a one-tap install that platform does not
  actually support.
- **FR-060**: The system MUST detect when the application is already running as an installed app,
  or when the current browser does not support installation, and MUST NOT show install prompting
  in either case.
- **FR-061**: A basic offline experience MUST be provided: when connectivity is unavailable, the
  system MUST present a clear, professional, ELORA-branded offline/fallback message (not a generic
  browser error page) rather than a broken page; cached safe/static content (e.g., branding, static
  page shell) MAY remain visible, and the interface MUST clearly communicate when a requested
  operation requires connectivity.
- **FR-062**: Any client-side caching used to support installability or offline behavior MUST be
  limited to safe, non-sensitive static assets (application shell, official brand assets, fonts,
  and other genuinely public storefront resources). It MUST NOT cache, and MUST NOT allow a
  shopper or administrator to act on cached/stale values for, authoritative commerce data —
  product prices, stock quantities, Sold Out state (spec FR-015a), cart validation, checkout
  totals, order data, customer information, or admin information. All such data MUST continue to
  be served and validated through the approved Firebase/server-side architecture on every request
  that needs it, exactly as in the ordinary browser experience.
- **FR-063**: Checkout and order creation MUST require a successful round-trip to the trusted
  server/Firebase backend in every context, installed or not; the system MUST NOT create an order,
  or present any indication that an order was created, while offline or while that round-trip has
  not succeeded.
- **FR-064**: The installed application MUST remain fully responsive — across the same device
  range required of the ordinary browser experience (spec FR-050) — and MUST support touch, mouse,
  and, where applicable, keyboard interaction.
- **FR-065**: The install option, the offline/fallback experience, and the installed application
  itself MUST remain accessible: keyboard-operable where applicable, with accessible labels,
  visible focus states, readable status messaging, sufficient contrast, and respect for a
  reduced-motion preference (Constitution Principle 16).

**Bilingual Support (Arabic / English)**

- **FR-066**: The system MUST support two languages — Arabic (AR) and English (EN) — across the
  entire customer-facing storefront, customer account, checkout, order confirmation, the
  installed PWA (including its offline/fallback experience), and every relevant Admin Dashboard
  interface used to manage bilingual content, plus SEO-facing metadata.
- **FR-067**: The system MUST provide a clearly accessible language switcher in the primary
  storefront navigation (desktop: integrated elegantly into the Navbar without crowding it;
  mobile: reachable via the header or hamburger menu without displacing Cart, Wishlist, Search,
  Account, Instagram, or WhatsApp), letting the customer switch between Arabic and English at
  any time. The switcher MUST also be present and functional when ELORA JEWELLERY is running as
  an installed PWA.
- **FR-068**: Once a customer selects a language, the system MUST persist that choice and apply
  it automatically as she navigates, after a page refresh, across relevant future visits, and in
  installed PWA mode where the platform allows — she MUST NOT be asked to choose a language again
  on every page.
- **FR-069**: When Arabic is active, the system MUST render the interface in proper right-to-left
  (RTL) layout and set the document's language and direction accordingly; when English is active,
  the system MUST render left-to-right (LTR) with the document's language and direction set to
  English. Arabic MUST NOT be implemented as translated text inside an interface that remains
  visually left-to-right.
- **FR-070**: Correct RTL/LTR behavior MUST extend to every part of the experience: navigation,
  hamburger menu, language switcher itself, headings and text alignment, forms, search, filters,
  sorting, product cards, product details, cart, wishlist, checkout, account, order history,
  footer, Instagram/WhatsApp actions (including the floating WhatsApp control), PWA install UI,
  offline UI, dialogs, error messages, empty states, and loading states. Directionally-sensitive
  icons (e.g., "next"/"back" chevrons) MUST be mirrored appropriately for RTL; the official ELORA
  logo and product/jewelry photography MUST NOT be mirrored, since there is no genuine directional
  reason to flip brand or product imagery.
- **FR-071**: Every piece of customer-facing interface text MUST have both an Arabic and an
  English version — including, at minimum, all primary navigation labels, page titles, product/
  cart/wishlist/checkout/account actions and labels (e.g., Add to Cart, Add to Wishlist, Move to
  Cart, Continue Shopping, Proceed to Checkout, Place Order), filter/sort labels, availability and
  quantity labels, SOLD OUT / New Arrival / Best Seller / Special Offers labels, empty states,
  loading states, error messages, form validation messages, the "Install ELORA JEWELLERY App"
  control and related installation guidance, offline/fallback messages, Instagram/WhatsApp
  labels, and footer content (including Shipping & Delivery, Returns & Exchange, Privacy Policy,
  Terms & Conditions).
- **FR-072**: The four core categories MUST display correctly in both languages — English
  "Bracelets"/"Rings"/"Earrings"/"Watches" and their approved Arabic equivalents ("أساور",
  "خواتم", "أقراط", "ساعات") — on both the dedicated category pages and the homepage category
  showcases. The underlying category identity/reference (spec FR-007d) MUST remain
  language-independent: switching language MUST NEVER create a different category record, break a
  category URL, or change which products belong to a category.
- **FR-073**: Every homepage category showcase (spec FR-001a) MUST be fully bilingual: its title,
  subtitle/tagline, call-to-action text, and relevant accessibility labels/SEO metadata MUST have
  both an Arabic and an English version, without changing which category the showcase links to.
- **FR-074**: Products MUST support bilingual customer-facing content — at minimum, name,
  description, material, and option/color display labels — entered by the store owner/admin, not
  produced by automatic machine translation at page-render time. If a product has not yet been
  given Arabic content, the system MUST fall back to a clearly defined behavior (e.g., showing the
  English content) rather than a blank or broken field (see Edge Cases).
- **FR-075**: The admin product management interface MUST provide clearly distinguished English
  and Arabic fields for name, description, material, and option/color labels (e.g., labeled
  "Product Name — English" / "Product Name — Arabic"), so an administrator can confidently tell
  which field is which.
- **FR-076**: Categories MUST support localized (Arabic/English) name, description, and
  SEO-relevant content, entered by an administrator, while keeping the category's internal
  identifier, slug/URL, and product relationships stable and language-independent (spec FR-007d,
  FR-046a).
- **FR-077**: Checkout MUST be fully bilingual — form field labels, validation messages, the order
  summary, and payment method (including "Cash on Delivery") all localized, with correct RTL form
  behavior in Arabic and LTR in English. Regardless of the selected language, prices MUST come
  from trusted Firestore data, stock MUST be revalidated server-side, totals MUST be recalculated
  server-side, and order creation MUST remain trusted server-side behavior exactly as already
  required (spec FR-020–FR-026) — language selection MUST NEVER influence an authoritative
  checkout calculation.
- **FR-078**: Order statuses (Pending, Confirmed, Preparing, Shipped, Delivered, Cancelled, spec
  FR-030) MUST display to the customer in her selected language, while the underlying stored
  status value MUST remain a single, language-independent value — the system MUST NEVER store a
  translated string as the authoritative status.
- **FR-079**: An order's historical item snapshot (spec FR-047) MUST remain reliable even after a
  product's translations are later edited or a product is deleted — the snapshot MUST preserve
  enough bilingual purchase-time information that the order remains understandable to the
  customer in the language(s) relevant at purchase.
- **FR-080**: The Instagram and WhatsApp controls' labels/tooltips/accessibility text (spec
  FR-006a–FR-006g) MUST support both languages. The configurable WhatsApp greeting message MUST
  support an English and an Arabic version, and the pre-filled greeting used when a customer taps
  WhatsApp MUST reflect her currently selected language where a localized greeting is configured;
  the centralized configuration and "no fake contact info" requirements (spec FR-006a/FR-006b)
  remain unchanged.
- **FR-081**: PWA-facing UI — the install control, installation guidance (including iOS "Add to
  Home Screen" instructions), and the offline/fallback experience (spec FR-053–FR-065) — MUST be
  localized, and the selected language MUST be preserved in installed mode where the platform
  allows. This MUST remain the same one responsive ELORA JEWELLERY web application/PWA serving
  both languages — never two separate applications.
- **FR-082**: Public storefront pages MUST support localized SEO metadata for both languages —
  page titles, meta descriptions, product/category/homepage metadata, and Open Graph metadata
  where applicable — with a URL and canonical/hreflang strategy that avoids duplicate-content SEO
  problems between the Arabic and English versions of a page, without breaking existing product/
  category routing (spec FR-007a, FR-052).
- **FR-083**: The language switcher and every localized interactive control MUST remain
  accessible: an accessible name, keyboard operability, a visible focus state, touch-friendly
  sizing, and correct, immediate updates to the document's language and direction attributes when
  toggled (Constitution Principle 16).
- **FR-084**: If a shopper's browser/device is set to a language other than Arabic or English, the
  system MUST fall back to the default language (English) rather than erroring or displaying
  untranslated placeholder text.
- **FR-085**: The Admin Dashboard MUST support managing bilingual content for products, categories,
  and homepage category showcases; operational/internal values — record identifiers, Firestore
  references, price, stock, roles, order status codes, category relationships, and availability
  flags — MUST remain language-independent and MUST NEVER be translated or stored as localized
  values.

**Delivery Location Selection**

- **FR-086**: The system MUST provide a location/region selector, clearly accessible from the
  storefront Navbar/Header, limited to exactly the service regions ELORA JEWELLERY supports —
  **West Bank** ("الضفة الغربية") and **Inside / 1948 Areas** ("الداخل") — and MUST NOT present a
  worldwide/general country selector or any region outside these two.
- **FR-087**: Activating the selector MUST open a premium modal/drawer, consistent with the
  Burgundy + Gold + Cream identity (spec FR-051), that: shows the two supported regions; lets the
  shopper search for and select a supported city/area within a chosen region; shows her currently
  selected location if one is set; lets her change it; and provides a clear close action. The
  interaction pattern MAY draw inspiration from a supplied reference for the general "premium
  region-selector" concept, but the resulting design, wording, and any imagery/assets MUST be
  ELORA JEWELLERY's own — never another brand's exact design, assets, or copy.
- **FR-088**: Within the selector, city/area search MUST work by name in both Arabic and English,
  and the displayed list MUST show localized city/area names matching the shopper's current
  storefront language.
- **FR-089**: The set of supported West Bank and Inside/1948 cities/areas MUST be maintainable by
  an authorized administrator without a source-code change; any example city/area list referenced
  during planning is illustrative only, not a fixed or final set of supported delivery locations.
- **FR-090**: Once a shopper selects a location, the system MUST persist that selection, preserve
  it while she navigates the site, after a page refresh, and in installed PWA mode where the
  platform allows, and let her change it at any later time — she MUST NOT be asked to re-select on
  every page. For a registered customer, the selection MAY be associated with her account profile
  where appropriate; for a guest, a safe local/session-based persistence mechanism MUST be used.
- **FR-091**: The customer's selected region and city/area MUST prefill the corresponding delivery
  fields at checkout, and she MUST still be able to review and change them there before placing
  the order — the selector is a convenience default, never a value checkout silently locks in
  without her ability to confirm or change it (spec FR-020).
- **FR-092**: Before an order is created, the system MUST validate the checkout's delivery
  region/city server-side against the currently active supported-location configuration — the
  same authoritative-revalidation principle already required for stock and pricing (spec FR-026)
  applies to delivery location. An order MUST NEVER be created for a location that is not
  currently active and supported, regardless of what was cached, previously selected, or shown
  offline.
- **FR-093**: If a shopper's checkout attempt targets an unsupported or since-deactivated
  city/area, the system MUST reject the order, present a clear, localized message, and let her
  choose a different supported location — it MUST NOT silently create the order, silently
  substitute a different location, or invent a delivery promise, fee, or delivery time that has
  not been separately configured by the store.
- **FR-094**: The Admin Dashboard MUST provide delivery-location management: viewing supported
  regions and cities/areas, adding a city/area, editing a city/area's bilingual name, activating/
  deactivating it, and reordering the list — all without requiring a source-code change for normal
  delivery-coverage updates.
- **FR-095**: A delivery location's internal identifier and its region association MUST remain
  language-independent and stable; switching the storefront's active language MUST NEVER change,
  clear, or invalidate a shopper's already-selected location — only its displayed label changes
  (consistent with spec FR-072's treatment of category identity).
- **FR-096**: The location selector, its search input, its selected-state feedback, and its close
  action MUST meet the same accessibility bar already required of every interactive control:
  accessible dialog semantics, keyboard navigation, a visible focus state, an accessible label on
  the search input, touch-friendly sizing, correct RTL/LTR behavior, and screen-reader-friendly
  feedback of the current selection (Constitution Principle 16).
- **FR-097**: The location selector MUST remain fully responsive and usable in installed PWA
  standalone mode, consistent with the storefront's general responsive and PWA requirements (spec
  FR-050, FR-053–FR-065); on mobile, a bottom-sheet/full-height-drawer presentation is
  acceptable where it keeps search and selection easy to tap and avoids horizontal overflow.
- **FR-098**: Delivery-location selection is a customer convenience/preference and MUST NOT
  introduce additional public, separately-indexed SEO pages (e.g., a page per city) unless that is
  a distinct, separately-approved requirement in the future.

### Key Entities

- **User**: A person who can authenticate with the store; has a role of registered customer or
  administrator, along with profile information (name, contact details) and credentials. A guest
  is a visitor without an authenticated User record.
- **Product**: A jewelry item offered for sale; has bilingual (English/Arabic) name, description,
  material, and option/color labels, price, category, image(s), available colors/options, a
  non-negative admin-managed stock quantity, an admin-controlled visibility/availability flag, New
  Arrival and Best Seller designations, and creation date. **Sold Out** is not a stored attribute
  of a Product — it is always the derived state `stock === 0`, automatically true or false, never
  manually set. The product's identifier, slug/URL, category relationship, price, and stock remain
  language-independent; only its customer-facing display text is bilingual.
- **Category**: A taxonomy grouping every product belongs to, each with its own dedicated,
  bilingual storefront page (e.g., Bracelets/أساور, Rings/خواتم, Earrings/أقراط, Watches/ساعات).
  The category's identifier and slug/URL remain language-independent; only its display name/
  description are bilingual.
- **Category Showcase**: A large, full-width, admin-maintainable homepage merchandising section
  for one core category — bilingual title/subtitle/CTA text, desktop and mobile imagery, a
  reference to the category it promotes, a display order, and an active/visible state. Distinct
  from the Featured Categories quick-entry cards and from a Collection.
- **Collection**: A curated grouping of products for merchandising purposes (e.g., New Arrivals,
  Best Sellers, Special Offers), which may span multiple categories.
- **Cart**: A customer's (guest or registered) in-progress set of selected products and quantities,
  prior to order placement.
- **Cart Item**: A single product/quantity line within a Cart, valid only within current stock
  limits.
- **Wishlist**: A registered customer's saved set of products for later consideration.
- **Wishlist Item**: A single product entry within a Wishlist.
- **Order**: A persisted, confirmed purchase; has a unique order number, customer information,
  delivery information (including a bilingual snapshot of the region/city selected at purchase
  time), ordered items with purchase-time pricing, subtotal, total, payment method, status, and
  creation timestamp.
- **Order Item**: A single product line within an Order, preserving the bilingual product name,
  price, and quantity as they were at the time of purchase, independent of later product edits or
  translation changes.
- **Delivery Region**: One of exactly two ELORA JEWELLERY service areas — West Bank or Inside/1948
  Areas — with a bilingual display name and a stable, language-independent identifier.
- **Delivery Location**: A supported city/area within a Delivery Region; has a bilingual name, an
  admin-controlled active/inactive state, a display order, and a stable, language-independent
  identifier. The store owner determines the actual supported set; it is not fixed by this
  specification.
- **Administrator Authorization**: The designation that grants a User access to admin-only
  operations, enforced by the system on every admin request.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time shopper can go from the homepage to a completed order confirmation in
  under 5 minutes without external help.
- **SC-002**: At least 95% of checkout attempts with valid, complete information result in a
  successfully created order on the first submission.
- **SC-003**: 100% of successfully placed orders appear correctly and completely (items,
  quantities, total, payment method, status) in both the customer's order history and the
  administrator's order list.
- **SC-004**: 100% of product changes made by an administrator (price, stock, description, images,
  category, availability, Best Seller/New Arrival flags) are reflected on the live storefront
  without requiring any customer-side workaround.
- **SC-005**: 0% of attempts by a non-administrator to perform an admin-only operation succeed,
  whether attempted through the visible interface or directly.
- **SC-006**: 0% of orders are created for a quantity that exceeds available stock at the moment of
  order submission, and 0% of successfully created orders ever drive any product's stock below 0.
- **SC-006a**: 100% of products whose stock reaches 0 automatically display as "SOLD OUT" (product
  card and detail page) and become non-purchasable within the same read that reflects the updated
  stock — no admin action beyond the stock update itself is required, and no Sold Out product can
  be successfully checked out.
- **SC-007**: 100% of past orders retain accurate item names and prices even after the underlying
  product has since been edited or deleted by an administrator.
- **SC-008**: The complete primary customer flow (Home → Shop → Product → Add to Cart → Cart →
  Checkout → Place Order → Order Confirmation) and the complete primary admin flow (Admin Login →
  Dashboard → Products / Orders / Customers) are each fully usable — no broken or dead-end steps,
  no unintended horizontal page scrolling, no overlapping or clipped content — at representative
  small-smartphone, large-smartphone, tablet, laptop, and desktop viewport widths, and every
  storefront area listed in FR-050 renders correctly at each of those widths.
- **SC-008a**: 100% of interactive controls used in the primary customer and admin flows (buttons,
  form inputs, quantity steppers, links) meet a touch-friendly minimum target size on
  phone-width viewports, verified as part of the mobile-viewport E2E/manual pass (quickstart.md).
- **SC-009**: An administrator can locate a specific order or customer record via search/filter in
  under 30 seconds from the admin order or customer list.
- **SC-010**: The dashboard's total sales, total orders, total customers, total products, recent
  orders, and best-selling products figures match what can be independently verified from the
  underlying persisted order and product records at any point in time.
- **SC-011**: 100% of products shown on a given category's dedicated page (Bracelets, Rings,
  Earrings, or Watches) actually belong to that category — 0% cross-category leakage — and every
  category is reachable within two clicks/taps from the homepage and from the storefront
  navigation on both desktop and mobile.
- **SC-012**: On a platform/browser that supports installation, a shopper can install ELORA
  JEWELLERY and, on first launch, sees the correct app name, the official logo as its icon, and a
  standalone window (no browser chrome) in under the same load-time expectations as the ordinary
  site; on a platform without a programmatic install prompt (e.g., iOS Safari), 100% of shoppers
  are instead shown accurate manual installation instructions rather than a non-functional or
  misleading install control.
- **SC-013**: 0% of offline or connectivity-interrupted checkout attempts result in an order being
  created or in any success indication being shown to the shopper; 100% of such attempts instead
  show a clear message that connectivity is required.
- **SC-014**: 0% of cached/offline content ever displays a product price, stock quantity, Sold Out
  state, cart total, order detail, or account/admin information that is not freshly confirmed from
  the live Firebase/server-side backend — cached content is limited to safe static branding/shell
  assets.
- **SC-015**: 100% of Instagram and WhatsApp controls — in the navbar, the footer, and the
  floating WhatsApp button — open the correct configured destination (or fail safely per FR-006h
  if unconfigured), and 0% of them ever reference a hardcoded or independently-duplicated URL/phone
  number rather than the single centralized configuration.
- **SC-016**: 0% of instances of the floating WhatsApp button visually cover Add to Cart, checkout/
  buy controls, cart controls, primary navigation, PWA install controls, cookie notices, forms, or
  product information, across small-phone through large-desktop viewports.
- **SC-017**: 100% of the four homepage category showcases (Bracelets, Rings, Earrings, Watches)
  render with correct imagery/title/CTA, link to their correct dedicated category page, and their
  accompanying featured-products selection shows 0% cross-category leakage and correctly reflects
  live Sold Out state.
- **SC-018**: A shopper can switch language from the Navbar in one action; 100% of storefront text
  covered by FR-071 renders in the selected language, and the choice survives a refresh and a full
  guest checkout without being re-asked.
- **SC-019**: 100% of pages render with the document direction/language attributes matching the
  selected language (RTL for Arabic, LTR for English), and 0% of authoritative checkout/order
  calculations differ based on the selected language.
- **SC-020**: 100% of products and categories an administrator has entered Arabic content for
  display that Arabic content when Arabic is selected; a product/category with no Arabic content
  yet falls back to English rather than showing a blank or broken field.
- **SC-021**: 100% of the time, the location selector presents exactly the two approved service
  regions (West Bank, Inside/1948 Areas) — 0% instances of a worldwide/general country list.
- **SC-022**: A shopper can search and select a supported city/area in under 15 seconds from
  opening the selector, in either language; her selection persists across a refresh and a full
  checkout without being re-asked.
- **SC-023**: 0% of orders are created for a delivery city/area that is not active/supported at
  the moment of order submission, even if it was previously selected, cached, or shown offline.

## Assumptions

- Categories and Collections are treated as distinct-but-overlapping concepts: Category is the
  product taxonomy (Bracelets, Rings, Earrings, Watches) every product belongs to; Collection is
  a curated merchandising grouping (New Arrivals, Best Sellers, Special Offers) that can span
  categories. This resolves the ambiguity the request flagged between the two terms.
- Each category's dedicated page is reached via its own route (e.g., `/shop/category/bracelets`)
  rather than reusing the product-detail path (`/shop/[productSlug]`), to avoid any risk of a
  category slug colliding with a product slug at the same URL depth.
- Total sales and best-selling products are calculated excluding cancelled orders, with
  best-selling ranked by cumulative quantity sold rather than order count (FR-045). This resolves
  the ambiguity the request flagged around dashboard statistics.
- Guest checkout is supported: registration is never required to place an order (FR-031a). Guest
  order data (name, phone, email, address) is captured directly at checkout and used to create the
  order; without an account, a guest cannot later browse an authenticated order-history list, but
  her order still exists as a full, persisted store record accessible to admins and (via her order
  number/email, if the store chooses to offer that) to her directly.
- The wishlist is registered-customers-only: a guest attempting to use it is prompted to sign in or
  register, and no wishlist data is stored for her until she does (FR-033a).
- Contact details, footer legal text (Privacy Policy, Terms & Conditions, Shipping & Delivery,
  Returns & Exchange), and social media URLs (Instagram, TikTok, WhatsApp) are store-provided
  configuration content, not invented; the footer and contact page structure is defined here, but
  the actual text/links are supplied by the store owner before or during implementation.
- The official ELORA JEWELLERY logo and exact brand imagery are supplied by the store owner as
  existing assets, not generated as part of this feature.
- "Popularity" for the popularity sort and "best-selling products" on the dashboard are both based
  on cumulative quantity sold across non-cancelled orders, consistent with FR-045.
- Product options such as color/variant do not require independent stock tracking per option in
  this feature; stock quantity is tracked at the product level. Per-variant stock could be a future
  enhancement if the store's catalog requires it.
- Administrator accounts are provisioned by the store owner/existing administrators (e.g., through
  initial setup or an existing admin inviting another); public self-registration does not grant
  administrator access.
- "Related products" on the product detail page are drawn from the same category as the viewed
  product.
- "Small smartphone," "large smartphone," "tablet," "small laptop," "standard laptop," "desktop,"
  and "large desktop monitor" (FR-050) are treated as a continuous range of viewport widths the
  layout adapts fluidly across, not as a fixed enumerated list of exact device breakpoints —
  representative widths for manual/automated verification are chosen during implementation
  (research.md) and can be updated as device usage evolves, without changing this requirement's
  intent.
- Install support genuinely varies by browser/platform (spec FR-058/FR-059): platforms offering a
  programmatic install prompt (e.g., Chromium-based browsers on Android, Windows, and macOS) get
  the one-tap "Install ELORA JEWELLERY App" option; iOS/iPadOS Safari does not expose a
  programmatic install API as of this writing, so those platforms are served accurate manual
  "Add to Home Screen" instructions instead — this is a real, documented platform limitation being
  represented accurately, not a gap being silently left unaddressed.
- The official Instagram profile URL and WhatsApp business phone number have not been supplied as
  of this specification; the centralized configuration for them (spec FR-006a) is defined and
  ready to receive the real values, and every Instagram/WhatsApp control is built to fail safely
  (spec FR-006h) until they are provided — this mirrors the same "store-provided, not invented"
  treatment already established for footer/contact content (spec FR-005/FR-006) and is not a new
  kind of ambiguity.
- The WhatsApp default greeting message ("Hello ELORA JEWELLERY, I would like to ask about a
  product.") is a configurable default, not a fixed requirement — the store owner may change or
  clear it via the same centralized configuration without any code change.
- Bilingual support covers exactly Arabic and English at this stage; the language/localization
  architecture (FR-066–FR-085) is not assumed to hard-code "two languages only" at every layer,
  but adding a third language is explicitly out of scope for this feature and is not required to
  be effortless — only Arabic/English are approved requirements here.
- Product and category translations are administrator-entered, store-approved content, never
  produced by automatic machine translation at render time (per the brief's explicit instruction);
  a product/category without Arabic content yet displays its English content until an
  administrator provides the Arabic version (see Edge Cases).
- The homepage's four category showcases are additive to, and sit between, the existing approved
  Hero and the existing Featured Categories/New Arrivals/Best Sellers/Special Offers/brand
  sections — none of those previously-approved sections are removed or replaced by this feature.
- Any visual reference supplied for the "large editorial full-width category showcase" concept is
  inspiration for that layout pattern only; ELORA JEWELLERY's own logo, photography, copy, and
  Burgundy + Gold + Cream identity are used throughout, never another brand's assets.
- The example West Bank and Inside/1948 city/area lists (e.g., Nablus, Ramallah, Al-Bireh, Jenin,
  Tulkarm, Qalqilya, Bethlehem, Hebron, Jericho, Salfit) are illustrative starting/seed content
  only, not the final or complete supported delivery coverage — the store owner determines and
  maintains the actual supported set through the Admin Dashboard (spec FR-089/FR-094).
- Any visual reference supplied for the location-selector interaction pattern is inspiration for
  the "premium region-selection modal" concept only; ELORA JEWELLERY's own design, wording, and
  assets are used throughout, never another brand's exact design, assets, or copy (spec FR-087).
- Delivery fees and delivery-time estimates are out of scope for this requirement unless
  separately configured elsewhere — the location selector and checkout validation confirm *that*
  a city/area is serviced, not a specific price or timeframe for delivering there (spec FR-093).
