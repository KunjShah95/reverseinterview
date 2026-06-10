# OfferGuard AI

AI-powered job offer analysis. Paste a job description, offer letter, or recruiter chat and get instant insights on toxicity, burnout risk, salary fairness, ghost hiring, and negotiation strategy.

## Tech Stack

- **Framework:** TanStack Start (React 19 + Vite)
- **Styling:** Tailwind CSS v4
- **AI Providers:** Groq, Mistral, Gemini, OpenRouter (via Vercel AI SDK)
- **Auth & Storage:** Firebase (Google sign-in, Firestore)
- **PDF Generation:** jsPDF
- **OCR:** Tesseract.js + pdf.js
- **Testing:** Playwright

## Quick Start

```bash
cp .env.example .env   # fill in API keys
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run test:e2e` | Run Playwright tests |

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DEFAULT_AI_PROVIDER` | `groq`, `mistral`, `gemini`, or `openrouter` |
| `DEFAULT_AI_MODEL` | Model name for the chosen provider |
| `GROQ_API_KEY` | Groq API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `VITE_FIREBASE_*` | Firebase web app config |

## Deployment

### Vercel (recommended)

1. Import the GitHub repo into Vercel
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add environment variables from `.env.example`
5. Set `VITE_SITE_URL` to your deployed domain

### Docker

```bash
docker build -t offerguard-ai .
docker run -p 3000:3000 --env-file .env offerguard-ai
```

## CI/CD

GitHub Actions runs on every push and PR to `main`:

- **Lint & Typecheck** — ESLint + TypeScript compilation
- **Build** — Verify production build succeeds
- **E2E Tests** — Playwright tests against the built app

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Project Structure

```
src/
  routes/          # TanStack Router file-based routes
  components/      # React components
  lib/             # Utilities, AI providers, Firebase, analysis logic
  hooks/           # Custom React hooks
tests/             # Playwright E2E tests
```
