# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Restaurant guests ordering from a phone at a table, without creating an account.
- Restaurant administrators and staff managing orders, menus, dining tables, payments at the till, and guest feedback.
- Kitchen staff handling incoming orders on a tablet.
- BirTapCard super administrators overseeing restaurant tenants and service activity.

## Product Purpose

BirTapCard Restaurant System lets a guest scan a table QR code or NFC tag, browse the venue's menu, place an order for that table, follow its progress, and leave feedback after service. Restaurant staff manage the menu and fulfilment from a shared web system.

## Positioning

The guest reaches the correct venue and table through one QR/NFC link and can order without registration or an app. Existing BirTapCard scan analytics remain a separate product capability.

## Operating Context

- Primary guest use is one-handed mobile web at a restaurant table in Uzbekistan.
- Staff use the admin panel; kitchen staff use a simplified tablet display.
- The first demo tenant is Bella Italia with tables 1–8 and synthetic menu data.
- Guests pay at the restaurant till in the first release; staff record payment status and method.

## Capabilities and Constraints

- Restaurant data is tenant-scoped. Restaurant A must not read or change Restaurant B data.
- Public menu access is limited to a published active venue, its active table, and available menu items.
- Orders are created server-side with prices recalculated from database records.
- Customer order tracking uses an unguessable tracking token and exposes only status details.
- Payment providers (Payme, Click, Uzum Bank) are future integrations; do not simulate a payment.
- Database schema and RLS ship as a forward-only Supabase migration. Applying it requires access to the user's Supabase project.
- Exact deployment domain, legal terms, retention periods, real menu photography, and production venue records are undecided.

## Brand Commitments

- Product name: BirTapCard Restaurant System.
- Slogan: «Меню. Заказ. Сервис — в один тап».
- Use the existing BirTapCard identity: graphite, white, mint/turquoise, and green accents; premium, legible, mobile-first interfaces.

## Evidence on Hand

- Existing BirTapCard NFC/QR dashboard and scan flows in this repository.
- Bella Italia menu and tables are synthetic demo data, not evidence of a real customer or sale.
- Existing PDP School/EcoSystem pages are separate existing product work; they are not evidence of restaurant-ordering deployments.

## Product Principles

1. A scan should resolve the venue and table without asking the guest to identify either.
2. Guests can order without registration or an app.
3. The server owns prices, order totals, and tenant authorization.
4. Each role sees only the data and controls needed for its work.
5. Payment and external integrations must be real or clearly unavailable, never simulated.

## Accessibility & Inclusion

- Use semantic controls, keyboard-accessible dialogs, visible focus, clear status text, and reduced-motion support.
- Support mobile screens from 360px wide and tablet kitchen displays.
