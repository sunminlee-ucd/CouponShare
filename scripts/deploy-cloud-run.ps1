param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [string]$Region = "europe-west1",
  [string]$Service = "couponshare-ireland"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Google Cloud CLI(gcloud)가 설치되어 있지 않습니다."
}

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy $Service `
  --project $ProjectId `
  --region $Region `
  --source . `
  --allow-unauthenticated `
  --port 8080 `
  --quiet

gcloud run services describe $Service `
  --project $ProjectId `
  --region $Region `
  --format="value(status.url)"
