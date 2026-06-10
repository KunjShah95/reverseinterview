// Reproduction script: visit a real report page, click download, capture all
// console + pageerror events and the download payload.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = "http://localhost:5180";
const REPORT_ID = "repro-pdf-1";
const SAMPLE = {
  id: REPORT_ID,
  sessionId: "repro-session",
  company: "Real World Corp",
  createdAt: "2026-06-01T12:00:00.000Z",
  startedAt: "2026-06-01T12:00:00.000Z",
  completedAt: "2026-06-01T12:00:05.000Z",
  status: "complete",
  error: null,
  progress: {
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
  },
  result: {
    company: "Real World Corp",
    roleTitle: "Senior Software Engineer",
    culture: { toxicityScore: 42, summary: "Some flagging phrases detected.", flags: [{ phrase: "rockstar", hiddenMeaning: "Unrealistic expectations.", severity: "medium" }] },
    burnout: { burnoutRisk: 55, overtimeProbability: 60, summary: "Elevated workload signals.", signals: ["Urgency language appears repeatedly."] },
    salary: { verdict: "fair", marketRangeEstimate: "Likely near market.", confidence: "medium", reasoning: "Reasonable scope." },
    ghost: { ghostScore: 30, summary: "Hiring process looks coherent.", signals: ["Scope is defined."] },
    negotiation: { talkingPoints: ["Ask how success is defined in the first 90 days."], counterOfferTemplate: "Thanks again - I am excited.", redLines: ["Undefined scope with no success criteria."] },
    reverse: { questions: [{ q: "How does Real World Corp measure success?", why: "Turns vague expectations into concrete success criteria.", category: "Growth" }] },
    lie: { mismatches: [{ claim: "Work-life balance", evidence: "Mentions on-call and urgent turnaround expectations.", confidence: "high" }], summary: "Internal tension." },
    simulation: { phases: [{ label: "6 months in", narrative: "You are learning the real operating rhythm.", stress: 50, growth: 60, learning: 65 }], promotionProbability: 55, retentionProbability: 65 },
    critic: { unsupportedClaims: [], contradictions: [], confidenceWarnings: ["Heuristic fallback."], summary: "Local fallback." },
    orchestrator: { recommendation: "caution", verdict: "This deserves a careful follow-up before you commit.", truthScore: { transparency: 70, workLifeBalance: 55, careerGrowth: 65, hiringIntegrity: 72, compensationFairness: 60 }, topRisks: ["Workload signals are elevated."], topGreens: ["Scope is at least specific."] },
  },
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ acceptDownloads: true });
await ctx.addInitScript((record) => {
  window.localStorage.setItem("rev-int-local-analyses", JSON.stringify([record]));
}, SAMPLE);

const page = await ctx.newPage();
const consoleMsgs = [];
const pageErrors = [];
let downloadResolve;
const downloadPromise = new Promise((resolve) => { downloadResolve = resolve; });
page.on("console", (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => pageErrors.push(err.stack ?? err.message));
page.on("download", async (download) => {
  const fileName = download.suggestedFilename();
  console.log(`[repro] download fired: ${fileName}`);
  await download.saveAs(resolve("tests/artifacts", `repro-${fileName}`));
  console.log(`[repro] saved to tests/artifacts/repro-${fileName}`);
  downloadResolve(fileName);
});

await page.goto(`${URL}/report/${REPORT_ID}`);
await page.waitForLoadState("networkidle", { timeout: 20_000 });

const btn = page.getByRole("button", { name: /download as pdf/i });
await btn.waitFor({ state: "visible", timeout: 15_000 });
console.log("[repro] clicking download button...");
await btn.click();
console.log("[repro] button clicked, waiting up to 30s for download...");
try {
  const fileName = await Promise.race([
    downloadPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 30_000)),
  ]);
  console.log(`[repro] download completed: ${fileName}`);
} catch (e) {
  console.log(`[repro] ${e.message}`);
}
console.log("\n=== console messages ===");
for (const m of consoleMsgs.slice(-60)) console.log(m);
console.log("\n=== page errors ===");
for (const e of pageErrors) console.log(e);
await browser.close();
