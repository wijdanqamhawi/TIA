<!--
Sync Impact Report (amendment 2026-08-26, v1.0.0 → 2.0.0)
- Version change: 1.0.0 → 2.0.0
- Rationale: Principle 2 (Official Brand Identity) redefines its normative color requirements —
  the previously ratified palette (deep dark brown/chocolate as the main brand color; champagne/
  rose-gold as the primary metallic accent) is replaced by the now-official ELORA JEWELLERY
  palette (deep burgundy/wine red as the primary brand color; elegant metallic gold as the
  accent; warm cream/soft ivory/light beige as secondary backgrounds). This is a redefinition of
  existing principle content, not mere wording clarification — a design compliant with the old
  palette would now fail Principle 2 — so per the Governance versioning policy this is a MAJOR
  bump. No principle was added or removed; the principle's *scope and intent* (a required,
  non-negotiable, consistent luxury brand palette; the official logo is never regenerated) are
  unchanged, only the specific colors that satisfy it.
- Principle modified: 2. Official Brand Identity — palette redefined from
  chocolate/dark-brown + champagne/rose-gold + beige/cream to burgundy/wine-red + elegant gold +
  cream/ivory/beige; added explicit guidance that the logo asset itself must be preserved exactly
  (never auto-recolored) if its own colors would otherwise be affected by the palette change; added
  explicit prohibited-color list (bright red, orange, pink-heavy, rose-gold/champagne as primary
  metallic, chocolate/brown as main color, neon, excessive gradients); added "timeless" to the
  required brand feel alongside luxury/elegant/feminine/premium/sophisticated/minimal.
- Sections added/removed: none (Governance and the other 22 principles are unchanged).
- Templates requiring alignment (not modified by this command; flagged for follow-up): none new —
  the plan/spec/tasks templates were already generic with respect to specific brand colors; only
  the feature-level planning artifacts (`specs/001-core-commerce-experience/*`) embed the palette
  and are updated alongside this amendment.
- Deferred TODOs: none.

Sync Impact Report (original ratification 2026-08-26)
- Version change: (unratified template) → 1.0.0
- Rationale: Initial ratification of the ELORA JEWELLERY project constitution. The prior file
  on disk was the unfilled Spec Kit scaffold (all placeholder tokens); this is the first
  concrete adoption, so MAJOR version 1.0.0 applies.
- Principles defined (23, project-specified count, superseding the template's 5-slot default):
  1. Production-Ready E-Commerce
  2. Official Brand Identity
  3. Mobile-First Responsive UX
  4. Simple Customer Journey
  5. Simple Admin Journey
  6. Secure Authentication and Authorization
  7. Real Data Persistence
  8. Reliable Commerce State
  9. Reliable Order Creation
  10. Inventory Integrity
  11. Maintainable Architecture
  12. Type Safety
  13. Input Validation
  14. Error Handling
  15. Security
  16. Accessibility
  17. Performance
  18. SEO
  19. Testing
  20. Incremental Implementation
  21. No Silent Assumptions
  22. Documentation
  23. Quality Over Shortcuts
- Sections added: Core Principles (23 principles), Governance
- Sections removed: Template's generic [SECTION_2_NAME] / [SECTION_3_NAME] free-form
  sections were not populated — all project constraints are fully covered by the 23
  numbered principles above, so retaining empty generic sections would add no value.
- Templates requiring alignment (not modified by this command; flagged for follow-up):
  - .specify/templates/plan-template.md — verify Constitution Check gates reference these
    23 principles (esp. #6 authz separation, #7 real persistence, #9 order integrity).
  - .specify/templates/spec-template.md — verify no placeholder conflicts.
  - .specify/templates/tasks-template.md — verify phased/incremental task structure
    reflects Principle 20 (Incremental Implementation).
- Deferred TODOs: none. Ratification date set to the date of this adoption.
-->

# ELORA JEWELLERY Constitution

## Core Principles

### 1. Production-Ready E-Commerce
ELORA JEWELLERY is a production-grade luxury jewelry e-commerce application built for real
customers — never a prototype or visual mockup. All implemented features MUST work as part of
a real online store: frontend, backend, database, authentication, cart, wishlist, checkout,
orders, customer accounts, and admin functionality MUST operate together as one complete,
integrated system. A feature that only looks correct in isolation, without a working data path
end to end, does not satisfy this principle.

### 2. Official Brand Identity
The official ELORA JEWELLERY logo is the primary brand asset and MUST NOT be replaced by a
generated, placeholder, or substitute logo under any circumstance; if the logo's own colors would
otherwise be affected by a palette change, the logo asset itself MUST be preserved exactly as
supplied rather than being recolored to match. Visual identity MUST remain consistent with the
official ELORA JEWELLERY palette: deep burgundy / wine red as the primary brand color, elegant
metallic gold as the accent (refined, not bright yellow, and not overused to the point of
appearing cheap), and warm cream / soft ivory / light beige as secondary backgrounds, with deep
burgundy or very dark neutral text on light backgrounds and cream/ivory text on burgundy
backgrounds. The brand experience MUST feel luxury, elegant, feminine, premium, sophisticated,
minimal, and timeless. Bright red, orange, pink-heavy palettes, rose-gold or champagne as a
primary metallic accent, chocolate/dark brown as the main brand color, neon colors, random accent
colors, excessive gradients, and visually inconsistent colors are all prohibited. Any new UI
surface MUST be checked against this palette and tone before being considered complete.

### 3. Mobile-First Responsive UX
Every public and authenticated page MUST be designed mobile-first and MUST work correctly on
iPhone, Android, tablet, laptop, and desktop viewports. The mobile shopping experience is a
first-class requirement, not an afterthought retrofitted onto a desktop layout — layouts,
touch targets, and navigation MUST be validated at mobile breakpoints first.

### 4. Simple Customer Journey
The primary customer flow MUST remain clear and frictionless: Home → Shop → Product → Add to
Cart → Checkout → Place Order → Order Confirmation. New features MUST NOT introduce
unnecessary steps, dead ends, or ambiguity into this path. Any deviation or added step must be
justified by a genuine business or legal requirement (e.g., age verification, mandatory
consent).

### 5. Simple Admin Journey
The primary admin flow MUST remain clear: Admin Login → Dashboard → Products / Orders /
Customers. Administrative tooling MUST stay focused on these core operations rather than
accumulating unrelated complexity.

### 6. Secure Authentication and Authorization
Authentication MUST be implemented securely (proper password handling, session/token
management, no credential leakage). Customer and admin authorization MUST be strictly
separated. Normal users MUST NEVER gain access to admin functionality, whether through the UI,
direct API calls, or manipulated requests. Protected functionality MUST enforce authorization
server-side on every request — hiding a button or route in the UI is never sufficient on its
own.

### 7. Real Data Persistence
Products, categories, users, carts, wishlists, orders, order items, customer data, and
administrative data MUST be stored in a real, persistent database. Hardcoded fake data MUST
NEVER serve as the application's primary data source. Seed data MAY be used, but only for
development and testing purposes, and MUST be clearly distinguishable from production data
paths.

### 8. Reliable Commerce State
Cart, wishlist, account information, order history, product availability, and order status
MUST remain consistent across navigation and across authenticated sessions where applicable.
A user MUST NOT see stale, duplicated, or lost state when moving between pages, reloading, or
returning to the app in a later session.

### 9. Reliable Order Creation
A successful checkout MUST create a persisted order containing, at minimum: a unique order
number, customer information, delivery information, ordered products, product quantities, a
pricing snapshot, subtotal, total, payment method, order status, and an order creation
timestamp. Order creation MUST be atomic with respect to these fields — a checkout MUST NOT
produce a partially-recorded or ambiguous order.

### 10. Inventory Integrity
Product stock MUST be represented accurately at all times. The application MUST prevent
invalid purchase quantities (zero, negative, or exceeding available stock). Stock-related
behavior MUST be handled consistently whenever orders are created, updated, or cancelled, so
that stock counts never silently drift from reality.

### 11. Maintainable Architecture
The codebase MUST maintain clear separation of concerns. User interface, business logic,
validation, authentication, authorization, database access, and domain models MUST remain
modular and independently maintainable. Unnecessary duplication and tightly coupled code MUST
be avoided; shared logic belongs in shared, reusable modules rather than being copy-pasted
across features.

### 12. Type Safety
Application data and business entities MUST use strong typing throughout the codebase.
Untyped or loosely-typed representations of core domain concepts (products, orders, users,
cart items, etc.) are not acceptable in production code paths.

### 13. Input Validation
All external and user-provided input MUST be validated before database persistence or business
processing. This applies to, at minimum: authentication forms, profile data, product data,
cart quantities, checkout data, admin updates, and order status changes. Validation MUST occur
server-side regardless of any client-side validation already performed.

### 14. Error Handling
User-facing operations MUST provide appropriate loading states, success states, validation
errors, operational errors, and empty states. Failures MUST be surfaced clearly and MUST NOT
silently corrupt application state (e.g., a failed order write must never appear to the
customer as a successful checkout).

### 15. Security
Secrets and credentials MUST NEVER be exposed to client-side code. Sensitive routes and
operations MUST be protected server-side. Environment variables MUST be used to hold secrets,
never hardcoded values. Database and authentication errors MUST NOT expose sensitive
implementation details (stack traces, query text, internal identifiers) to end users.

### 16. Accessibility
The storefront and admin dashboard MUST use semantic structure and accessible interaction
patterns. At minimum: form controls MUST have labels, images MUST have meaningful alt text,
interactive elements MUST be keyboard accessible where appropriate, color contrast MUST remain
readable, focus states MUST remain visible, and responsive typography MUST remain usable at
all supported viewport sizes.

### 17. Performance
Real-world performance MUST be favored throughout the application. This includes optimized
images, responsive image delivery, efficient data loading, appropriate caching, efficient
database queries, minimal unnecessary client-side JavaScript, and loading states wherever data
is fetched asynchronously.

### 18. SEO
Public storefront pages MUST support semantic page structure, useful metadata, search-friendly
URLs, product metadata, category metadata, and appropriate indexing behavior, so that store and
product pages are discoverable and correctly represented in search results.

### 19. Testing
Critical commerce flows MUST be testable and MUST have test coverage proportional to their
business risk. Priority areas include: registration, login/logout, authorization, product
browsing, search/filter/sort, product details, cart behavior, wishlist behavior, checkout
validation, order creation, customer order history, admin product management, admin order
status updates, and protected admin access.

### 20. Incremental Implementation
The application MUST NOT be built in one uncontrolled implementation pass. Implementation MUST
proceed in structured phases, with validation between major areas (e.g., data model and auth
before checkout, checkout before admin order management), so that each phase can be verified
before the next begins.

### 21. No Silent Assumptions
Ambiguous business requirements MUST be surfaced and clarified rather than silently invented.
When a specification, plan, or task is unclear about business behavior (pricing rules, stock
edge cases, order status transitions, etc.), the ambiguity MUST be raised explicitly instead of
being resolved by guesswork.

### 22. Documentation
The finished project MUST document: project structure, dependency installation, environment
variables, database setup, admin account creation, product management, test order procedure,
deployment, domain connection, and the production launch process. Documentation MUST stay
accurate enough that a new contributor could set up and operate the project from it alone.

### 23. Quality Over Shortcuts
Security, data integrity, maintainability, responsiveness, and accessibility MUST NOT be
sacrificed merely to complete a feature faster. When time pressure and quality conflict, the
conflict MUST be surfaced rather than silently resolved in favor of speed.

## Governance

This constitution supersedes all other project practices, conventions, and ad hoc decisions
for ELORA JEWELLERY. It applies to every future specification, implementation plan, task list,
analysis, and implementation produced for this project.

**Amendment procedure**: Amendments MUST be proposed as an explicit update to this file (via
the `/speckit-constitution` workflow or equivalent), MUST state the principle(s) affected, and
MUST include a Sync Impact Report describing what changed and why. Amendments take effect once
committed to `.specify/memory/constitution.md`.

**Versioning policy**: This constitution follows semantic versioning:
- **MAJOR** — backward-incompatible removal or redefinition of a principle.
- **MINOR** — a new principle or materially expanded governance guidance is added.
- **PATCH** — clarifications, wording fixes, or non-semantic refinements.

**Compliance review**: Every specification, implementation plan, and task list MUST be checked
against these 23 principles before implementation proceeds, and any deviation MUST be called
out explicitly (per Principle 21, No Silent Assumptions) rather than passed over silently.
Pull requests and reviews for this project MUST verify compliance with this constitution;
unjustified complexity or scope that conflicts with these principles MUST be resolved before
merge.

**Version**: 2.0.0 | **Ratified**: 2026-08-26 | **Last Amended**: 2026-08-26
