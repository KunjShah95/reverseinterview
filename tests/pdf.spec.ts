import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_ID = "test-pdf-1";

const BASE_PROGRESS = {
  culture: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  burnout: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  salary: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  ghost: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  negotiation: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  reverse: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  lie: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  simulation: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  critic: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
  orchestrator: { status: "complete", startedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T12:00:01.000Z" },
};

// Sample 1: Caution verdict — balanced but with some concerns
const SAMPLE_RECORD = {
  id: SAMPLE_ID,
  sessionId: "test-session",
  company: "Acme Test Co",
  createdAt: "2026-06-01T12:00:00.000Z",
  startedAt: "2026-06-01T12:00:00.000Z",
  completedAt: "2026-06-01T12:00:05.000Z",
  status: "complete",
  error: null,
  progress: BASE_PROGRESS,
  result: {
    company: "Acme Test Co",
    roleTitle: "Senior Test Engineer",
    culture: {
      toxicityScore: 42,
      summary: "Some flagging phrases detected.",
      flags: [
        { phrase: "rockstar", hiddenMeaning: "Unrealistic expectations.", severity: "medium" },
        { phrase: "fast-paced", hiddenMeaning: "Possible overwork.", severity: "low" },
      ],
    },
    burnout: {
      burnoutRisk: 55,
      overtimeProbability: 60,
      summary: "Elevated workload signals.",
      signals: ["Urgency language appears repeatedly.", "Possible on-call expectations."],
    },
    salary: {
      verdict: "fair",
      marketRangeEstimate: "Likely near market, confirm level and location.",
      confidence: "medium",
      reasoning: "Reasonable scope relative to the description.",
    },
    ghost: {
      ghostScore: 30,
      summary: "Hiring process looks coherent.",
      signals: ["Scope is defined.", "No ghost markers detected."],
    },
    negotiation: {
      talkingPoints: [
        "Ask how success is defined in the first 90 days.",
        "Clarify actual hours and on-call expectations.",
        "Request the salary band and level mapping.",
      ],
      counterOfferTemplate:
        "Thanks again - I am excited about the opportunity. Based on the scope we discussed, I would like to revisit the compensation before moving forward.",
      redLines: ["Undefined scope with no success criteria.", "Frequent after-hours work without compensation."],
    },
    reverse: {
      questions: [
        {
          q: "How does Acme Test Co measure success for this Senior Test Engineer role in the first 90 days?",
          why: "Turns vague expectations into concrete success criteria.",
          category: "Growth",
        },
        {
          q: "What percentage of deadlines slipped last quarter, and what changed after that?",
          why: "Checks whether urgency is a pattern or a one-off.",
          category: "Workload",
        },
      ],
    },
    lie: {
      mismatches: [
        {
          claim: "Work-life balance",
          evidence: "The same text also mentions on-call and urgent turnaround expectations.",
          confidence: "high",
        },
      ],
      summary: "The text contains at least one internal tension worth asking about.",
    },
    simulation: {
      phases: [
        { label: "6 months in", narrative: "You are learning the real operating rhythm.", stress: 50, growth: 60, learning: 65 },
        { label: "1 year in", narrative: "You likely have a decent map of what matters.", stress: 45, growth: 58, learning: 60 },
        { label: "2 years in", narrative: "This could become a useful career step.", stress: 40, growth: 55, learning: 55 },
      ],
      promotionProbability: 55,
      retentionProbability: 65,
    },
    critic: {
      unsupportedClaims: [],
      contradictions: [],
      confidenceWarnings: ["This is a heuristic fallback - directional, not factual."],
      summary: "Local fallback analysis generated for test.",
    },
    orchestrator: {
      recommendation: "caution",
      verdict: "This deserves a careful follow-up before you commit.",
      truthScore: {
        transparency: 70,
        workLifeBalance: 55,
        careerGrowth: 65,
        hiringIntegrity: 72,
        compensationFairness: 60,
      },
      topRisks: ["Workload signals are elevated.", "Compensation details are not explicit."],
      topGreens: ["Scope is at least specific.", "You can ask sharper questions before committing."],
    },
  },
};

// Sample 2: Proceed verdict — a clean, positive offer
const SAMPLE_RECORD_PROCEED = {
  id: "test-proceed-1",
  sessionId: "test-session-proceed",
  company: "BrightWave Inc",
  createdAt: "2026-06-02T09:00:00.000Z",
  startedAt: "2026-06-02T09:00:00.000Z",
  completedAt: "2026-06-02T09:00:06.000Z",
  status: "complete",
  error: null,
  progress: BASE_PROGRESS,
  result: {
    company: "BrightWave Inc",
    roleTitle: "Staff Frontend Engineer",
    culture: {
      toxicityScore: 12,
      summary: "Clean language throughout. No toxic phrases detected.",
      flags: [],
    },
    burnout: {
      burnoutRisk: 20,
      overtimeProbability: 15,
      summary: "Workload expectations seem reasonable and well-defined.",
      signals: ["Flexible hours mentioned explicitly.", "No urgency language detected."],
    },
    salary: {
      verdict: "fair",
      marketRangeEstimate: "$145,000 - $175,000 USD depending on level.",
      confidence: "high",
      reasoning: "Compensation is above median for the role and location. Benefits package is comprehensive.",
    },
    ghost: {
      ghostScore: 8,
      summary: "Hiring process is transparent and well-structured.",
      signals: ["Clear job description with defined responsibilities.", "Interview stages are explained."],
    },
    negotiation: {
      talkingPoints: [
        "Ask about equity vesting schedule and refresh grants.",
        "Clarify remote work policy and expectations.",
        "Discuss professional development budget.",
      ],
      counterOfferTemplate:
        "Thank you for the offer. I am excited about joining BrightWave. I would like to discuss the equity component and confirm the remote work arrangement before signing.",
      redLines: [],
    },
    reverse: {
      questions: [
        {
          q: "What does the onboarding process look like for the first 30 days?",
          why: "Shows the company invests in new hire success.",
          category: "Growth",
        },
        {
          q: "How does the team handle disagreements on technical decisions?",
          why: "Reveals team culture and decision-making maturity.",
          category: "Culture",
        },
        {
          q: "What is the typical career progression from Staff Engineer?",
          why: "Shows long-term growth opportunity.",
          category: "Growth",
        },
      ],
    },
    lie: {
      mismatches: [],
      summary: "No internal contradictions found in the offer description.",
    },
    simulation: {
      phases: [
        { label: "6 months in", narrative: "You are settling in and contributing to key projects.", stress: 30, growth: 70, learning: 72 },
        { label: "1 year in", narrative: "You are likely leading features and mentoring others.", stress: 28, growth: 75, learning: 68 },
        { label: "2 years in", narrative: "This role positions you for a principal-track or management role.", stress: 25, growth: 80, learning: 60 },
      ],
      promotionProbability: 75,
      retentionProbability: 82,
    },
    critic: {
      unsupportedClaims: [],
      contradictions: [],
      confidenceWarnings: [],
      summary: "Offer looks solid with no quality concerns.",
    },
    orchestrator: {
      recommendation: "proceed",
      verdict: "This is a strong offer with transparent communication and fair compensation.",
      truthScore: {
        transparency: 88,
        workLifeBalance: 82,
        careerGrowth: 78,
        hiringIntegrity: 90,
        compensationFairness: 85,
      },
      topRisks: ["Confirm equity details in writing.", "Verify remote work policy is permanent."],
      topGreens: ["Transparent hiring process.", "Competitive compensation.", "Healthy team culture signals.", "Clear career growth path."],
    },
  },
};

// Sample 3: Avoid verdict — many red flags and toxic signals
const SAMPLE_RECORD_AVOID = {
  id: "test-avoid-1",
  sessionId: "test-session-avoid",
  company: "ShadowPeak Corp",
  createdAt: "2026-06-03T14:00:00.000Z",
  startedAt: "2026-06-03T14:00:00.000Z",
  completedAt: "2026-06-03T14:00:07.000Z",
  status: "complete",
  error: null,
  progress: BASE_PROGRESS,
  result: {
    company: "ShadowPeak Corp",
    roleTitle: "Full Stack Developer",
    culture: {
      toxicityScore: 78,
      summary: "Multiple high-severity toxic phrases detected. Red flags throughout.",
      flags: [
        { phrase: "wear many hats", hiddenMeaning: "Understaffed and overworked. You will do 3 jobs for 1 salary.", severity: "high" },
        { phrase: "fast-paced environment", hiddenMeaning: "Constant fire-fighting with no process.", severity: "high" },
        { phrase: "passion-driven", hiddenMeaning: "Expect unpaid overtime as a cultural norm.", severity: "medium" },
        { phrase: "family culture", hiddenMeaning: "Guilt-tripping into working beyond your role.", severity: "medium" },
        { phrase: "unlimited PTO", hiddenMeaning: "Cultural pressure not to take time off.", severity: "low" },
      ],
    },
    burnout: {
      burnoutRisk: 85,
      overtimeProbability: 90,
      summary: "Extremely high burnout risk. Multiple urgency and overwork signals.",
      signals: [
        "Urgency language appears in every section.",
        "On-call is mandatory with no rotation.",
        "Weekend work is implicitly expected.",
        "No mention of work-life balance or boundaries.",
      ],
    },
    salary: {
      verdict: "underpaid",
      marketRangeEstimate: "$55,000 - $70,000 USD. Significantly below market for the scope.",
      confidence: "medium",
      reasoning: "Role description implies senior-level responsibilities at junior-level pay. No benefits mentioned.",
    },
    ghost: {
      ghostScore: 62,
      summary: "Several ghost-hiring indicators present.",
      signals: [
        "Job posting has been active for 6+ months.",
        "Multiple similar postings for the same role.",
        "Vague team structure description.",
        "No mention of who you report to.",
      ],
    },
    negotiation: {
      talkingPoints: [
        "Push back on the salary range with market data.",
        "Clarify on-call compensation and rotation.",
        "Ask about the team size and hiring timeline.",
        "Request written confirmation of remote policy.",
      ],
      counterOfferTemplate:
        "I appreciate the offer. However, given the scope of responsibilities described and current market rates, I believe the compensation should be adjusted to reflect the senior nature of this role.",
      redLines: [
        "No on-call compensation.",
        "Mandatory weekend work.",
        "Salary below $65,000 for this scope.",
        "No clear career progression.",
      ],
    },
    reverse: {
      questions: [
        {
          q: "Why has this position been open for over 6 months?",
          why: "High turnover or unrealistic expectations may be driving candidates away.",
          category: "Culture",
        },
        {
          q: "Can you describe the on-call rotation and how overtime is compensated?",
          why: "Reveals whether burnout is structurally built into the role.",
          category: "Workload",
        },
        {
          q: "What happened to the last person in this role?",
          why: "Direct question that exposes retention problems.",
          category: "Culture",
        },
        {
          q: "How many people have left this team in the past year?",
          why: "Quantifies turnover that management may try to downplay.",
          category: "Culture",
        },
      ],
    },
    lie: {
      mismatches: [
        {
          claim: "Work-life balance",
          evidence: "The listing mentions mandatory on-call, weekend deployments, and urgent turnaround expectations.",
          confidence: "high",
        },
        {
          claim: "Competitive salary",
          evidence: "The offered range is 30% below market average for similar roles.",
          confidence: "high",
        },
        {
          claim: "Growth opportunities",
          evidence: "No mention of career ladders, promotions, or skill development.",
          confidence: "medium",
        },
      ],
      summary: "Three significant contradictions between stated values and actual expectations.",
    },
    simulation: {
      phases: [
        { label: "6 months in", narrative: "You are drowning in context-switching and firefighting.", stress: 85, growth: 30, learning: 40 },
        { label: "1 year in", narrative: "Burnout is setting in. You are questioning why you took this role.", stress: 90, growth: 20, learning: 25 },
        { label: "2 years in", narrative: "You are either promoted into management or looking for the exit.", stress: 80, growth: 25, learning: 20 },
      ],
      promotionProbability: 25,
      retentionProbability: 30,
    },
    critic: {
      unsupportedClaims: ["Competitive compensation claim contradicts data."],
      contradictions: ["Work-life balance claim contradicts on-call and weekend requirements."],
      confidenceWarnings: ["Ghost-hiring score is elevated but not definitive."],
      summary: "Multiple red flags with limited quality signals.",
    },
    orchestrator: {
      recommendation: "avoid",
      verdict: "Too many structural red flags. This role carries high burnout risk with below-market compensation.",
      truthScore: {
        transparency: 30,
        workLifeBalance: 20,
        careerGrowth: 25,
        hiringIntegrity: 28,
        compensationFairness: 22,
      },
      topRisks: [
        "Extremely high burnout risk.",
        "Below-market salary.",
        "Ghost-hiring indicators.",
        "Toxic cultural language.",
        "No clear career path.",
      ],
      topGreens: [],
    },
  },
};

// Sample 4: Minimal report — only orchestrator data, everything else missing
const SAMPLE_RECORD_MINIMAL = {
  id: "test-minimal-1",
  sessionId: "test-session-minimal",
  company: "BareBones LLC",
  createdAt: "2026-06-04T10:00:00.000Z",
  startedAt: "2026-06-04T10:00:00.000Z",
  completedAt: "2026-06-04T10:00:02.000Z",
  status: "partial",
  error: "Only orchestrator completed. All other agents failed.",
  progress: {
    culture: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    burnout: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    salary: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    ghost: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    negotiation: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    reverse: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    lie: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    simulation: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    critic: { status: "failed", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:01.000Z" },
    orchestrator: { status: "complete", startedAt: "2026-06-04T10:00:00.000Z", completedAt: "2026-06-04T10:00:02.000Z" },
  },
  result: {
    company: "BareBones LLC",
    roleTitle: "Developer",
    orchestrator: {
      recommendation: "caution",
      verdict: "Insufficient data to form a complete opinion. Only a partial analysis was possible.",
      truthScore: {
        transparency: 50,
        workLifeBalance: 50,
        careerGrowth: 50,
        hiringIntegrity: 50,
        compensationFairness: 50,
      },
      topRisks: ["Incomplete analysis.", "Cannot assess culture, salary, or burnout."],
      topGreens: [],
    },
  },
};

// Sample 5: Heavy content — long text, many items, tests pagination
const SAMPLE_RECORD_HEAVY = {
  id: "test-heavy-1",
  sessionId: "test-session-heavy",
  company: "MegaCorp International Group",
  createdAt: "2026-06-05T08:00:00.000Z",
  startedAt: "2026-06-05T08:00:00.000Z",
  completedAt: "2026-06-05T08:00:10.000Z",
  status: "complete",
  error: null,
  progress: BASE_PROGRESS,
  result: {
    company: "MegaCorp International Group",
    roleTitle: "Principal Software Architect",
    culture: {
      toxicityScore: 35,
      summary: "Generally healthy culture with a few areas to probe during interviews.",
      flags: [
        { phrase: "move fast and break things", hiddenMeaning: "Technical debt is acceptable. Testing may be secondary.", severity: "medium" },
        { phrase: "self-starter", hiddenMeaning: "Limited mentorship or onboarding support.", severity: "low" },
        { phrase: "flat hierarchy", hiddenMeaning: "Ambiguity in reporting lines and decision authority.", severity: "low" },
        { phrase: "high ownership", hiddenMeaning: "You own everything including incidents at 3 AM.", severity: "medium" },
        { phrase: "competitive environment", hiddenMeaning: "Internal competition may undermine collaboration.", severity: "medium" },
      ],
    },
    burnout: {
      burnoutRisk: 62,
      overtimeProbability: 55,
      summary: "Moderate burnout risk. Some signals suggest heavy on-call and weekend work.",
      signals: [
        "On-call rotation is mandatory for all engineers.",
        "Deployment windows include weekends.",
        "Quarterly planning mentions 'crunch periods'.",
        "No explicit mention of mental health support.",
        "Manager mentioned 'dedication' in the context of staying late.",
      ],
    },
    salary: {
      verdict: "underpaid",
      marketRangeEstimate: "$160,000 - $190,000 USD for Principal-level roles in this market.",
      confidence: "medium",
      reasoning: "Offer is at $135,000 which is below market for Principal level. Equity details are vague.",
    },
    ghost: {
      ghostScore: 45,
      summary: "Some ghost-hiring signals present but not conclusive.",
      signals: [
        "Job posting was reposted twice in the last quarter.",
        "Hiring manager changed during the interview process.",
        "Team structure is described in vague terms.",
        "No mention of specific projects you would work on.",
        "Timeline for hiring keeps shifting.",
      ],
    },
    negotiation: {
      talkingPoints: [
        "The salary is below market for Principal level. Reference industry benchmarks.",
        "Clarify the equity package — what percentage, vesting schedule, and cliff.",
        "Ask about on-call compensation and whether it includes additional PTO.",
        "Discuss the 'crunch periods' and how they are managed.",
        "Request clarity on reporting structure given the flat hierarchy claim.",
        "Ask about the professional development budget and conference attendance.",
      ],
      counterOfferTemplate:
        "Thank you for extending this offer. I am genuinely interested in the Principal Architect role at MegaCorp. However, based on current market data for Principal-level positions, the base compensation of $135,000 appears to be below the typical range of $160,000-$190,000 for this level of responsibility. I would like to propose a base of $175,000 with a clear equity package. Additionally, I would appreciate written confirmation of the on-call compensation structure and the professional development budget.",
      redLines: [
        "Base salary below $150,000 for this scope.",
        "No equity or equity details unavailable.",
        "Mandatory weekend work without compensation.",
        "No clear career progression beyond this role.",
        "Undefined on-call expectations.",
      ],
    },
    reverse: {
      questions: [
        {
          q: "The job posting mentions 'crunch periods' — how long do they typically last and how frequently do they occur?",
          why: "Quantifies the actual burnout risk rather than accepting vague language.",
          category: "Workload",
        },
        {
          q: "Can you describe the equity package in detail — percentage, vesting schedule, and what happens in an acquisition?",
          why: "Vague equity claims are common. This forces specifics.",
          category: "Compensation",
        },
        {
          q: "Why did the hiring manager change during my interview process?",
          why: "Reveals internal instability that may affect your onboarding.",
          category: "Culture",
        },
        {
          q: "What does the on-call rotation look like and how is it compensated?",
          why: "Unclear on-call is a top burnout driver.",
          category: "Workload",
        },
        {
          q: "How do you handle disagreements between Principal Architects and VP-level leadership?",
          why: "Tests the reality of 'flat hierarchy' — who actually has decision authority.",
          category: "Culture",
        },
        {
          q: "What happened to the previous person in this role?",
          why: "Direct question that may reveal retention problems or role expectations mismatch.",
          category: "Culture",
        },
        {
          q: "Can you walk me through a typical week for someone in this role?",
          why: "Forces concrete description rather than aspirational language.",
          category: "Workload",
        },
        {
          q: "What is the team's relationship with the QA and DevOps teams?",
          why: "'Move fast and break things' may mean testing is someone else's problem.",
          category: "Culture",
        },
      ],
    },
    lie: {
      mismatches: [
        {
          claim: "Work-life balance",
          evidence: "Mandatory on-call, weekend deployments, and 'crunch periods' directly contradict this.",
          confidence: "high",
        },
        {
          claim: "Competitive compensation",
          evidence: "Base salary is 20-25% below market for Principal level in this region.",
          confidence: "high",
        },
        {
          claim: "Flat hierarchy",
          evidence: "Multiple levels mentioned (IC, Manager, Director, VP) suggesting a traditional hierarchy.",
          confidence: "medium",
        },
      ],
      summary: "Three internal contradictions found. Compensation gap is the most significant concern.",
    },
    simulation: {
      phases: [
        { label: "6 months in", narrative: "You are navigating complex politics and establishing technical credibility.", stress: 55, growth: 65, learning: 60 },
        { label: "1 year in", narrative: "You have influence but are caught between leadership and engineering teams.", stress: 60, growth: 58, learning: 50 },
        { label: "2 years in", narrative: "You are either driving architectural decisions or burning out from the politics.", stress: 65, growth: 55, learning: 45 },
      ],
      promotionProbability: 45,
      retentionProbability: 50,
    },
    critic: {
      unsupportedClaims: ["'Competitive compensation' claim is contradicted by market data."],
      contradictions: ["Work-life balance claim contradicts on-call and crunch period requirements.", "Flat hierarchy claim contradicts the multi-level structure described."],
      confidenceWarnings: ["Ghost-hiring score elevated due to reposting and timeline shifts."],
      summary: "Multiple contradictions with moderate confidence. Proceed with caution and get specifics in writing.",
    },
    orchestrator: {
      recommendation: "caution",
      verdict: "The role has potential but several claims don't hold up under scrutiny. Get everything in writing before committing.",
      truthScore: {
        transparency: 45,
        workLifeBalance: 38,
        careerGrowth: 52,
        hiringIntegrity: 42,
        compensationFairness: 35,
      },
      topRisks: [
        "Below-market salary for Principal level.",
        "On-call and crunch periods add hidden hours.",
        "Flat hierarchy claim may mask decision-making ambiguity.",
        "Ghost-hiring signals are elevated.",
        "Three contradictions between claims and evidence.",
      ],
      topGreens: [
        "Role has genuine technical scope.",
        "Some growth signals present.",
        "Negotiation room exists on equity.",
      ],
    },
  },
};

test.beforeEach(async ({ page, context }) => {
  // Seed localStorage with all sample records so getLocalAnalysis finds them.
  await context.addInitScript(
    (records) => {
      window.localStorage.setItem("rev-int-local-analyses", JSON.stringify(records));
    },
    [SAMPLE_RECORD, SAMPLE_RECORD_PROCEED, SAMPLE_RECORD_AVOID, SAMPLE_RECORD_MINIMAL, SAMPLE_RECORD_HEAVY],
  );
});

test("PDF download produces a valid PDF file", async ({ page }) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.stack ?? err.message);
  });

  await page.goto(`/report/${SAMPLE_ID}`);
  await page.waitForLoadState("networkidle", { timeout: 20_000 });

  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  // With parallel captures and scale=1, PDF generation should complete
  // within 15s. We use 30s as a safety margin for CI environments.
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await downloadButton.click();

  let download;
  try {
    download = await downloadPromise;
  } catch (err) {
    console.log("[pdf-test] no download fired. page errors:");
    pageErrors.forEach((e) => console.log("[pdf-test] PAGEERR:", e));
    console.log("[pdf-test] console messages (last 40):");
    consoleMessages.slice(-40).forEach((m) => console.log("[pdf-test] CONSOLE:", m));
    throw err;
  }
  const suggested = download.suggestedFilename();
  expect(suggested).toMatch(/\.pdf$/i);

  const outDir = resolve("tests/artifacts");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, suggested);
  await download.saveAs(outPath);

  expect(existsSync(outPath)).toBe(true);
  const bytes = readFileSync(outPath);
  expect(bytes.length).toBeGreaterThan(2_000);
  // PDFs start with the magic header "%PDF-"
  const head = bytes.subarray(0, 5).toString("ascii");
  expect(head).toBe("%PDF-");

  // Direct-text renderer is denser than the old screenshot approach.
  // Cover page + content should produce at least 2 pages.
  const pageMarkers = bytes
    .toString("latin1")
    .split("\n")
    .filter((l) => l.trimEnd().endsWith("/Type /Page") || l.trimEnd().endsWith("/Type/Page"));
  expect(pageMarkers.length).toBeGreaterThanOrEqual(2);
});

test("Print fallback is reachable when jsPDF throws", async ({ page }) => {
  await page.goto(`/report/${SAMPLE_ID}`);
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  // Stub jsPDF constructor to throw, exercising the catch path.
  await page.evaluate(() => {
    const win = window as unknown as { __printCalled?: boolean };
    win.__printCalled = false;
    window.print = () => { win.__printCalled = true; };
  });

  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).jspdf = undefined;
  });

  // Click the download button which will fail generating PDF and fallback to print
  await downloadButton.click();

  // Verify that window.print was called
  await page.waitForFunction(() => !!(window as unknown as { __printCalled?: boolean }).__printCalled, { timeout: 5000 });
  const printCalled = await page.evaluate(() => !!(window as unknown as { __printCalled?: boolean }).__printCalled);
  expect(printCalled).toBe(true);

  // The button must remain visible and enabled.
  await expect(downloadButton).toBeEnabled();
});

test("Cancel button aborts an in-flight export", async ({ page }) => {
  await page.goto(`/report/${SAMPLE_ID}`);
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  // Click download and immediately try to find a cancel button that should
  // appear in its place while the export is running.
  await downloadButton.click();
  const cancelButton = page.getByRole("button", { name: /^cancel$/i });
  await expect(cancelButton).toBeVisible({ timeout: 5_000 });

  // Whatever happens next, the original "Download as PDF" label must come
  // back without us ever receiving a download event.
  const downloadFired = page
    .waitForEvent("download", { timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  await cancelButton.click();
  const fired = await downloadFired;
  expect(fired).toBe(false);

  // After cancel, the regular download button is restored.
  await expect(
    page.getByRole("button", { name: /download as pdf/i }),
  ).toBeVisible({ timeout: 5_000 });
});

test("Proceed verdict PDF renders correctly", async ({ page }) => {
  await page.goto("/report/test-proceed-1");
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await downloadButton.click();
  const download = await downloadPromise;

  const outDir = resolve("tests/artifacts");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "proceed-" + download.suggestedFilename());
  await download.saveAs(outPath);

  const bytes = readFileSync(outPath);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2_000);
});

test("Avoid verdict PDF renders correctly", async ({ page }) => {
  await page.goto("/report/test-avoid-1");
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await downloadButton.click();
  const download = await downloadPromise;

  const outDir = resolve("tests/artifacts");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "avoid-" + download.suggestedFilename());
  await download.saveAs(outPath);

  const bytes = readFileSync(outPath);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2_000);
});

test("Minimal partial report still produces a PDF", async ({ page }) => {
  await page.goto("/report/test-minimal-1");
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await downloadButton.click();
  const download = await downloadPromise;

  const outDir = resolve("tests/artifacts");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "minimal-" + download.suggestedFilename());
  await download.saveAs(outPath);

  const bytes = readFileSync(outPath);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2_000);
});

test("Heavy content report produces multi-page PDF", async ({ page }) => {
  await page.goto("/report/test-heavy-1");
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await downloadButton.click();
  const download = await downloadPromise;

  const outDir = resolve("tests/artifacts");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "heavy-" + download.suggestedFilename());
  await download.saveAs(outPath);

  const bytes = readFileSync(outPath);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  // Heavy content with 8 reverse questions, 5 flags, etc. should produce 3+ pages
  const pageMarkers = bytes
    .toString("latin1")
    .split("\n")
    .filter((l) => l.trimEnd().endsWith("/Type /Page") || l.trimEnd().endsWith("/Type/Page"));
  expect(pageMarkers.length).toBeGreaterThanOrEqual(3);
});

test("Partial report still produces a PDF", async ({ page, context }) => {
  const partialRecord = {
    ...SAMPLE_RECORD,
    id: "test-partial-1",
    status: "partial",
    error: "Salary agent timed out",
    result: {
      ...SAMPLE_RECORD.result,
      // Salary agent missing -> SectionFallback card renders
      salary: undefined as unknown as typeof SAMPLE_RECORD.result.salary,
    },
  };
  await context.addInitScript((record) => {
    window.localStorage.setItem("rev-int-local-analyses", JSON.stringify([record]));
  }, partialRecord);

  await page.goto(`/report/test-partial-1`);
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await downloadButton.click();
  const download = await downloadPromise;

  const outDir = resolve("tests/artifacts");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "partial-" + download.suggestedFilename());
  await download.saveAs(outPath);

  const bytes = readFileSync(outPath);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2_000);
});
