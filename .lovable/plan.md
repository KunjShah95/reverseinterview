## Reverse Interview AI — Build Plan

A multi-agent web app where candidates upload a job description, offer letter, HR chat screenshot, or just a company name, and get back a "should I join?" verdict with toxicity flags, burnout risk, salary fairness, fake-hiring detection, reverse interview questions, and a simulation of life after joining.

### Stack
- TanStack Start (existing, React 18 + TS + Vite under the hood) + Tailwind
- `lucide-react` for all icons
- Lovable Cloud (Postgres + Storage) for: analysis persistence, file uploads, anonymous session history
- Lovable AI Gateway (`google/gemini-3-flash-preview` default, `google/gemini-2.5-pro` for the orchestrator + simulation) for all agents
- Firecrawl connector for company website + public review lookup
- `pdf-parse` (pure JS, Worker-safe) for PDF text; Gemini multimodal for screenshot OCR — no native deps
- All animations as Tailwind `transition-*` classes — no Framer Motion

### Visual Direction — Organic "Editorial Green" landing
Lifted from the supplied spec — applied across landing + sub-pages so the brand stays consistent:

**Color tokens** (mapped into `src/styles.css` via oklch):
| Token | Hex |
|---|---|
| `--ink` (primary text/buttons) | `#1f2a1d` |
| `--ink-2` | `#2d3a2a` |
| `--ink-hover` | `#2a3827` |
| `--body` | `#4b5b47` |
| `--heading` | `#336443` |
| `--heading-accent` | `#85AB8B` |
| `--cta` | `#3d5638` (hover `#2d4228`) |
| `--surface` | warm off-white background under the video |

Risk colors (used **only** inside report chips/heatmap, never on landing): emerald=safe, amber=caution, rose=danger.

**Typography**: Inter 300/400/500/600/700 loaded in `__root.tsx` head via Google Fonts preconnect. Body stack falls back to `'Neue Haas Grotesk Display Pro 55 Roman', 'Helvetica Neue', Helvetica, Arial, sans-serif`. Hero headings use the spec's exact sizing: `text-[2rem] sm:text-4xl md:text-5xl lg:text-[4.75rem] xl:text-[5.25rem]`, `leading-[0.95]`, `letter-spacing: -0.035em`. Heading accent words rendered in `--heading-accent` (lighter green) inline.

**Boomerang video background**: A `BoomerangVideoBg` component is built exactly per the supplied implementation — hidden `<video>` captures frames into canvas at max width 960px, then plays forward/backward at 30fps on a display canvas. Used on the landing hero. Video source can be swapped, but the provided CloudFront URL is the default placeholder; the candidate-facing demo can use a calmer abstract loop (we'll generate or source one fitting the editorial feel).

**Navigation** (used on every page):
- Glass pill nav `bg-white/70 backdrop-blur-md rounded-full pl-6 pr-1 py-1 shadow-sm border border-white/60`
- Brand "ReverseHire™" left, nav links + "Try it Live" pill center (desktop)
- Right side: "Sign Me Up!" (`UserPlus`) + "Enter" (`LogIn`) — since we're auth-less these become "Save Report" + "History"
- Mobile: white pill hamburger (`Menu`/`X` cross-fade rotate), full-screen drawer with staggered link transitions (delays `150ms + i*70ms`), CTA group at delay `400ms` — exact CSS-only animations from the spec

**Bottom-left CTA block** (landing): brand mark + `FluxEngine™`-style sub-product callout → for us this becomes "TruthScore™ engine" with a short paragraph + dark-green CTA button + "Know More" link to `/how-it-works`.

**Bottom-right**: small circular `Play` button + "How we build?" + duration — links to a demo report.

### Pages (TanStack file routes)
```
src/routes/
  index.tsx                  # Landing — boomerang video hero, editorial green
  how-it-works.tsx           # The Process (sub-page, same nav + palette)
  pricing.tsx                # Tariffs placeholder (free MVP, paid teased)
  analyze.tsx                # Input wizard (4 modes, paper/cream surface)
  report.$id.tsx             # Multi-agent report (cards on cream, green accents)
  history.tsx                # Anonymous past analyses (localStorage sessionId)
  api/
    analyze.ts               # POST → orchestrates agents → analysis id
    extract.ts               # POST → PDF/image/url → normalized text
    company-lookup.ts        # POST → Firecrawl careers + reviews
```
Shared `<SiteNav />` + `<SiteFooter />` components reuse the pill nav + mobile drawer across all routes. Every route gets its own `head()` with unique title/description/og.

### Hero copy (landing)
Headline: **"Close the rift between offer letters and *reality*."** — last word in `--heading-accent` italic-ish weight.
Subhead: "Reverse Interview AI reads the job post, the offer, the HR chat — and tells you what working there will actually feel like."
Primary CTA: "Analyze a job →" (dark green pill) · Secondary: "See sample report" (underline link).

### Input wizard (`/analyze`)
Surface switches to a warm cream/off-white card on the green-tinged background. Four tabs:
1. **Paste JD** — large textarea, monospace `--body`
2. **Upload PDF** — drag-drop, server `pdf-parse`
3. **Screenshot** — image → Gemini vision OCR
4. **Company name** — Firecrawl maps + scrapes careers page + summary + top public reviews

Optional fields: offered salary, role title, location, years of experience (feeds Salary agent).

### Multi-Agent Orchestration (server fn `runAnalysis`)
All agents run in parallel via `Promise.all`, each = one Gateway call returning structured output via `tools` schema. Orchestrator merges the outputs into the final verdict.

| Agent | Output |
|---|---|
| **Culture/Toxicity** | `flags[]: { phrase, location, hiddenMeaning, severity }`, `toxicityScore` |
| **Burnout Predictor** | `burnoutRisk 0-100`, `overtimeProbability`, `signals[]` |
| **Salary Analyst** | `verdict: underpaid|fair|overpaid`, `marketRangeEstimate`, `confidence`, `reasoning` |
| **Fake Hiring Detector** | `ghostScore`, `signals[]` (urgency, repost cues, vague responsibilities) |
| **Negotiation Coach** | `talkingPoints[]`, `counterOffer{}`, `redLines[]` |
| **Reverse Interview Generator** | 8–12 sharp `questions[]: { q, why, category }` |
| **HR Lie Detector** | Compares offer/HR claims vs scraped reviews → `mismatches[]` with confidence |
| **Simulation Mode** | 6mo / 1yr / 2yr narrative + `growth`, `stress`, `learning`, `promotionProbability` |
| **Orchestrator** | `truthScore{transparency, wlb, growth, hiringIntegrity, compFairness}` + final `recommendation: proceed|caution|avoid` + one-line verdict |

Prompt rules across all agents: cite exact quotes as evidence, mark `confidence: low|med|high`, use "possible interpretation" — never definitive accusations.

### Report page (`/report/$id`)
Sticky verdict header in dark green. Sections, single column on cream:
1. **Verdict hero** — large serif-feel verdict, company name, truth score donut
2. **Truth Score breakdown** — 5 bars
3. **Offer Risk Heatmap** — grid of JD sections, green/amber/rose with hover-to-see-quote
4. **Toxicity flags** — phrase + hidden meaning + severity chip
5. **Burnout & Ghost-hiring** — twin cards with gauges
6. **Salary fairness** — verdict chip + range visualization
7. **HR Lie Detector** — "claim" vs "evidence from reviews"
8. **Reverse Interview Questions** — copyable, grouped by category
9. **Simulation** — 3 horizontal cards (6mo/1yr/2yr)
10. **Negotiation Playbook**
11. Footer disclaimer (interpretive, not factual claims)

### Database (Lovable Cloud)
```
analyses(id uuid pk, session_id text, company text, source_type text,
         source_text text, source_file_url text, structured_input jsonb,
         result jsonb, status text, created_at timestamptz)
```
RLS: read/write where `session_id = current_setting('app.session_id')` set via header from client. Storage bucket `uploads` (private) for PDFs/screenshots.

### Demo path
"See sample report" button on landing loads a canned toxic JD ("fast-paced family culture, wear many hats, urgent hire") and runs the full pipeline so judges see the magic in <15s.

### Build order
1. Enable Lovable Cloud → create `analyses` table + storage bucket + RLS
2. Apply Editorial Green tokens in `src/styles.css`, add Inter to root head
3. Build `BoomerangVideoBg`, `SiteNav` (with mobile drawer animations), `SiteFooter`
4. Landing page with hero + bottom-left/right blocks per spec
5. `/how-it-works` + `/pricing` sub-pages reusing nav/palette
6. `/analyze` wizard (paste-text first, then PDF, screenshot, company)
7. Server fn: extract → orchestrator → 8 agents (parallel) → persist
8. `/report/$id` with all 11 sections + skeleton loaders
9. Firecrawl wiring for company lookup + HR Lie Detector evidence
10. History page, sample demo seed, copy polish, QA

### Out of scope (hackathon cut)
- User accounts (anonymous only)
- Real Glassdoor/LinkedIn scraping (Firecrawl public pages + disclaimers)
- Browser extension / mobile app

Ready to switch to build mode when you approve.
