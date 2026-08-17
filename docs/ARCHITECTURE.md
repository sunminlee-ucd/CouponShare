# CouponShare Architecture

## Product status

CouponShare currently operates as a private **Dunnes Stores voucher-sharing** application.

A previously implemented **Lidl Plus** feature set remains in the repository behind the `NEXT_PUBLIC_LIDL_ENABLED` feature flag. It is intentionally retained as a portfolio and engineering-history module rather than being part of the current production experience.

This distinction is important:

- **Dunnes**: current live product path
- **Lidl**: implemented, tested, feature-flagged portfolio path

## High-level architecture

```text
Mobile / Browser
      |
      v
Private access gate
      |
      v
React / vinext application
      |
      +---------------------------+
      |                           |
      v                           v
Dunnes production path       Lidl portfolio path
      |                           |
      v                           v
Next-style API routes        Import / QR / matching logic
      |                           |
      +-------------+-------------+
                    |
                    v
             PostgreSQL / Supabase
                    |
                    v
             Google Cloud Run
```

## Dunnes production path

The Dunnes flow is the current operational product surface.

### Main responsibilities

- voucher image upload and client-side compression
- barcode and expiry extraction assistance
- voucher persistence
- admin review / approval
- atomic reservation flow
- reservation expiry and release
- daily reservation quotas
- controlled voucher reveal
- usage tracking
- reporting and moderation

### Concurrency

Voucher reservation is executed in a database transaction so the daily reservation counter and voucher state change succeed or fail together. This reduces the chance of two users successfully reserving the same voucher.

## Lidl portfolio path

The Lidl implementation remains intentionally available in source control while disabled in production.

### Implemented capabilities

- bookmarklet-based DOM automation
- browser extension prototype
- coupon activation detection and extraction
- structured payload import
- local-to-server coupon synchronisation
- client-side QR recognition and cropping
- QR fingerprint and image-hash duplicate detection
- coupon matching and card comparison
- receipt parsing and OCR experiments
- shared QR reveal quotas
- abuse scoring, reporting, and moderation

This module demonstrates browser integration and client-side processing techniques beyond the needs of the current Dunnes product.

## Identity model

The private alpha currently uses a device-bound UUID stored in browser local storage to associate a browser with a profile. This keeps onboarding lightweight for a closed test.

For a broader public release, this identity model should be replaced or supplemented with a stronger authenticated account model.

## Storage

Application state is persisted in PostgreSQL through Drizzle ORM and parameterised SQL.

Some image payloads are currently stored directly as encoded image data for the private prototype. The original storage design included private object storage. Moving larger binary assets to private object storage is the preferred scaling path if usage expands.

## Security and abuse controls

The project includes:

- private access-code gate
- signed HttpOnly session cookie
- same-origin checks for state-changing routes
- API rate limits
- per-user quotas
- duplicate QR detection
- report-driven hiding and admin moderation
- user blocking
- account export and deletion endpoints

## Deployment

The production application is packaged as a Node.js container and deployed to Google Cloud Run in `europe-west1`.

The documented Cloud Build trigger targets pushes to `main`. Feature and documentation work should therefore be reviewed with deployment impact in mind before updating the `main` ref.

## Portfolio intent

The repository intentionally preserves completed technical work that is not currently exposed in production when that work demonstrates useful engineering capability. Such code should remain clearly labelled, feature-flagged where appropriate, and separated conceptually from the live product path so that reviewers can distinguish active production scope from historical or portfolio implementations.
