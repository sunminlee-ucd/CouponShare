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

## Deploy every push to `main`

Connect `sunminlee-ucd/CouponShare` on the Cloud Build Triggers page and create
a push trigger for `^main$` using `cloudbuild.yaml`. The trigger builds an image
tagged with the Git commit SHA, pushes it to Artifact Registry, and deploys that
exact image to Cloud Run.
