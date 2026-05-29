# OfferGuard AI — Production README

This repository contains the OfferGuard AI web app. The project is configured to deploy to Cloudflare Workers (see `wrangler.jsonc`). The repo also includes a Dockerfile if you prefer a container-based deployment.

Quick start (local):

1. Copy environment variables:

   cp .env.example .env
   # Fill in values in .env

2. Install dependencies and run dev server:

   npm ci
   npm run dev

Production build (local):

   npm ci
   npm run build

To run in Docker (example):

   docker build -t offerguard-ai:latest .
   docker run -p 3000:3000 --env-file .env --rm offerguard-ai:latest

CI/CD
- The `CI` workflow runs lint/typecheck/build on pushes and PRs to `main`.
- The `Deploy to Cloudflare Workers` workflow publishes the `main` branch to Cloudflare using `cloudflare/wrangler-action`. Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub secrets.

Notes
- Ensure you fill in `.env` with the required runtime secrets (see `.env.example`).
- The project targets Cloudflare Workers by default; adjust `wrangler.jsonc` if needed.
