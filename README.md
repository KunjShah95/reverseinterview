# OfferGuard AI — Production README

This repository contains the OfferGuard AI web app. The project is optimized for deployment to **Vercel** using TanStack Start's built-in Nitro integration.

Quick start (local):

1. Copy environment variables:

   cp .env.example .env

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
- For Vercel deployment, simply connect your GitHub repository to the Vercel dashboard. It will auto-detect the TanStack Start (Nitro) configuration.

Vercel setup checklist:

1. Import the GitHub repo into Vercel.
2. Keep the default build command as `npm run build`.
3. Use `dist` as the output directory.
4. Add the environment variables from `.env.example` in the Vercel project settings.
5. Set `VITE_SITE_URL` to your deployed domain, for example `https://your-project.vercel.app`.
6. Redeploy after any env var changes.

The app already includes a Vercel serverless entrypoint in `api/index.js`, so no extra adapter step is needed.

Notes

- Ensure you fill in Vercel's environment variables with the required runtime secrets (see `.env.example`).
- The project targets Vercel by default.

AI provider

- This app uses the Vercel AI SDK with provider adapters for Groq, Mistral, Gemini, and OpenRouter.
- Put API keys in environment variables:
  - `GROQ_API_KEY` for Groq
  - `MISTRAL_API_KEY` for Mistral
  - `GOOGLE_GENERATIVE_AI_API_KEY` for Gemini
  - `OPENROUTER_API_KEY` for OpenRouter
- Choose the active provider and model with:
  - `DEFAULT_AI_PROVIDER` (`groq`, `mistral`, `gemini`, or `openrouter`)
  - `DEFAULT_AI_MODEL` (for example `llama-3.3-70b-versatile`, `mistral-large-latest`, or `gemini-2.0-flash`)

The provider abstraction lives in `src/lib/ai-provider.server.ts`.
