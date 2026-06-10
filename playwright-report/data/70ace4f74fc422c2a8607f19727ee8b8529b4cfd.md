# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf.spec.ts >> Partial report still produces a PDF
- Location: tests\pdf.spec.ts:240:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5180/report/test-partial-1
Call log:
  - navigating to "http://localhost:5180/report/test-partial-1", waiting until "load"

```

# Test source

```ts
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
  244 |     status: "partial",
  245 |     error: "Salary agent timed out",
  246 |     result: {
  247 |       ...SAMPLE_RECORD.result,
  248 |       // Salary agent missing -> SectionFallback card renders
  249 |       salary: undefined as unknown as typeof SAMPLE_RECORD.result.salary,
  250 |     },
  251 |   };
  252 |   await context.addInitScript((record) => {
  253 |     window.localStorage.setItem("rev-int-local-analyses", JSON.stringify([record]));
  254 |   }, partialRecord);
  255 | 
> 256 |   await page.goto(`/report/test-partial-1`);
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5180/report/test-partial-1
  257 |   const downloadButton = page.getByRole("button", { name: /download as pdf/i });
  258 |   await expect(downloadButton).toBeVisible({ timeout: 15_000 });
  259 | 
  260 |   const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  261 |   await downloadButton.click();
  262 |   const download = await downloadPromise;
  263 | 
  264 |   const outDir = resolve("tests/artifacts");
  265 |   mkdirSync(outDir, { recursive: true });
  266 |   const outPath = resolve(outDir, "partial-" + download.suggestedFilename());
  267 |   await download.saveAs(outPath);
  268 | 
  269 |   const bytes = readFileSync(outPath);
  270 |   expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  271 |   expect(bytes.length).toBeGreaterThan(2_000);
  272 | });
  273 | 
```