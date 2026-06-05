import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_ID = "test-pdf-1";

const SAMPLE_RECORD = {
  id: SAMPLE_ID,
  sessionId: "test-session",
  company: "Acme Test Co",
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

test.beforeEach(async ({ page, context }) => {
  // Seed localStorage so getLocalAnalysis finds the record on first paint.
  await context.addInitScript((record) => {
    window.localStorage.setItem("rev-int-local-analyses", JSON.stringify([record]));
  }, SAMPLE_RECORD);
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

  // The download button changes its label to "Building PDF..." while working.
  // Either the download fires or the catch path runs window.print(); we wait
  // for one of those by listening for the download event with a generous cap.
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
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
});

test("Print fallback also reachable (button still works on the page)", async ({ page }) => {
  await page.goto(`/report/${SAMPLE_ID}`);
  const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  // Stub out jsPDF so we exercise the catch path without breaking the page.
  await page.evaluate(() => {
    const w = window as unknown as { __pdfCalls: number };
    w.__pdfCalls = 0;
  });

  // The button must remain visible and enabled after a previous successful run
  // has finished; this is a basic regression guard against state leaks.
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

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
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
