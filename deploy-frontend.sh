#!/bin/bash
set -e

echo "🔨 Building frontend..."
cd pling-client
npm run build

echo "🚀 Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Done!"
