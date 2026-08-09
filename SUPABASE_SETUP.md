# Supabase PostgreSQL setup

CouponShare uses ordinary PostgreSQL tables and a `DATABASE_URL`. This keeps the
database portable to Google Cloud SQL later.

## 1. Create the project

1. Create a Supabase project in a European region.
2. Open **SQL Editor**.
3. Run `supabase/migrations/202608090001_initial.sql` once.

The migration creates profiles, sharing groups, memberships, Lidl cards,
coupons, coupon-use history, and the private `qr-codes` Storage bucket.

## 2. Connect locally

1. In **Connect**, select the **Transaction pooler** connection string.
2. Copy `.env.example` to `.env.local`.
3. Put the pooler connection string in `DATABASE_URL` and replace its password.
4. Run `pnpm dev`, then open `/api/database`.

A successful connection returns:

```json
{ "connected": true, "provider": "postgresql" }
```

## 3. Connect Cloud Run

Store `DATABASE_URL` in Google Secret Manager rather than source control, grant
the Cloud Run service account access, and expose it to the service as the
`DATABASE_URL` environment variable. Subsequent image deployments retain the
secret binding.

## Data behavior in this stage

- Imported active coupons are upserted into PostgreSQL automatically.
- Used and restored coupon states are written to PostgreSQL.
- If the database is temporarily unavailable, the current device keeps working
  from its local copy and retries on the next visit.
- QR images are not yet uploaded. The schema stores only a private Storage
  object path so QR bytes never enter PostgreSQL.

## Cloud SQL migration later

The application reads only `DATABASE_URL`, and the schema uses standard
PostgreSQL. Export with `pg_dump`, restore into Cloud SQL, replace
`DATABASE_URL`, and redeploy. Supabase Storage objects must be copied separately
to Google Cloud Storage.
