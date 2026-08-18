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

## User account authentication

Account auth uses Supabase Auth while preserving the existing device-key profile
as the application data owner. The previous invitation/access-code gate is retired.
For the current production guest-browsing model:

1. Apply `supabase/migrations/20260818070000_auth_profiles.sql`.
2. Set `SUPABASE_URL` on Cloud Run.
3. Set `SUPABASE_PUBLISHABLE_KEY` on Cloud Run. The publishable key is safe for
   user-facing Auth requests, but this implementation still keeps it server-side.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only for privileged Supabase work.
5. Optionally set `AUTH_SESSION_SECRET`; otherwise the user-session secret is
   derived from the existing strong `ADMIN_PASSWORD`.
6. Keep `AUTH_REQUIRED=false`. This allows logged-out visitors to browse the main
   page and Dunnes listings.
7. Configure direct email/password auth, the Google provider, and the
   `/auth/callback` redirect in Supabase Auth. See `docs/AUTH_SETUP.md`.
8. Dunnes write and reveal requests are still protected server-side and return
   `401 auth_required` without a valid CouponShare user session.
9. Set `AUTH_REQUIRED=true` only if the entire normal application should become
   login-only in the future.

Changing these runtime variables does not require committing secrets to the
repository. Do not add real Supabase or Google credentials to `cloudbuild.yaml`.

## Deploy every push to `main`

Connect `sunminlee-ucd/CouponShare` on the Cloud Build Triggers page and create
a push trigger for `^main$` using `cloudbuild.yaml`. The trigger builds an image
tagged with the Git commit SHA, pushes it to Artifact Registry, and deploys that
exact image to Cloud Run.
