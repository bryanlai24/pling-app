#!/bin/bash
set -e

PROJECT="pling-app-alpha"
SERVICE="pling-server"
REGION="us-central1"
IMAGE="gcr.io/$PROJECT/$SERVICE"

# Require version tag argument
if [ -z "$1" ]; then
  echo "Usage: ./deploy-backend.sh <version>"
  echo "  Example: ./deploy-backend.sh v3"
  exit 1
fi

VERSION="$1"
TAGGED_IMAGE="$IMAGE:$VERSION"

echo "🔨 Building $TAGGED_IMAGE..."
docker build --no-cache --platform linux/amd64 -t "$TAGGED_IMAGE" .

echo "📤 Pushing $TAGGED_IMAGE..."
docker push "$TAGGED_IMAGE"

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$TAGGED_IMAGE" \
  --platform managed \
  --region "$REGION"

echo "🔍 Checking revisions..."
gcloud run revisions list --service "$SERVICE" --region "$REGION"

# Get the latest revision name
LATEST=$(gcloud run revisions list \
  --service "$SERVICE" \
  --region "$REGION" \
  --format="value(name)" \
  --limit=1)

echo "🔀 Shifting 100% traffic to $LATEST..."
gcloud run services update-traffic "$SERVICE" \
  --to-revisions "$LATEST=100" \
  --region "$REGION"

echo "✅ Done! $SERVICE is live at:"
gcloud run services describe "$SERVICE" --region "$REGION" --format="value(status.url)"
