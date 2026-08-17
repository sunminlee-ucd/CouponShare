# CouponShare

CouponShare is a mobile-first grocery voucher sharing project built for a closed community in Ireland.

## Current production scope

The live product currently focuses on **Dunnes Stores voucher sharing**. Members can upload eligible vouchers, reserve an approved voucher for a limited period, reveal the voucher when needed, report problems, and track usage. The backend includes moderation, rate limits, reservation limits, expiry handling, and database-backed state.

The current production application is intentionally private and access-controlled while the product is tested with a small group.

## Implemented Lidl prototype

The repository also retains a **feature-flagged Lidl Plus prototype** as part of the project's engineering history and portfolio. It is not part of the current live product and is disabled by default with `NEXT_PUBLIC_LIDL_ENABLED=false`.

The Lidl implementation demonstrates:

- browser-side coupon extraction and activation through a bookmarklet and browser extension
- structured coupon import into CouponShare
- client-side QR detection, cropping, and fingerprinting
- coupon matching and card comparison logic
- receipt parsing and client-side OCR experiments
- PostgreSQL persistence and cross-member coupon state
- QR reveal limits, duplicate detection, reporting, and moderation controls

Keeping this implementation in the repository is intentional: it documents a previous product track and demonstrates technical capabilities that are not required by the current Dunnes-only production experience.

## Architecture

- React 19 + TypeScript
- vinext + Vite
- PostgreSQL / Supabase
- Drizzle ORM and parameterised SQL
- Google Cloud Run deployment
- Cloud Build container pipeline
- client-side image processing / QR recognition
- private access gate and admin moderation

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the production/portfolio split and the main data flows.

## Safety and privacy

CouponShare uses an access-controlled private test flow, same-origin checks on state-changing API calls, rate limits, moderation controls, and user data export/deletion endpoints. Sensitive production values are supplied through environment variables or secret management and are not committed to the repository.

## Independence

CouponShare is an independent project and is not affiliated with or endorsed by Dunnes Stores or Lidl. Product names and trademarks belong to their respective owners.

## Copyright

Copyright © 2026 Sunmin Lee. All rights reserved. See `LICENSE` and `docs/IP_PROVENANCE.md`.
