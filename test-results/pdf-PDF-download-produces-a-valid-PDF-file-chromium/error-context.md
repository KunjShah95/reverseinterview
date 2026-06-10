# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf.spec.ts >> PDF download produces a valid PDF file
- Location: tests\pdf.spec.ts:128:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /download as pdf/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('button', { name: /download as pdf/i })

```

```yaml
- link "Skip to content":
  - /url: "#main"
- complementary:
  - link "ReverseHire":
    - /url: /
  - paragraph: Workspace
  - navigation:
    - link "Dashboard":
      - /url: /dashboard
    - link "History":
      - /url: /history
    - link "New analysis":
      - /url: /analyze
    - link "Settings":
      - /url: /settings
  - paragraph: Sign in to save reports
  - paragraph: Create an account to keep your dashboard history.
  - link "Sign in":
    - /url: /login
  - link "Sign up":
    - /url: /register
- text: Loading analysis…
- region "Notifications alt+T"
```

# Test source

```ts
  43  |       signals: ["Urgency language appears repeatedly.", "Possible on-call expectations."],
  44  |     },
  45  |     salary: {
  46  |       verdict: "fair",
  47  |       marketRangeEstimate: "Likely near market, confirm level and location.",
  48  |       confidence: "medium",
  49  |       reasoning: "Reasonable scope relative to the description.",
  50  |     },
  51  |     ghost: {
  52  |       ghostScore: 30,
  53  |       summary: "Hiring process looks coherent.",
  54  |       signals: ["Scope is defined.", "No ghost markers detected."],
  55  |     },
  56  |     negotiation: {
  57  |       talkingPoints: [
  58  |         "Ask how success is defined in the first 90 days.",
  59  |         "Clarify actual hours and on-call expectations.",
  60  |         "Request the salary band and level mapping.",
  61  |       ],
  62  |       counterOfferTemplate:
  63  |         "Thanks again - I am excited about the opportunity. Based on the scope we discussed, I would like to revisit the compensation before moving forward.",
  64  |       redLines: ["Undefined scope with no success criteria.", "Frequent after-hours work without compensation."],
  65  |     },
  66  |     reverse: {
  67  |       questions: [
  68  |         {
  69  |           q: "How does Acme Test Co measure success for this Senior Test Engineer role in the first 90 days?",
  70  |           why: "Turns vague expectations into concrete success criteria.",
  71  |           category: "Growth",
  72  |         },
  73  |         {
  74  |           q: "What percentage of deadlines slipped last quarter, and what changed after that?",
  75  |           why: "Checks whether urgency is a pattern or a one-off.",
  76  |           category: "Workload",
  77  |         },
  78  |       ],
  79  |     },
  80  |     lie: {
  81  |       mismatches: [
  82  |         {
  83  |           claim: "Work-life balance",
  84  |           evidence: "The same text also mentions on-call and urgent turnaround expectations.",
  85  |           confidence: "high",
  86  |         },
  87  |       ],
  88  |       summary: "The text contains at least one internal tension worth asking about.",
  89  |     },
  90  |     simulation: {
  91  |       phases: [
  92  |         { label: "6 months in", narrative: "You are learning the real operating rhythm.", stress: 50, growth: 60, learning: 65 },
  93  |         { label: "1 year in", narrative: "You likely have a decent map of what matters.", stress: 45, growth: 58, learning: 60 },
  94  |         { label: "2 years in", narrative: "This could become a useful career step.", stress: 40, growth: 55, learning: 55 },
  95  |       ],
  96  |       promotionProbability: 55,
  97  |       retentionProbability: 65,
  98  |     },
  99  |     critic: {
  100 |       unsupportedClaims: [],
  101 |       contradictions: [],
  102 |       confidenceWarnings: ["This is a heuristic fallback - directional, not factual."],
  103 |       summary: "Local fallback analysis generated for test.",
  104 |     },
  105 |     orchestrator: {
  106 |       recommendation: "caution",
  107 |       verdict: "This deserves a careful follow-up before you commit.",
  108 |       truthScore: {
  109 |         transparency: 70,
  110 |         workLifeBalance: 55,
  111 |         careerGrowth: 65,
  112 |         hiringIntegrity: 72,
  113 |         compensationFairness: 60,
  114 |       },
  115 |       topRisks: ["Workload signals are elevated.", "Compensation details are not explicit."],
  116 |       topGreens: ["Scope is at least specific.", "You can ask sharper questions before committing."],
  117 |     },
  118 |   },
  119 | };
  120 | 
  121 | test.beforeEach(async ({ page, context }) => {
  122 |   // Seed localStorage so getLocalAnalysis finds the record on first paint.
  123 |   await context.addInitScript((record) => {
  124 |     window.localStorage.setItem("rev-int-local-analyses", JSON.stringify([record]));
  125 |   }, SAMPLE_RECORD);
  126 | });
  127 | 
  128 | test("PDF download produces a valid PDF file", async ({ page }) => {
  129 |   const consoleMessages: string[] = [];
  130 |   const pageErrors: string[] = [];
  131 | 
  132 |   page.on("console", (msg) => {
  133 |     consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  134 |   });
  135 |   page.on("pageerror", (err) => {
  136 |     pageErrors.push(err.stack ?? err.message);
  137 |   });
  138 | 
  139 |   await page.goto(`/report/${SAMPLE_ID}`);
  140 |   await page.waitForLoadState("networkidle", { timeout: 20_000 });
  141 | 
  142 |   const downloadButton = page.getByRole("button", { name: /download as pdf/i });
> 143 |   await expect(downloadButton).toBeVisible({ timeout: 15_000 });
      |                                ^ Error: expect(locator).toBeVisible() failed
  144 | 
  145 |   // With parallel captures and scale=1, PDF generation should complete
  146 |   // within 15s. We use 30s as a safety margin for CI environments.
  147 |   const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  148 |   await downloadButton.click();
  149 | 
  150 |   let download;
  151 |   try {
  152 |     download = await downloadPromise;
  153 |   } catch (err) {
  154 |     console.log("[pdf-test] no download fired. page errors:");
  155 |     pageErrors.forEach((e) => console.log("[pdf-test] PAGEERR:", e));
  156 |     console.log("[pdf-test] console messages (last 40):");
  157 |     consoleMessages.slice(-40).forEach((m) => console.log("[pdf-test] CONSOLE:", m));
  158 |     throw err;
  159 |   }
  160 |   const suggested = download.suggestedFilename();
  161 |   expect(suggested).toMatch(/\.pdf$/i);
  162 | 
  163 |   const outDir = resolve("tests/artifacts");
  164 |   mkdirSync(outDir, { recursive: true });
  165 |   const outPath = resolve(outDir, suggested);
  166 |   await download.saveAs(outPath);
  167 | 
  168 |   expect(existsSync(outPath)).toBe(true);
  169 |   const bytes = readFileSync(outPath);
  170 |   expect(bytes.length).toBeGreaterThan(2_000);
  171 |   // PDFs start with the magic header "%PDF-"
  172 |   const head = bytes.subarray(0, 5).toString("ascii");
  173 |   expect(head).toBe("%PDF-");
  174 | 
  175 |   // Direct-text renderer is denser than the old screenshot approach.
  176 |   // Cover page + content should produce at least 2 pages.
  177 |   const pageMarkers = bytes
  178 |     .toString("latin1")
  179 |     .split("\n")
  180 |     .filter((l) => l.trimEnd().endsWith("/Type /Page") || l.trimEnd().endsWith("/Type/Page"));
  181 |   expect(pageMarkers.length).toBeGreaterThanOrEqual(2);
  182 | });
  183 | 
  184 | test("Print fallback is reachable when jsPDF throws", async ({ page }) => {
  185 |   await page.goto(`/report/${SAMPLE_ID}`);
  186 |   const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  187 |   await expect(downloadButton).toBeVisible({ timeout: 15_000 });
  188 | 
  189 |   // Stub jsPDF constructor to throw, exercising the catch path.
  190 |   await page.evaluate(() => {
  191 |     const win = window as unknown as { __printCalled?: boolean };
  192 |     win.__printCalled = false;
  193 |     window.print = () => { win.__printCalled = true; };
  194 |   });
  195 | 
  196 |   await page.evaluate(() => {
  197 |     (window as unknown as Record<string, unknown>).jspdf = undefined;
  198 |   });
  199 | 
  200 |   // Click the download button which will fail generating PDF and fallback to print
  201 |   await downloadButton.click();
  202 | 
  203 |   // Verify that window.print was called
  204 |   await page.waitForFunction(() => !!(window as unknown as { __printCalled?: boolean }).__printCalled, { timeout: 5000 });
  205 |   const printCalled = await page.evaluate(() => !!(window as unknown as { __printCalled?: boolean }).__printCalled);
  206 |   expect(printCalled).toBe(true);
  207 | 
  208 |   // The button must remain visible and enabled.
  209 |   await expect(downloadButton).toBeEnabled();
  210 | });
  211 | 
  212 | test("Cancel button aborts an in-flight export", async ({ page }) => {
  213 |   await page.goto(`/report/${SAMPLE_ID}`);
  214 |   const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  215 |   await expect(downloadButton).toBeVisible({ timeout: 15_000 });
  216 | 
  217 |   // Click download and immediately try to find a cancel button that should
  218 |   // appear in its place while the export is running.
  219 |   await downloadButton.click();
  220 |   const cancelButton = page.getByRole("button", { name: /^cancel$/i });
  221 |   await expect(cancelButton).toBeVisible({ timeout: 5_000 });
  222 | 
  223 |   // Whatever happens next, the original "Download as PDF" label must come
  224 |   // back without us ever receiving a download event.
  225 |   const downloadFired = page
  226 |     .waitForEvent("download", { timeout: 8_000 })
  227 |     .then(() => true)
  228 |     .catch(() => false);
  229 | 
  230 |   await cancelButton.click();
  231 |   const fired = await downloadFired;
  232 |   expect(fired).toBe(false);
  233 | 
  234 |   // After cancel, the regular download button is restored.
  235 |   await expect(
  236 |     page.getByRole("button", { name: /download as pdf/i }),
  237 |   ).toBeVisible({ timeout: 5_000 });
  238 | });
  239 | 
  240 | test("Partial report still produces a PDF", async ({ page, context }) => {
  241 |   const partialRecord = {
  242 |     ...SAMPLE_RECORD,
  243 |     id: "test-partial-1",
```