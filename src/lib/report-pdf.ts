import { jsPDF } from "jspdf";
import { AGENT_LABELS } from "./report-constants";
import type { AnalysisProgress, PartialAnalysisResult } from "./analysis-types";

// jsPDF's bundled Helvetica font only supports WinAnsi (cp1252). Replace common
// Unicode characters with ASCII equivalents so the cover page and page header
// never render as empty boxes / question marks.
function sanitizeForDefaultFont(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/–|—/g, "-")
    .replace(/…/g, "...")
    .replace(/\u00A0/g, " ")
    // Replace any character outside WinAnsi (cp1252) with its closest ASCII
    // equivalent where possible, otherwise "?".
    .replace(/[\u0080-\u009F]/g, "") // strip C1 control chars
    .replace(/ˆ/g, "^") // circumflex
    .replace(/˜/g, "~") // small tilde
    .replace(/¯/g, "-") // macron
    .replace(/˘/g, "'") // breve
    .replace(/˙/g, ".") // dot above
    .replace(/˚/g, "o") // ring above
    .replace(/˛/g, ",") // ogonek
    .replace(/˝/g, '"') // double acute
    .replace(/¦/g, "|")
    .replace(/©/g, "(c)")
    .replace(/®/g, "(r)")
    .replace(/·/g, "*")
    .replace(/×/g, "x")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "?");
}

const PDF_COLORS = {
  ink: [30, 30, 30] as const,
  body: [100, 100, 100] as const,
  muted: [160, 160, 160] as const,
  safe: [34, 197, 94] as const,
  caution: [234, 179, 8] as const,
  danger: [239, 68, 68] as const,
  border: [220, 215, 210] as const,
  cream: [250, 247, 243] as const,
} as const;

type PdfLayout = {
  pageW: number;
  pageH: number;
  mx: number;
  my: number;
  cw: number;
  ch: number;
};

function getLayout(pdf: jsPDF): PdfLayout {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  return { pageW, pageH, mx: 40, my: 50, cw: pageW - 80, ch: pageH - 100 };
}

const SEC_GAP = 20;

function pageBreak(pdf: jsPDF, y: number, needed: number, layout: PdfLayout): number {
  if (y + needed > layout.pageH - 55) {
    pdf.addPage();
    return layout.my;
  }
  return y;
}

function secTitle(pdf: jsPDF, y: number, title: string): number {
  pdf.setFontSize(18);
  pdf.setTextColor(...PDF_COLORS.ink);
  pdf.text(sanitizeForDefaultFont(title), 40, y);
  return y + 24;
}

function wrapText(pdf: jsPDF, text: string, x: number, y: number, w: number, size: number, color: readonly [number, number, number]): number {
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  const lines = pdf.splitTextToSize(sanitizeForDefaultFont(text), w);
  const lineHeight = size * 1.3;
  lines.forEach((line: string, i: number) => {
    pdf.text(line, x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight + 4;
}

function drawBar(pdf: jsPDF, label: string, v: number, x: number, y: number, w: number): number {
  const barH = 8;
  const color = v >= 65 ? PDF_COLORS.safe : v >= 35 ? PDF_COLORS.caution : PDF_COLORS.danger;
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.ink);
  pdf.text(sanitizeForDefaultFont(label), x, y + barH);
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.body);
  pdf.text(`${Math.round(v)}`, x + w - 20, y + barH, { align: "right" });
  pdf.setFillColor(...PDF_COLORS.border);
  pdf.roundedRect(x, y + barH + 4, w, barH, 4, 4, "F");
  pdf.setFillColor(...(color as [number, number, number]));
  pdf.roundedRect(x, y + barH + 4, w * v / 100, barH, 4, 4, "F");
  return y + barH + 4 + barH + 8;
}

function drawBullets(pdf: jsPDF, items: string[], x: number, y: number, w: number, color: readonly [number, number, number]): number {
  pdf.setFontSize(10);
  for (const item of items) {
    const dotR = 2.5;
    pdf.setFillColor(...color);
    pdf.circle(x + 4, y + 3, dotR, "F");
    const remainder = w - 14;
    const lines = pdf.splitTextToSize(sanitizeForDefaultFont(item), remainder);
    pdf.setTextColor(...PDF_COLORS.body);
    pdf.setFontSize(10);
    lines.forEach((l: string, i: number) => {
      pdf.text(l, x + 14, y + 4 + i * 13);
    });
    y += Math.max(16, lines.length * 13 + 4);
  }
  return y;
}

function drawBadge(pdf: jsPDF, text: string, color: readonly [number, number, number], x: number, y: number): number {
  pdf.setFontSize(10);
  const tw = pdf.getTextWidth(sanitizeForDefaultFont(text));
  const padX = 10, padY = 4;
  const bw = tw + padX * 2;
  const bh = 10 + padY * 2;
  pdf.setFillColor(...color);
  pdf.roundedRect(x, y - bh + 2, bw, bh, 10, 10, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.text(sanitizeForDefaultFont(text), x + bw / 2, y - 1, { align: "center" });
  return y + 6;
}

function getWrappedTextHeight(pdf: jsPDF, text: string, width: number, fontSize: number): number {
  pdf.setFontSize(fontSize);
  const lines = pdf.splitTextToSize(sanitizeForDefaultFont(text), width);
  const lineHeight = fontSize * 1.3;
  return lines.length * lineHeight + 4;
}

function getBulletListHeight(pdf: jsPDF, items: string[], width: number, fontSize: number): number {
  let height = 0;
  pdf.setFontSize(fontSize);
  for (const item of items) {
    const lines = pdf.splitTextToSize(sanitizeForDefaultFont(item), width - 14);
    height += Math.max(16, lines.length * 13 + 4);
  }
  return height;
}

// ---------- Section renderers ----------

function renderCoverPage(pdf: jsPDF, r: PartialAnalysisResult, layout: PdfLayout): void {
  const { pageW, pageH } = layout;
  const headerParts = [r.roleTitle, r.company].filter(Boolean) as string[];
  const headerText = headerParts.length ? headerParts.join(" * ") : "Analysis Report";
  const reportDate = sanitizeForDefaultFont(
    new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
  );

  pdf.setFontSize(26);
  pdf.setTextColor(...PDF_COLORS.ink);
  pdf.text(sanitizeForDefaultFont(headerText), pageW / 2, pageH / 2 - 70, { align: "center" });

  pdf.setFontSize(12);
  pdf.setTextColor(...PDF_COLORS.body);
  pdf.text("Reverse Interview AI", pageW / 2, pageH / 2 - 30, { align: "center" });
  pdf.text("Analysis Report", pageW / 2, pageH / 2 - 12, { align: "center" });

  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.muted);
  pdf.text(reportDate, pageW / 2, pageH / 2 + 12, { align: "center" });

  if (r.orchestrator) {
    const recBadge: string =
      r.orchestrator.recommendation === "proceed" ? "Proceed"
        : r.orchestrator.recommendation === "caution" ? "Proceed with caution"
          : "Avoid";
    pdf.setFontSize(11);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text(`Verdict: ${recBadge}`, pageW / 2, pageH / 2 + 40, { align: "center" });

    const ts = r.orchestrator.truthScore;
    if (ts) {
      const avg = Math.round((ts.transparency + ts.workLifeBalance + ts.careerGrowth + ts.hiringIntegrity + ts.compensationFairness) / 5);
      pdf.setFontSize(10);
      pdf.setTextColor(...PDF_COLORS.body);
      pdf.text(`TruthScore: ${avg}/100`, pageW / 2, pageH / 2 + 56, { align: "center" });
    }
  }
}

function renderSwarmProgress(pdf: jsPDF, progress: AnalysisProgress | undefined, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Swarm Progress");
  if (!progress) {
    y = wrapText(pdf, "No progress data available.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  const complete = AGENT_LABELS.filter((a) => progress[a.id]?.status === "complete").length;
  const failed = AGENT_LABELS.filter((a) => progress[a.id]?.status === "failed").length;
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.body);
  pdf.text(`${complete} of ${AGENT_LABELS.length} agents complete${failed ? `, ${failed} failed` : ""}`, layout.mx, y);
  y += 18;

  // Compact 2-col grid of agent statuses
  const colW = (layout.cw - 10) / 2;
  for (let i = 0; i < AGENT_LABELS.length; i += 2) {
    y = pageBreak(pdf, y, 16, layout);
    const rowY = y;
    for (let c = 0; c < 2 && i + c < AGENT_LABELS.length; c++) {
      const agent = AGENT_LABELS[i + c];
      const st = progress[agent.id]?.status ?? "pending";
      const x = layout.mx + c * (colW + 10);
      pdf.setDrawColor(...PDF_COLORS.border);
      pdf.setFillColor(...PDF_COLORS.cream);
      pdf.roundedRect(x, rowY - 9, colW, 16, 4, 4, "FD");
      pdf.setFontSize(9);
      pdf.setTextColor(...PDF_COLORS.ink);
      pdf.text(sanitizeForDefaultFont(agent.label), x + 6, rowY);
      pdf.setFontSize(8);
      const stColor = st === "complete" ? PDF_COLORS.safe : st === "failed" ? PDF_COLORS.danger : PDF_COLORS.muted;
      pdf.setTextColor(...(stColor as [number, number, number]));
      pdf.text(st, x + colW - 6, rowY, { align: "right" });
    }
    y = rowY + 10;
  }
  return y + SEC_GAP;
}

function renderTruthScore(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "TruthScore Breakdown");
  if (!r.orchestrator) {
    y = wrapText(pdf, "Verdict agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  const ts = r.orchestrator.truthScore;
  if (!ts) {
    y = wrapText(pdf, "No truth score data available.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  const items: { label: string; v: number }[] = [
    { label: "Transparency", v: ts.transparency },
    { label: "Work-life balance", v: ts.workLifeBalance },
    { label: "Career growth", v: ts.careerGrowth },
    { label: "Hiring integrity", v: ts.hiringIntegrity },
    { label: "Compensation fairness", v: ts.compensationFairness },
  ];
  pdf.setFontSize(9);
  pdf.setTextColor(...PDF_COLORS.muted);
  pdf.text("0 - concerning    100 - excellent", layout.mx, y);
  y += 6;
  for (const it of items) {
    y = pageBreak(pdf, y, 24, layout);
    y = drawBar(pdf, it.label, it.v, layout.mx, y, layout.cw);
  }
  y += 4;
  // Two-column lists
  const halfW = (layout.cw - 10) / 2;
  const risksHeight = r.orchestrator.topRisks?.length ? 14 + getBulletListHeight(pdf, r.orchestrator.topRisks, halfW, 10) : 0;
  const greensHeight = r.orchestrator.topGreens?.length ? 14 + getBulletListHeight(pdf, r.orchestrator.topGreens, halfW, 10) : 0;
  const listBlockHeight = Math.max(risksHeight, greensHeight);
  y = pageBreak(pdf, y, listBlockHeight, layout);

  const listTop = y;
  let maxY = y;
  if (r.orchestrator.topRisks?.length) {
    pdf.setFontSize(11);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Top Risks", layout.mx, y);
    y = drawBullets(pdf, r.orchestrator.topRisks, layout.mx, y + 4, halfW, PDF_COLORS.danger);
    maxY = Math.max(maxY, y);
  }
  if (r.orchestrator.topGreens?.length) {
    const col2x = layout.mx + halfW + 10;
    pdf.setFontSize(11);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("What Looks Good", col2x, listTop);
    const y2 = drawBullets(pdf, r.orchestrator.topGreens, col2x, listTop + 4, halfW, PDF_COLORS.safe);
    maxY = Math.max(maxY, y2);
  }
  return Math.max(y, maxY) + SEC_GAP;
}

function renderCulture(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Culture & Toxicity");
  if (!r.culture) {
    y = wrapText(pdf, "Culture agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.body);
  pdf.text(`Toxicity Score: ${Math.round(r.culture.toxicityScore)} / 100`, layout.mx, y);
  y += 16;
  if (r.culture.summary) {
    y = wrapText(pdf, r.culture.summary, layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }
  if (r.culture.flags?.length) {
    for (const f of r.culture.flags) {
      const flagHeight = 16 + getWrappedTextHeight(pdf, f.hiddenMeaning, layout.cw - 36, 9);
      y = pageBreak(pdf, y, flagHeight, layout);
      const sevColor = f.severity === "high" ? PDF_COLORS.danger : f.severity === "medium" ? PDF_COLORS.caution : PDF_COLORS.safe;
      pdf.setFillColor(...(sevColor as [number, number, number]));
      pdf.roundedRect(layout.mx, y - 8, 28, 14, 7, 7, "F");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text(f.severity.toUpperCase(), layout.mx + 14, y - 1, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor(...PDF_COLORS.ink);
      pdf.text(`"${sanitizeForDefaultFont(f.phrase)}"`, layout.mx + 36, y);
      y += 12;
      y = wrapText(pdf, f.hiddenMeaning, layout.mx + 36, y, layout.cw - 36, 9, PDF_COLORS.body);
      y += 2;
    }
  } else {
    y = wrapText(pdf, "No major toxic phrases detected.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }
  return y + SEC_GAP;
}

function renderBurnoutGhost(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Burnout & Ghost Hiring");
  if (!r.burnout && !r.ghost) {
    y = wrapText(pdf, "Burnout / ghost agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  // Two gauges side by side
  const halfGauge = (layout.cw - 10) / 2;

  let burnoutHeight = 0;
  if (r.burnout) {
    burnoutHeight += 20;
    if (r.burnout.summary) burnoutHeight += getWrappedTextHeight(pdf, r.burnout.summary, halfGauge, 9);
    if (r.burnout.signals?.length) burnoutHeight += getBulletListHeight(pdf, r.burnout.signals.slice(0, 4), halfGauge, 10);
  }
  let ghostHeight = 0;
  if (r.ghost) {
    ghostHeight += 20;
    if (r.ghost.summary) ghostHeight += getWrappedTextHeight(pdf, r.ghost.summary, halfGauge, 9);
    if (r.ghost.signals?.length) ghostHeight += getBulletListHeight(pdf, r.ghost.signals.slice(0, 4), halfGauge, 10);
  }
  const burnoutGhostBlockHeight = Math.max(burnoutHeight, ghostHeight);
  y = pageBreak(pdf, y, burnoutGhostBlockHeight, layout);

  const gaugeTop = y;
  let maxY = y;
  if (r.burnout) {
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.body);
    pdf.text("Burnout Risk", layout.mx, y);
    const bc = r.burnout.burnoutRisk >= 65 ? PDF_COLORS.danger : r.burnout.burnoutRisk >= 35 ? PDF_COLORS.caution : PDF_COLORS.safe;
    pdf.setFillColor(...PDF_COLORS.border);
    pdf.roundedRect(layout.mx, y + 4, halfGauge, 6, 3, 3, "F");
    pdf.setFillColor(...(bc as [number, number, number]));
    pdf.roundedRect(layout.mx, y + 4, halfGauge * r.burnout.burnoutRisk / 100, 6, 3, 3, "F");
    y = y + 14;
    if (r.burnout.summary) y = wrapText(pdf, r.burnout.summary, layout.mx, y, halfGauge, 9, PDF_COLORS.body);
    if (r.burnout.signals?.length) y = drawBullets(pdf, r.burnout.signals.slice(0, 4), layout.mx, y, halfGauge, PDF_COLORS.caution);
    maxY = Math.max(maxY, y);
  }
  if (r.ghost) {
    const gx = layout.mx + halfGauge + 10;
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.body);
    pdf.text("Ghost-Hire Risk", gx, gaugeTop);
    const gc = r.ghost.ghostScore >= 65 ? PDF_COLORS.danger : r.ghost.ghostScore >= 35 ? PDF_COLORS.caution : PDF_COLORS.safe;
    pdf.setFillColor(...PDF_COLORS.border);
    pdf.roundedRect(gx, gaugeTop + 4, halfGauge, 6, 3, 3, "F");
    pdf.setFillColor(...(gc as [number, number, number]));
    pdf.roundedRect(gx, gaugeTop + 4, halfGauge * r.ghost.ghostScore / 100, 6, 3, 3, "F");
    let gy = gaugeTop + 14;
    if (r.ghost.summary) gy = wrapText(pdf, r.ghost.summary, gx, gy, halfGauge, 9, PDF_COLORS.body);
    if (r.ghost.signals?.length) gy = drawBullets(pdf, r.ghost.signals.slice(0, 4), gx, gy, halfGauge, PDF_COLORS.body);
    maxY = Math.max(maxY, gy);
  }
  return Math.max(y, maxY) + SEC_GAP;
}

function renderSalary(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Salary Fairness");
  if (!r.salary) {
    y = wrapText(pdf, "Salary agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  const vColor = r.salary.verdict === "underpaid" ? PDF_COLORS.danger
    : r.salary.verdict === "fair" ? PDF_COLORS.safe
      : r.salary.verdict === "overpaid" ? PDF_COLORS.caution
        : PDF_COLORS.body;
  y = drawBadge(pdf, r.salary.verdict ?? "unknown", vColor, layout.mx, y + 4);
  y += 4;
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.body);
  pdf.text(`Confidence: ${r.salary.confidence ?? "N/A"}`, layout.mx + 60, y);
  y += 16;
  if (r.salary.marketRangeEstimate) {
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text(`Estimated Market Range: ${sanitizeForDefaultFont(r.salary.marketRangeEstimate)}`, layout.mx, y);
    y += 14;
  }
  if (r.salary.reasoning) {
    y = wrapText(pdf, r.salary.reasoning, layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }
  return y + SEC_GAP;
}

function renderLieDetector(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "HR Claim Verification");
  if (!r.lie) {
    y = wrapText(pdf, "Claim verifier agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  if (r.lie.summary) {
    y = wrapText(pdf, r.lie.summary, layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }

  if (r.lie.mismatches?.length) {
    pdf.setFontSize(11);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Mismatches & Claims", layout.mx, y);
    y += 14;
    for (const m of r.lie.mismatches) {
      const itemHeight = 18 + getWrappedTextHeight(pdf, m.evidence, layout.cw - 12, 9) + (m.confidence ? 10 : 0);
      y = pageBreak(pdf, y, itemHeight, layout);
      pdf.setDrawColor(...PDF_COLORS.border);
      pdf.setFillColor(...PDF_COLORS.cream);
      pdf.roundedRect(layout.mx, y - 8, layout.cw, 10, 4, 4, "FD");
      pdf.setFontSize(10);
      pdf.setTextColor(...PDF_COLORS.ink);
      pdf.text(`Claim: "${sanitizeForDefaultFont(m.claim)}"`, layout.mx + 6, y);
      y += 14;
      y = wrapText(pdf, m.evidence, layout.mx + 6, y, layout.cw - 12, 9, PDF_COLORS.body);
      if (m.confidence) {
        pdf.setFontSize(8);
        pdf.setTextColor(...PDF_COLORS.muted);
        pdf.text(`Confidence: ${m.confidence}`, layout.mx + 6, y);
        y += 10;
      }
      y += 4;
    }
  }

  if (r.lie.discrepancies?.length) {
    y = pageBreak(pdf, y, 24, layout);
    pdf.setFontSize(11);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Bait-and-Switch Timeline Audit", layout.mx, y);
    y += 14;

    for (const d of r.lie.discrepancies) {
      let blockH = 14 + getWrappedTextHeight(pdf, d.assessment, layout.cw - 16, 9.5);
      if (d.jdClaim) blockH += getWrappedTextHeight(pdf, `Stage 1 JD: "${d.jdClaim}"`, layout.cw - 24, 8.5);
      if (d.chatClaim) blockH += getWrappedTextHeight(pdf, `Stage 2 Chats: "${d.chatClaim}"`, layout.cw - 24, 8.5);
      if (d.contractClaim) blockH += getWrappedTextHeight(pdf, `Stage 3 Contract: "${d.contractClaim}"`, layout.cw - 24, 8.5);
      const itemHeight = blockH + 16;

      y = pageBreak(pdf, y, itemHeight, layout);
      const startBoxY = y - 8;

      pdf.setFontSize(9);
      pdf.setTextColor(...PDF_COLORS.muted);
      const sevLabel = `Severity: ${d.severity.toUpperCase()}`;
      pdf.text(`${d.category}  |  ${sevLabel}`, layout.mx + 8, y);
      y += 14;

      y = wrapText(pdf, d.assessment, layout.mx + 8, y, layout.cw - 16, 9.5, PDF_COLORS.ink);

      if (d.jdClaim) {
        y = wrapText(pdf, `Stage 1 JD: "${d.jdClaim}"`, layout.mx + 16, y, layout.cw - 24, 8.5, PDF_COLORS.body);
      }
      if (d.chatClaim) {
        y = wrapText(pdf, `Stage 2 Chats: "${d.chatClaim}"`, layout.mx + 16, y, layout.cw - 24, 8.5, PDF_COLORS.body);
      }
      if (d.contractClaim) {
        y = wrapText(pdf, `Stage 3 Contract: "${d.contractClaim}"`, layout.mx + 16, y, layout.cw - 24, 8.5, PDF_COLORS.body);
      }

      const endBoxY = y;
      pdf.setDrawColor(...PDF_COLORS.border);
      pdf.roundedRect(layout.mx, startBoxY, layout.cw, endBoxY - startBoxY, 4, 4, "D");
      y += 10;
    }
  }

  if (!r.lie.mismatches?.length && !r.lie.discrepancies?.length) {
    y = wrapText(pdf, "No claims or discrepancies to verify.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }

  return y + SEC_GAP;
}

function renderReverseQuestions(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Reverse Interview Questions");
  if (!r.reverse) {
    y = wrapText(pdf, "Reverse interview agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  if (r.reverse.questions?.length) {
    for (let i = 0; i < r.reverse.questions.length; i++) {
      const q = r.reverse.questions[i];
      const cat = q.category ? `${q.category} - ` : "";
      const itemHeight = 16 + getWrappedTextHeight(pdf, `${cat}${q.why}`, layout.cw - 34, 9);
      y = pageBreak(pdf, y, itemHeight, layout);
      pdf.setDrawColor(...PDF_COLORS.border);
      pdf.setFillColor(...PDF_COLORS.cream);
      pdf.roundedRect(layout.mx, y - 8, layout.cw, 10, 4, 4, "FD");
      pdf.setFontSize(9);
      pdf.setTextColor(...PDF_COLORS.muted);
      pdf.text(String(i + 1).padStart(2, "0"), layout.mx + 6, y);
      pdf.setFontSize(10);
      pdf.setTextColor(...PDF_COLORS.ink);
      pdf.text(sanitizeForDefaultFont(q.q), layout.mx + 28, y);
      y += 14;
      pdf.setFontSize(9);
      pdf.setTextColor(...PDF_COLORS.body);
      y = wrapText(pdf, `${cat}${q.why}`, layout.mx + 28, y, layout.cw - 34, 9, PDF_COLORS.body);
      y += 2;
    }
  } else {
    y = wrapText(pdf, "No questions available.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }
  return y + SEC_GAP;
}

function renderSimulation(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Career Simulation");
  if (!r.simulation) {
    y = wrapText(pdf, "Simulation agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_COLORS.body);
  pdf.text(`Promotion likelihood: ${Math.round(r.simulation.promotionProbability)}%  |  Retention: ${Math.round(r.simulation.retentionProbability)}%`, layout.mx, y);
  y += 18;

  if (r.simulation.phases?.length) {
    const colW = (layout.cw - 16) / 3;

    // Dynamically calculate the maximum narrative lines across all phases
    let maxNarrativeLines = 0;
    for (const p of r.simulation.phases) {
      const lines = pdf.splitTextToSize(sanitizeForDefaultFont(p.narrative), colW - 16);
      if (lines.length > maxNarrativeLines) {
        maxNarrativeLines = lines.length;
      }
    }

    // Height includes header space (20), narrative text (maxNarrativeLines * 11), padding (8), and 3 mini-bars (35)
    const boxH = 20 + (maxNarrativeLines * 11) + 8 + 35;
    const barYOffset = 20 + (maxNarrativeLines * 11) + 8;

    // Page break check for the entire simulation block to ensure they stay together on one page
    const phaseTop = pageBreak(pdf, y, boxH + 8, layout);
    let maxY = phaseTop;

    for (let c = 0; c < r.simulation.phases.length; c++) {
      const p = r.simulation.phases[c];
      const px = layout.mx + c * (colW + 8);
      pdf.setDrawColor(...PDF_COLORS.border);
      pdf.setFillColor(...PDF_COLORS.cream);
      pdf.roundedRect(px, phaseTop - 8, colW, boxH, 6, 6, "FD");
      pdf.setFontSize(9);
      pdf.setTextColor(...PDF_COLORS.muted);
      pdf.text(sanitizeForDefaultFont(p.label.toUpperCase()), px + 8, phaseTop + 4);
      pdf.setFontSize(9);
      pdf.setTextColor(...PDF_COLORS.ink);

      const narrativeLines = pdf.splitTextToSize(sanitizeForDefaultFont(p.narrative), colW - 16);
      narrativeLines.forEach((l: string, i: number) => {
        pdf.text(l, px + 8, phaseTop + 20 + i * 11);
      });

      // Mini bars
      const barY = phaseTop + barYOffset;
      const miniBars = [
        { label: "Stress", v: p.stress, invert: true },
        { label: "Growth", v: p.growth, invert: false },
        { label: "Learning", v: p.learning, invert: false },
      ];
      miniBars.forEach((mb, mi) => {
        const by = barY + mi * 10;
        pdf.setFontSize(7);
        pdf.setTextColor(...PDF_COLORS.body);
        pdf.text(mb.label, px + 8, by + 4);
        pdf.setFontSize(7);
        pdf.setTextColor(...PDF_COLORS.body);
        pdf.text(`${Math.round(mb.v)}`, px + colW - 8, by + 4, { align: "right" });
        pdf.setFillColor(...PDF_COLORS.border);
        pdf.roundedRect(px + 30, by, colW - 38, 4, 2, 2, "F");
        const good = mb.invert ? mb.v < 50 : mb.v >= 50;
        pdf.setFillColor(...((good ? PDF_COLORS.safe : PDF_COLORS.caution) as [number, number, number]));
        pdf.roundedRect(px + 30, by, (colW - 38) * mb.v / 100, 4, 2, 2, "F");
      });
      maxY = Math.max(maxY, phaseTop + boxH);
    }
    y = maxY;
  }
  return y + SEC_GAP;
}

function renderCritic(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Quality Check");
  if (!r.critic) {
    y = wrapText(pdf, "Critic agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  if (r.critic.summary) {
    y = wrapText(pdf, r.critic.summary, layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }
  const hasIssues = r.critic.unsupportedClaims?.length || r.critic.contradictions?.length || r.critic.confidenceWarnings?.length;
  if (!hasIssues) {
    y += 4;
    y = wrapText(pdf, "No quality issues identified.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  if (r.critic.unsupportedClaims?.length) {
    y += 4;
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Unsupported Claims", layout.mx, y);
    y += 4;
    y = drawBullets(pdf, r.critic.unsupportedClaims, layout.mx, y, layout.cw, PDF_COLORS.caution);
  }
  if (r.critic.contradictions?.length) {
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Contradictions", layout.mx, y);
    y += 4;
    y = drawBullets(pdf, r.critic.contradictions, layout.mx, y, layout.cw, PDF_COLORS.danger);
  }
  if (r.critic.confidenceWarnings?.length) {
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Confidence Warnings", layout.mx, y);
    y += 4;
    y = drawBullets(pdf, r.critic.confidenceWarnings, layout.mx, y, layout.cw, PDF_COLORS.caution);
  }
  return y + SEC_GAP;
}

function renderNegotiation(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Negotiation Playbook");
  if (!r.negotiation) {
    y = wrapText(pdf, "Negotiation agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  if (r.negotiation.talkingPoints?.length) {
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Talking Points", layout.mx, y);
    y += 4;
    y = drawBullets(pdf, r.negotiation.talkingPoints, layout.mx, y, layout.cw, PDF_COLORS.body);
    y += 4;
  }
  if (r.negotiation.counterOfferTemplate) {
    const tmplLines = pdf.splitTextToSize(sanitizeForDefaultFont(r.negotiation.counterOfferTemplate), layout.cw - 16);
    const tmplH = tmplLines.length * 10 + 16;
    const templateHeight = 14 + tmplH + 4;
    y = pageBreak(pdf, y, templateHeight, layout);

    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Counter-Offer Template", layout.mx, y);
    y += 4;
    pdf.setDrawColor(...PDF_COLORS.border);
    pdf.setFillColor(...PDF_COLORS.cream);
    pdf.roundedRect(layout.mx, y - 6, layout.cw, tmplH, 4, 4, "FD");
    pdf.setFontSize(9);
    pdf.setTextColor(...PDF_COLORS.ink);
    tmplLines.forEach((l: string, i: number) => {
      pdf.text(l, layout.mx + 8, y + 4 + i * 10);
    });
    y += tmplH + 4;
  }
  if (r.negotiation.redLines?.length) {
    const listHeight = 14 + getBulletListHeight(pdf, r.negotiation.redLines, layout.cw, 10);
    y = pageBreak(pdf, y, listHeight, layout);
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text("Red Lines", layout.mx, y);
    y += 4;
    y = drawBullets(pdf, r.negotiation.redLines, layout.mx, y, layout.cw, PDF_COLORS.danger);
  }
  return y + SEC_GAP;
}

function renderEquity(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  const eq = r.salary?.equityDetails;
  if (!eq) return startY;

  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Equity Options Projection");

  const boxHeight = 4 * 14 + 8;
  y = pageBreak(pdf, y, boxHeight, layout);
  const startBoxY = y - 8;

  const optionsGranted = eq.optionsGranted ? eq.optionsGranted.toLocaleString() : "N/A";
  const strikePrice = eq.strikePrice ? `$${eq.strikePrice.toFixed(2)}` : "N/A";
  const estimatedPercentage = eq.estimatedPercentage ? `${eq.estimatedPercentage}%` : "N/A";
  const vestingSchedule = eq.vestingSchedule || "N/A";

  pdf.setFontSize(9.5);
  pdf.setTextColor(...PDF_COLORS.ink);

  const labels = [
    { label: "Options Granted:", val: optionsGranted },
    { label: "Strike Price:", val: strikePrice },
    { label: "Estimated Ownership %:", val: estimatedPercentage },
    { label: "Vesting Schedule:", val: vestingSchedule }
  ];

  for (const item of labels) {
    pdf.setFont("helvetica", "bold");
    pdf.text(item.label, layout.mx + 8, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(sanitizeForDefaultFont(item.val), layout.mx + 160, y);
    y += 14;
  }

  const endBoxY = y;
  pdf.setDrawColor(...PDF_COLORS.border);
  pdf.roundedRect(layout.mx, startBoxY, layout.cw, endBoxY - startBoxY, 4, 4, "D");

  return y + SEC_GAP;
}

function renderLegal(pdf: jsPDF, r: PartialAnalysisResult, startY: number, layout: PdfLayout): number {
  let y = pageBreak(pdf, startY, 30, layout);
  y = secTitle(pdf, y, "Legal Trap Scan");
  if (!r.legal) {
    y = wrapText(pdf, "Legal scanner agent not yet complete.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
    return y + SEC_GAP;
  }
  if (r.legal.summary) {
    y = wrapText(pdf, r.legal.summary, layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }
  if (r.legal.clauses?.length) {
    for (const c of r.legal.clauses) {
      pdf.setFontSize(8.5);
      const textLines = pdf.splitTextToSize(sanitizeForDefaultFont(`"${c.extractedText}"`), layout.cw - 24);
      const textBoxH = textLines.length * 11 + 10;
      const warningH = getWrappedTextHeight(pdf, `Warning: ${c.explanation}`, layout.cw - 16, 9);
      const strategyH = getWrappedTextHeight(pdf, `Strategy: ${c.mitigationStrategy}`, layout.cw - 16, 9);
      const itemHeight = 14 + (textBoxH + 8) + warningH + strategyH + 16;

      y = pageBreak(pdf, y, itemHeight, layout);
      const startBoxY = y - 8;

      pdf.setFontSize(10);
      pdf.setTextColor(...PDF_COLORS.ink);
      pdf.setFont("helvetica", "bold");
      pdf.text(sanitizeForDefaultFont(c.clauseType.toUpperCase()), layout.mx + 8, y);
      pdf.setFont("helvetica", "normal");

      const riskText = `Risk: ${c.riskRating.toUpperCase()}`;
      pdf.setFontSize(9);
      const riskColor: readonly [number, number, number] = c.riskRating === "high" ? PDF_COLORS.danger : c.riskRating === "medium" ? PDF_COLORS.caution : PDF_COLORS.safe;
      pdf.setTextColor(...riskColor);
      pdf.text(riskText, layout.mx + layout.cw - 8, y, { align: "right" });
      y += 14;

      pdf.setFontSize(8.5);
      pdf.setTextColor(...PDF_COLORS.body);

      pdf.setFillColor(...PDF_COLORS.cream);
      pdf.roundedRect(layout.mx + 8, y - 6, layout.cw - 16, textBoxH, 2, 2, "F");

      textLines.forEach((line: string, idx: number) => {
        pdf.text(line, layout.mx + 12, y + idx * 11);
      });
      y += textBoxH + 8;

      y = wrapText(pdf, `Warning: ${c.explanation}`, layout.mx + 8, y, layout.cw - 16, 9, PDF_COLORS.ink);
      y = wrapText(pdf, `Strategy: ${c.mitigationStrategy}`, layout.mx + 8, y, layout.cw - 16, 9, PDF_COLORS.body);

      const endBoxY = y;
      pdf.setDrawColor(...PDF_COLORS.border);
      pdf.roundedRect(layout.mx, startBoxY, layout.cw, endBoxY - startBoxY, 4, 4, "D");
      y += 12;
    }
  } else {
    y = wrapText(pdf, "No critical legal traps detected.", layout.mx, y, layout.cw, 10, PDF_COLORS.body);
  }
  return y + SEC_GAP;
}

function renderDisclaimer(pdf: jsPDF, startY: number, layout: PdfLayout): number {
  pdf.setFontSize(9);
  const text = "Signals are interpretive, not factual claims. Always do your own research before accepting an offer.";
  const lines = pdf.splitTextToSize(text, layout.cw);
  const neededHeight = 10 + lines.length * 12 + 10;

  let y = pageBreak(pdf, startY, neededHeight, layout);
  y += 10;
  pdf.setFontSize(9);
  pdf.setTextColor(...PDF_COLORS.muted);
  lines.forEach((l: string, i: number) => {
    pdf.text(l, layout.pageW / 2, y + i * 12, { align: "center" });
  });
  return y + lines.length * 12 + 10;
}

function addPageNumbers(pdf: jsPDF, headerText: string, layout: PdfLayout): void {
  const totalPages = pdf.getNumberOfPages();
  if (totalPages <= 1) return;
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(...PDF_COLORS.muted);
    pdf.text(sanitizeForDefaultFont(headerText), layout.mx, 22, { align: "left" });
    pdf.text(`Page ${i - 1} of ${totalPages - 1}`, layout.pageW / 2, layout.pageH - 16, { align: "center" });
  }
}

/**
 * Build the full analysis report PDF and return it as a Blob. Rendering is
 * synchronous; the caller owns cancellation and the browser download.
 */
export function generateReportPdf(
  r: PartialAnalysisResult,
  progress: AnalysisProgress | undefined,
): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const layout = getLayout(pdf);

  renderCoverPage(pdf, r, layout);

  const headerParts = [r.roleTitle, r.company].filter(Boolean) as string[];
  const headerText = headerParts.length ? headerParts.join(" · ") : "Analysis Report";

  // Start content on page 2 so the cover page stays clean
  pdf.addPage();
  let y = layout.my;

  y = renderSwarmProgress(pdf, progress, y, layout);
  if (r.orchestrator) y = renderTruthScore(pdf, r, y, layout);
  if (r.culture) y = renderCulture(pdf, r, y, layout);
  if (r.burnout || r.ghost) y = renderBurnoutGhost(pdf, r, y, layout);
  if (r.salary) y = renderSalary(pdf, r, y, layout);
  if (r.salary?.equityDetails) y = renderEquity(pdf, r, y, layout);
  if (r.lie) y = renderLieDetector(pdf, r, y, layout);
  if (r.legal) y = renderLegal(pdf, r, y, layout);
  if (r.reverse) y = renderReverseQuestions(pdf, r, y, layout);
  if (r.simulation) y = renderSimulation(pdf, r, y, layout);
  if (r.critic) y = renderCritic(pdf, r, y, layout);
  if (r.negotiation) y = renderNegotiation(pdf, r, y, layout);
  y = renderDisclaimer(pdf, y, layout);

  addPageNumbers(pdf, sanitizeForDefaultFont(headerText), layout);

  return pdf.output("blob");
}
