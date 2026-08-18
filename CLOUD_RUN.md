# CouponShare Cloud Run deployment

The production service runs as a Node.js container on port `8080`.

## First deployment

```powershell
gcloud auth login
.\scripts\deploy-cloud-run.ps1 -ProjectId "YOUR_GOOGLE_CLOUD_PROJECT_ID"
```

This enables the required APIs, builds the repository `Dockerfile` with Cloud
Build, stores the image in Artifact Registry, and deploys the public
`couponshare-ireland` Cloud Run service in `europe-west1`.

## Apply a new local version

Run the same deployment script again. Cloud Run builds a new immutable image
and sends 100% of traffic to the new revision after it becomes healthy.

## PostgreSQL connection

The application reads its Supabase transaction-pooler connection from the
`DATABASE_URL` environment variable. Store that value in Google Secret Manager
and bind the secret to Cloud Run; do not put the password in this repository or
in `cloudbuild.yaml`. See `SUPABASE_SETUP.md` for the database migration and
connection check.

The private invite code and its session signing key are derived from the existing
`ADMIN_PASSWORD` secret. The derived invite code is visible only on `/admin`, so
no additional Secret Manager entry is required.

## User account authentication

Account auth uses Supabase Auth while preserving the existing device-key profile
as the application data owner. Before enabling account login in production:

1. Apply `supabase/migrations/20260818070000_auth_profiles.sql`.
2. Set `SUPABASE_URL` on Cloud Run.
3. Set `SUPABASE_PUBLISHABLE_KEY` on Cloud Run. The publishable key is safe for
   user-facing Auth requests, but this implementation still keeps it server-side.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only for privileged Supabase work.
5. Keep `AUTH_REQUIRED=false` during provider configuration and rollout testing.
6. Configure the Google and Apple providers and the `/auth/callback` redirect in
   Supabase Auth. See `docs/AUTH_SETUP.md`.
7. After email, Google, Apple, cross-device profile recovery, and logout are
   verified, set `AUTH_REQUIRED=true` if all normal users should be required to
   sign in.

Changing these runtime variables does not require committing secrets to the
repository. Do not add real Supabase or provider credentials to `cloudbuild.yaml`.

## Deploy every push to `main`

Connect `sunminlee-ucd/CouponShare` on the Cloud Build Triggers page and create
a push trigger for `^main$` using `cloudbuild.yaml`. The trigger builds an image
tagged with the Git commit SHA, pushes it to Artifact Registry, and deploys that
exact image to Cloud Run.
