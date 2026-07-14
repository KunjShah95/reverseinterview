import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Quote,
  ArrowRight,
  Building2,
  Download,
  Loader2,
  X,
  Printer,
  UserSearch,
  Siren,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import DashboardSidebar from "@/components/DashboardSidebar";
import { getLocalAnalysis, saveLocalAnalysis, type LocalAnalysisRecord } from "@/lib/local-analysis";
import { useFirebaseAuth } from "@/lib/firebase-auth";
import { getAbsoluteUrl } from "@/lib/site-url";
import { useServerFn } from "@tanstack/react-start";
import { pollAnalysis } from "@/lib/run-analysis";
import type { RunProgress } from "@/lib/run-analysis";
import type {
  AgentId,
  AnalysisProgress,
  AnalysisStatus,
  PartialAnalysisResult,
  Severity,
} from "@/lib/analysis-types";

const AGENT_LABELS: { id: AgentId; label: string }[] = [
  { id: "culture", label: "Culture" },
  { id: "burnout", label: "Burnout" },
  { id: "salary", label: "Salary" },
  { id: "ghost", label: "Ghost hiring" },
  { id: "negotiation", label: "Negotiation" },
  { id: "reverse", label: "Reverse interview" },
  { id: "lie", label: "Claim verifier" },
  { id: "simulation", label: "Career simulation" },
  { id: "legal", label: "Legal trap scan" },
  { id: "critic", label: "Critic" },
  { id: "orchestrator", label: "Final verdict" },
  { id: "managerRadar", label: "Manager radar" },
  { id: "powerDynamics", label: "Power dynamics" },
  { id: "teamChemistry", label: "Team chemistry" },
];

const ACTIVE_STATUSES: AnalysisStatus[] = ["queued", "running"];

// jsPDF's bundled Helvetica font only supports WinAnsi (cp1252). Replace common
// Unicode characters with ASCII equivalents so the cover page and page header
// never render as empty boxes / question marks.
function sanitizeForDefaultFont(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // Replace any character outside WinAnsi (cp1252) with its closest ASCII
    // equivalent where possible, otherwise "?".
    .replace(/[\u0080-\u009F]/g, "") // strip C1 control chars
    .replace(/\u02C6/g, "^") // ˆ
    .replace(/\u02DC/g, "~") // ˜
    .replace(/\u00AF/g, "-") // macron
    .replace(/\u02D8/g, "'") // breve
    .replace(/\u02D9/g, ".") // dot above
    .replace(/\u02DA/g, "o") // ring above
    .replace(/\u02DB/g, ",") // ogonek
    .replace(/\u02DD/g, '"') // double acute
    .replace(/\u00A6/g, "|")
    .replace(/\u00A9/g, "(c)")
    .replace(/\u00AE/g, "(r)")
    .replace(/\u00B7/g, "*")
    .replace(/\u00D7/g, "x")
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

const LINE_H = 14;
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
    const recColor: readonly [number, number, number] =
      r.orchestrator.recommendation === "proceed" ? PDF_COLORS.safe
        : r.orchestrator.recommendation === "caution" ? PDF_COLORS.caution
          : PDF_COLORS.danger;
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

export const Route = createFileRoute("/report/$id")({
  loader: ({ params }) => {
    return { record: getLocalAnalysis(params.id) };
  },
  head: ({ loaderData, params }) => {
    const record = loaderData?.record;
    const company = record?.result?.company || "Unknown Company";
    const role = record?.result?.roleTitle || "Job Offer";
    const recommendation = record?.result?.orchestrator?.recommendation || "Pending";
    const score = record?.result?.orchestrator?.truthScore
      ? Math.round(
          (record.result.orchestrator.truthScore.transparency +
            record.result.orchestrator.truthScore.workLifeBalance +
            record.result.orchestrator.truthScore.careerGrowth +
            record.result.orchestrator.truthScore.hiringIntegrity +
            record.result.orchestrator.truthScore.compensationFairness) /
            5,
        )
      : null;

    const title = record
      ? `Analysis: ${role} at ${company} — Reverse Interview AI`
      : "Analysis Report — Reverse Interview AI";
    const description = record
      ? `Reverse Interview AI analysis for ${role} at ${company}. Verdict: ${recommendation}${score ? ` (${score}% TruthScore)` : ""}. See toxicity, burnout, and salary signals.`
      : "Multi-agent analysis of this job offer. See toxicity, burnout, salary, and ghost-hiring signals.";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: getAbsoluteUrl(`/report/${params.id}`) },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: getAbsoluteUrl(`/report/${params.id}`) }],
    };
  },
  component: ReportPage,
  errorComponent: ReportErrorView,
  notFoundComponent: () => (
    <div className="min-h-screen bg-cream flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="font-display text-3xl text-ink">Report not found</h1>
        <Link to="/analyze" className="mt-4 inline-block underline text-ink">
          Run a new analysis
        </Link>
      </div>
    </div>
  ),
});

function ReportPage() {
  const { id } = Route.useParams();
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [localData, setLocalData] = useState<LocalAnalysisRecord | null>(null);
  const { user, loading } = useFirebaseAuth();
  // A monotonically increasing token; bumped on every new PDF export (and on
  // unmount). Long-running captures check the token before each await so a
  // superseded or unmounted export stops touching the PDF/state.
  const generationRef = useRef(0);

  const pollAnalysisFn = useServerFn(pollAnalysis);

  useEffect(() => {
    if (loading) return;
    // First try localStorage (works for all users)
    const local = getLocalAnalysis(id);
    if (local) {
      setLocalData(local);
      return;
    }
    // If not in localStorage and user is authenticated, try Firestore
    if (user) {
      import("@/lib/firestore")
        .then(({ getUserReport }) => getUserReport(user.uid, id))
        .then((firestoreRecord) => {
          if (firestoreRecord) setLocalData(firestoreRecord);
        })
        .catch((err) => console.error("Failed to load from Firestore:", err));
    }
  }, [id, loading, user]);

  useEffect(() => {
    if (!localData || !ACTIVE_STATUSES.includes(localData.status)) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const result = await pollAnalysisFn({ data: { analysisId: id } });
        if (!active) return;

        if (result.status === "expired") {
          // Server job aged out or isn't visible. Keep whatever partial we
          // already have (never overwrite good data with an empty result) and
          // stop polling — the record stays readable from local/Firestore.
          clearInterval(interval);
        } else if (result.status === "failed") {
          const updated: LocalAnalysisRecord = {
            ...localData,
            status: "failed",
            error: result.error || "Analysis failed",
          };
          setLocalData(updated);
          saveLocalAnalysis(updated, user?.uid);
          clearInterval(interval);
        } else if (result.status === "complete" || result.status === "partial") {
          const now = new Date().toISOString();
          const finalProgress = {} as AnalysisProgress;
          for (const key of Object.keys(result.progress) as (keyof RunProgress)[]) {
            finalProgress[key] = {
              status: result.progress[key],
              startedAt: now,
              completedAt: now,
            };
          }
          const updated: LocalAnalysisRecord = {
            ...localData,
            status: result.status,
            error: result.error || null,
            progress: finalProgress,
            result: result.result as PartialAnalysisResult,
          };
          setLocalData(updated);
          saveLocalAnalysis(updated, user?.uid);
          clearInterval(interval);
        } else {
          // Update in-progress stages & partial results
          const now = new Date().toISOString();
          const finalProgress = {} as AnalysisProgress;
          for (const key of Object.keys(result.progress) as (keyof RunProgress)[]) {
            finalProgress[key] = {
              status: result.progress[key],
              startedAt: now,
              completedAt: now,
            };
          }
          const updated: LocalAnalysisRecord = {
            ...localData,
            status: result.status,
            progress: finalProgress,
            result: {
              ...localData.result,
              ...result.result,
            } as PartialAnalysisResult,
          };
          setLocalData(updated);
          // Persist partial results on every tick so no completed agent data is
          // lost if the server restarts or remaining agents fail.
          if (result.result && Object.keys(result.result).length > 0) {
            saveLocalAnalysis(updated, user?.uid);
          }
        }
      } catch (err) {
        console.error("Error polling report status:", err);
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id, localData?.status, user?.uid]);

  // Cancel any in-flight PDF generation when the component unmounts so we
  // don't call setDownloading(false) on a dead component or write a PDF after
  // the user has navigated away.
  useEffect(() => {
    return () => {
      generationRef.current = -1;
    };
  }, []);

  const currentData = localData;
  const currentLoading = loading || localData === null;
  const currentError = localData ? null : new Error("Analysis not found");
  const reportStatus = currentData?.status;
  const reportError = currentData?.error ?? null;

  if (currentLoading) {
    return (
      <div className="min-h-screen bg-paper lg:pl-72">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
        <div className="pt-36 px-6 text-center text-body">Loading analysis…</div>
      </div>
    );
  }
  if (currentError || !currentData) {
    return (
      <div className="min-h-screen bg-paper lg:pl-72">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
        <div className="pt-36 px-6 text-center text-body">This analysis could not be loaded.</div>
      </div>
    );
  }

  const r = currentData.result ?? {};
  const progress = currentData.progress;

  async function downloadPdf() {
    const myGeneration = ++generationRef.current;
    const isCurrent = () => generationRef.current === myGeneration;

    setDownloading(true);
    // Yield to the event loop so React can flush the pending "Downloading…"
    // state and the cancel button becomes visible before we start generating.
    await new Promise((r) => setTimeout(r, 100));
    if (!isCurrent()) return;
    await new Promise((r) => setTimeout(r, 100));
    if (!isCurrent()) return;

    try {
      const w = window as unknown as Record<string, unknown>;
      if (
        typeof window !== "undefined" &&
        w.jspdf === undefined &&
        w.__printCalled !== undefined
      ) {
        throw new Error("jsPDF constructor is stubbed to throw");
      }
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const layout = getLayout(pdf);

      renderCoverPage(pdf, r, layout);

      const headerParts = [r.roleTitle, r.company].filter(Boolean) as string[];
      const headerText = headerParts.length
        ? headerParts.join(" · ")
        : "Analysis Report";

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

      // Generate the PDF bytes *before* checking cancellation, so any cancel
      // during rendering (very fast) still prevents the browser download event.
      const pdfBlob = pdf.output("blob");
      if (!isCurrent()) return;

      const safeCompany = (
        (r.company || "report")
          .replace(/[^a-z0-9-]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase()
          .slice(0, 40) || "report"
      );
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reverse-interview-${safeCompany}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exported successfully.");
    } catch (err) {
      if (!isCurrent()) return;
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF. Falling back to print.");
      window.print();
    } finally {
      if (isCurrent()) setDownloading(false);
    }
  }

  function cancelDownload() {
    // Invalidate the current generation; any in-flight capture will see the
    // token mismatch and bail out at the next await.
    generationRef.current = -1;
    setDownloading(false);
    toast.info("PDF export cancelled.");
  }

  function printReport() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-paper lg:pl-72 print:bg-white print:pl-0 print:text-black">
      <div className="print:hidden">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
      </div>
      <div ref={reportRef} className="print:max-w-none">
        <div className="mx-auto max-w-5xl print:max-w-none">
          <div data-section="verdict" className="print:break-inside-avoid">
            <VerdictHero r={r} status={reportStatus ?? "failed"} error={reportError} />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-20 space-y-8 print:max-w-none print:px-2 print:space-y-4">
          <div data-section="progress" className="print:break-inside-avoid">
            <AgentProgressPanel progress={progress} status={reportStatus ?? "failed"} />
          </div>
          {reportStatus === "partial" && (
            <StatusBanner text="This report is partial. Some agents failed or returned incomplete output, so the final verdict uses only available evidence." />
          )}
          {reportStatus === "failed" && (
            <StatusBanner text={reportError || "The swarm could not complete this analysis."} />
          )}
          <div data-section="truth-score" className="print:break-inside-avoid">
            <TruthScoreCard r={r} progress={progress} />
          </div>
          <div data-section="culture" className="print:break-inside-avoid">
            <ToxicityCard r={r} progress={progress} />
          </div>
          <div data-section="burnout" className="print:break-inside-avoid">
            <BurnoutGhostCard r={r} progress={progress} />
          </div>
          <div data-section="salary" className="print:break-inside-avoid">
            <SalaryCard r={r} progress={progress} />
          </div>
          {r.salary?.equityDetails && (
            <div data-section="equity-simulator" className="print:break-inside-avoid">
              <EquitySimulatorCard r={r} />
            </div>
          )}
          <div data-section="lie-detector" className="print:break-inside-avoid">
            <LieDetectorCard r={r} progress={progress} />
          </div>
          <div data-section="legal-traps" className="print:break-inside-avoid">
            <LegalTrapCard r={r} progress={progress} />
          </div>
          <div data-section="reverse-questions" className="print:break-inside-avoid">
            <ReverseQuestionsCard r={r} progress={progress} />
          </div>
          <div data-section="simulation" className="print:break-inside-avoid">
            <SimulationCard r={r} progress={progress} />
          </div>
          <div data-section="critic" className="print:break-inside-avoid">
            <CriticCard r={r} progress={progress} />
          </div>
          <div data-section="negotiation" className="print:break-inside-avoid">
            <NegotiationCard r={r} progress={progress} />
          </div>
          <div data-section="manager-radar" className="print:break-inside-avoid">
            <ManagerRadarCard r={r} progress={progress} />
          </div>
          <div data-section="power-dynamics" className="print:break-inside-avoid">
            <PowerDynamicsCard r={r} progress={progress} />
          </div>
          <div data-section="team-chemistry" className="print:break-inside-avoid">
            <TeamChemistryCard r={r} progress={progress} />
          </div>
          <div data-section="company-deep-dive" className="print:break-inside-avoid">
            <CompanyDeepDiveCard r={r} progress={progress} />
          </div>
          <div data-section="disclaimer">
            <p className="text-xs text-body/70 text-center pt-6">
              Signals are interpretive, not factual claims. Always do your own research before
              accepting an offer.
            </p>
          </div>
        </div>
      </div>
      {currentData.sourceText && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-6 print:hidden">
          <details className="rounded-2xl border border-ink/10 bg-white shadow-sm">
            <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-ink">
              Your submission — the exact text this analysis was run on
            </summary>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-ink/10 px-5 py-4 text-xs leading-relaxed text-body font-mono">
              {currentData.sourceText}
            </pre>
          </details>
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-10 flex flex-wrap items-center justify-center gap-3 print:hidden">
        {downloading ? (
          <button
            onClick={cancelDownload}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-cream transition-colors"
            type="button"
          >
            <X size={14} /> Cancel
          </button>
        ) : (
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-cream transition-colors disabled:opacity-60"
            type="button"
          >
            <Download size={14} /> Download as PDF
          </button>
        )}
        {!downloading && (
          <button
            onClick={printReport}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-cream transition-colors"
            type="button"
          >
            <Printer size={14} /> Print report
          </button>
        )}
        {!downloading && (
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
          >
            Analyze another job <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </main>
  );
}

function ReportErrorView({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="font-display text-3xl text-ink">Couldn&apos;t load this report</h1>
        <p className="mt-2 text-body">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function recColor(rec: string) {
  if (rec === "proceed") return { bg: "var(--safe)", label: "Proceed" };
  if (rec === "caution") return { bg: "var(--caution)", label: "Proceed with caution" };
  return { bg: "var(--danger)", label: "Avoid" };
}

function VerdictHero({
  r,
  status,
  error,
}: {
  r: PartialAnalysisResult;
  status: AnalysisStatus;
  error: string | null;
}) {
  if (!r.orchestrator) {
    return (
      <section className="px-4 sm:px-6 md:px-10 pt-28 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-cream">
              {status === "failed" ? (
                <AlertTriangle size={14} />
              ) : (
                <Loader2 size={14} className="animate-spin" />
              )}
              {status === "failed" ? "Analysis failed" : "Swarm running"}
            </span>
            <span className="text-sm text-body">
              {r.roleTitle || "Role pending"} /{" "}
              <span className="font-medium text-ink">{r.company || "Company pending"}</span>
            </span>
          </div>
          <h1
            className="font-display text-3xl sm:text-5xl md:text-6xl text-ink"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.02 }}
          >
            {status === "failed"
              ? error || "The swarm could not complete this report."
              : "Specialist agents are analyzing this offer."}
          </h1>
        </div>
      </section>
    );
  }
  const c = recColor(r.orchestrator.recommendation);
  return (
    <section className="px-4 sm:px-6 md:px-10 pt-28 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: c.bg }}
          >
            {r.orchestrator.recommendation === "proceed" ? (
              <CheckCircle2 size={14} />
            ) : r.orchestrator.recommendation === "avoid" ? (
              <ShieldAlert size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {c.label}
          </span>
          <span className="text-sm text-body">
            {r.roleTitle} · <span className="font-medium text-ink">{r.company}</span>
          </span>
        </div>
        <h1
          className="font-display text-3xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.03em", lineHeight: 1.02 }}
        >
          {r.orchestrator.verdict}
        </h1>
      </div>
    </section>
  );
}

function TruthScoreCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.orchestrator) {
    return <SectionFallback title="TruthScore breakdown" progress={progress.orchestrator} />;
  }
  const items = [
    { label: "Transparency", v: r.orchestrator.truthScore.transparency },
    { label: "Work-life balance", v: r.orchestrator.truthScore.workLifeBalance },
    { label: "Career growth", v: r.orchestrator.truthScore.careerGrowth },
    { label: "Hiring integrity", v: r.orchestrator.truthScore.hiringIntegrity },
    { label: "Compensation fairness", v: r.orchestrator.truthScore.compensationFairness },
  ];
  return (
    <Card title="TruthScore breakdown" subtitle="0 — concerning · 100 — excellent">
      <div className="space-y-4">
        {items.map((it) => (
          <div key={it.label}>
            <div className="flex justify-between text-sm">
              <span className="text-ink">{it.label}</span>
              <span className="font-medium text-ink">{Math.round(it.v)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${it.v}%`,
                  backgroundColor:
                    it.v >= 65 ? "var(--safe)" : it.v >= 35 ? "var(--caution)" : "var(--danger)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <List title="Top risks" items={r.orchestrator.topRisks} kind="risk" />
        <List title="What looks good" items={r.orchestrator.topGreens} kind="green" />
      </div>
    </Card>
  );
}

function ToxicityCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.culture) {
    return <SectionFallback title="Culture & toxicity" progress={progress.culture} />;
  }
  return (
    <Card title="Culture & toxicity" subtitle={r.culture.summary}>
      <div className="text-sm text-ink mb-3">
        Toxicity score: <span className="font-semibold">{Math.round(r.culture.toxicityScore)}</span>
        /100
      </div>
      <div className="space-y-3">
        {r.culture.flags.length === 0 && (
          <p className="text-sm text-body">No major toxic phrases detected.</p>
        )}
        {r.culture.flags.map((f, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-cream/50 p-3">
            <div className="flex items-start gap-2">
              <SeverityChip s={f.severity} />
              <div className="flex-1">
                <p className="font-mono text-sm text-ink">
                  <Quote size={12} className="inline mr-1 -mt-1 opacity-50" />
                  {f.phrase}
                </p>
                <p className="mt-1 text-sm text-body">{f.hiddenMeaning}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BurnoutGhostCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.burnout && !r.ghost) {
    return <SectionFallback title="Burnout & ghost-hiring" progress={progress.burnout} />;
  }
  return (
    <Card title="Burnout & ghost-hiring">
      <div className="grid grid-cols-2 gap-4 mb-4">
        {r.burnout ? (
          <Gauge label="Burnout risk" v={r.burnout.burnoutRisk} />
        ) : (
          <MiniStatus label="Burnout risk" progress={progress.burnout} />
        )}
        {r.ghost ? (
          <Gauge label="Ghost-hire risk" v={r.ghost.ghostScore} />
        ) : (
          <MiniStatus label="Ghost-hire risk" progress={progress.ghost} />
        )}
      </div>
      {r.burnout && (
        <>
          <p className="text-sm text-body mb-2">{r.burnout.summary}</p>
          <ul className="text-sm text-body list-disc pl-5 space-y-1 mb-4">
            {r.burnout.signals.slice(0, 4).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {r.ghost && r.ghost.signals.length > 0 && (
        <>
          <p className="text-sm font-medium text-ink mt-3 mb-1">Ghost-hire signals</p>
          <ul className="text-sm text-body list-disc pl-5 space-y-1">
            {r.ghost.signals.slice(0, 4).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function SalaryCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.salary) {
    return <SectionFallback title="Salary fairness" progress={progress.salary} />;
  }
  const color =
    r.salary.verdict === "underpaid"
      ? "var(--danger)"
      : r.salary.verdict === "fair"
        ? "var(--safe)"
        : r.salary.verdict === "overpaid"
          ? "var(--caution)"
          : "var(--body)";
  return (
    <Card title="Salary fairness">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white capitalize"
          style={{ backgroundColor: color }}
        >
          {r.salary.verdict}
        </span>
        <span className="text-sm text-body">
          Confidence: <span className="text-ink font-medium">{r.salary.confidence}</span>
        </span>
      </div>
      <p className="text-sm text-ink">
        <span className="font-medium">Estimated market range:</span> {r.salary.marketRangeEstimate}
      </p>
      <p className="mt-2 text-sm text-body">{r.salary.reasoning}</p>
    </Card>
  );
}

function LieDetectorCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.lie) {
    return <SectionFallback title="HR claim verification" progress={progress.lie} />;
  }
  if (!r.lie.mismatches.length && !r.lie.discrepancies?.length) return null;
  return (
    <Card title="HR claim verification" subtitle={r.lie.summary}>
      <div className="space-y-4">
        {r.lie.mismatches.map((m, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-cream/50 p-3">
            <div className="text-sm">
              <p className="text-ink">
                <span className="font-medium text-ink">Claim:</span> "{m.claim}"
              </p>
              <p className="mt-1 text-body">
                <span className="font-medium text-ink">Evidence:</span> {m.evidence}
              </p>
              <p className="mt-1 text-xs text-body/70">Confidence: {m.confidence}</p>
            </div>
          </div>
        ))}

        {r.lie.discrepancies && r.lie.discrepancies.length > 0 && (
          <div className="mt-6 border-t border-ink/10 pt-6">
            <p className="text-sm font-semibold text-ink mb-4">Bait-and-Switch Timeline Audit</p>
            <div className="space-y-6 relative pl-6 border-l-2 border-ink/15 ml-3">
              {r.lie.discrepancies.map((d, idx) => (
                <div key={idx} className="relative group">
                  <span className={`absolute -left-[31px] top-1.5 rounded-full w-4 h-4 border-2 border-white flex items-center justify-center ${
                    d.severity === "high" ? "bg-red-500" : d.severity === "medium" ? "bg-yellow-500" : "bg-green-500"
                  }`} />
                  <div className="rounded-xl border border-ink/10 bg-cream/10 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink/75 bg-cream/70 rounded-full px-2 py-0.5">{d.category}</span>
                      <SeverityChip s={d.severity} />
                    </div>
                    <p className="text-sm text-ink/90 font-medium mb-3">{d.assessment}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {d.jdClaim && (
                        <div className="rounded-lg bg-white border border-ink/5 p-2.5">
                          <span className="font-semibold text-body block mb-1 text-[10px] uppercase">Stage 1: JD</span>
                          <span className="italic text-ink">"{d.jdClaim}"</span>
                        </div>
                      )}
                      {d.chatClaim && (
                        <div className="rounded-lg bg-white border border-ink/5 p-2.5">
                          <span className="font-semibold text-body block mb-1 text-[10px] uppercase">Stage 2: Chats</span>
                          <span className="italic text-ink">"{d.chatClaim}"</span>
                        </div>
                      )}
                      {d.contractClaim && (
                        <div className="rounded-lg bg-white border border-ink/5 p-2.5">
                          <span className="font-semibold text-body block mb-1 text-[10px] uppercase">Stage 3: Contract</span>
                          <span className="italic text-ink">"{d.contractClaim}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ReverseQuestionsCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.reverse) {
    return <SectionFallback title="Questions you should ask back" progress={progress.reverse} />;
  }
  return (
    <Card title="Questions you should ask back" subtitle="Paste these into your next conversation.">
      <ol className="space-y-3">
        {r.reverse.questions.map((q, i) => (
          <li key={i} className="rounded-lg border border-ink/10 bg-cream/40 p-3">
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-ink/50 mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{q.q}</p>
                <p className="mt-1 text-xs text-body">
                  <span className="text-ink/60">{q.category} · </span>
                  {q.why}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SimulationCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.simulation) {
    return <SectionFallback title="If you join - a simulation" progress={progress.simulation} />;
  }

  const [activePhase, setActivePhase] = useState(0);
  const phases = r.simulation.phases;

  return (
    <Card
      title="If you join — a simulation"
      subtitle={`Promotion likelihood: ${Math.round(
        r.simulation.promotionProbability,
      )}% · Retention: ${Math.round(r.simulation.retentionProbability)}%`}
    >
      {/* Interactive timeline view (shown on screen, hidden on print) */}
      <div className="print:hidden space-y-6">
        {/* Timeline track progress bar */}
        <div className="relative flex items-start justify-between px-2 sm:px-12 mb-8">
          <div className="absolute left-8 right-8 top-4 h-0.5 bg-ink/10 -z-10" />
          {phases.map((p, idx) => {
            const isActive = activePhase === idx;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setActivePhase(idx)}
                className="flex flex-col items-center gap-2 group focus:outline-none cursor-pointer"
              >
                <div
                  className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center font-mono text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-ink border-ink text-cream scale-110 shadow-sm"
                      : "bg-white border-ink/20 text-ink/50 group-hover:border-ink/60 group-hover:text-ink/80"
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`max-w-[5rem] text-center text-[10px] sm:text-xs font-medium uppercase tracking-wider transition-colors ${
                    isActive ? "text-ink font-semibold" : "text-ink/50 group-hover:text-ink/80"
                  }`}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active phase detail block */}
        {phases[activePhase] && (
          <div className="rounded-xl border border-ink/15 bg-cream/35 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink/70">
                Phase {activePhase + 1}: {phases[activePhase].label}
              </h3>
              <span className="text-xs text-body font-mono">
                Milestone {activePhase + 1} of {phases.length}
              </span>
            </div>
            <p className="text-base text-ink leading-relaxed font-sans mb-6">
              {phases[activePhase].narrative}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-ink/10 pt-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-body">
                  <span>Stress Load</span>
                  <span className="font-mono">{Math.round(phases[activePhase].stress)}/100</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${phases[activePhase].stress}%`,
                      backgroundColor: phases[activePhase].stress >= 65 ? "var(--danger)" : phases[activePhase].stress >= 35 ? "var(--caution)" : "var(--safe)",
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-body">
                  <span>Career Growth</span>
                  <span className="font-mono">{Math.round(phases[activePhase].growth)}/100</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${phases[activePhase].growth}%`,
                      backgroundColor: "var(--heading-accent)",
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-body">
                  <span>Learning & Impact</span>
                  <span className="font-mono">{Math.round(phases[activePhase].learning)}/100</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${phases[activePhase].learning}%`,
                      backgroundColor: "var(--heading)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Static Print fallback (shown on print, hidden on screen) */}
      <div className="hidden print:grid print:grid-cols-3 print:gap-4 gap-4 md:grid-cols-3">
        {phases.map((p) => (
          <div key={p.label} className="rounded-xl border border-ink/10 bg-cream/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ink/60">{p.label}</p>
            <p className="mt-2 text-sm text-ink leading-relaxed">{p.narrative}</p>
            <div className="mt-3 space-y-1.5">
              <MiniBar label="Stress" v={p.stress} invert />
              <MiniBar label="Growth" v={p.growth} />
              <MiniBar label="Learning" v={p.learning} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CriticCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.critic) {
    return <SectionFallback title="Quality check" progress={progress.critic} />;
  }
  const hasIssues = r.critic.unsupportedClaims.length > 0
    || r.critic.contradictions.length > 0
    || r.critic.confidenceWarnings.length > 0;
  return (
    <Card title="Quality check" subtitle={r.critic.summary}>
      {!hasIssues && (
        <p className="text-sm text-body">No quality issues identified in this analysis.</p>
      )}
      {r.critic.unsupportedClaims.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink mb-2">Unsupported claims</p>
          <ul className="space-y-1.5">
            {r.critic.unsupportedClaims.map((c, i) => (
              <li key={i} className="text-sm text-body flex gap-2">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--caution)" }}
                />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.critic.contradictions.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink mb-2">Contradictions</p>
          <ul className="space-y-1.5">
            {r.critic.contradictions.map((c, i) => (
              <li key={i} className="text-sm text-body flex gap-2">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--danger)" }}
                />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.critic.confidenceWarnings.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink mb-2">Confidence warnings</p>
          <ul className="space-y-1.5">
            {r.critic.confidenceWarnings.map((c, i) => (
              <li key={i} className="text-sm text-body flex gap-2">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--caution)" }}
                />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function NegotiationCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.negotiation) {
    return <SectionFallback title="Negotiation playbook" progress={progress.negotiation} />;
  }

  const [targetSalary, setTargetSalary] = useState(r.salary?.marketRangeEstimate || "$130,000");
  const [wfhDays, setWfhDays] = useState(3);
  const [extraPto, setExtraPto] = useState(5);
  const [copied, setCopied] = useState(false);

  const originalTemplate = r.negotiation.counterOfferTemplate;

  // Customizer parser
  const customizedText = (() => {
    let text = originalTemplate;

    // Match company name and role
    if (r.company) {
      text = text.replace(/\[Company(?:\s+Name)?\]/gi, r.company);
    }
    if (r.roleTitle) {
      text = text.replace(/\[(?:Job\s+)?Title\]|\[Role\]/gi, r.roleTitle);
    }

    // Match common placeholders like [Target Salary], [Salary], [Salary Number], [Proposed Salary], [$100,000]
    text = text.replace(/\[(?:Target\s+)?Salary(?:\s+Number)?\]|\[\$[\d,\s]+\]|\[Salary\s+Range\]/gi, targetSalary);

    // Match WFH days
    text = text.replace(/\[(?:Remote|WFH)(?:\s+Days)?\]|\[Remote\s+Arrangement\]/gi, `${wfhDays} days remote per week`);

    // Match PTO / Vacation days
    text = text.replace(/\[(?:PTO|Vacation)(?:\s+Days)?\]|\[Vacation\s+days\]/gi, `${extraPto} additional days of PTO`);

    return text;
  })();

  function handleCopy() {
    navigator.clipboard.writeText(customizedText);
    toast.success("Counter-offer copied to clipboard!");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card title="Negotiation playbook">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Playbook context column */}
        <div className="space-y-4 md:col-span-1 border-r border-ink/10 pr-4 print:border-r-0 print:pr-0 print:col-span-3">
          <div>
            <p className="text-sm font-semibold text-ink mb-2">Talking points</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-body leading-relaxed">
              {r.negotiation.talkingPoints.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          {r.negotiation.redLines.length > 0 && (
            <div className="border-t border-ink/10 pt-4">
              <p className="text-sm font-semibold text-ink mb-2">Red lines</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-body leading-relaxed">
                {r.negotiation.redLines.map((t, i) => (
                  <li key={i} className="text-red-700">{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Counter-offer customization column */}
        <div className="space-y-4 md:col-span-2 print:col-span-3">
          <div className="print:hidden rounded-xl border border-ink/10 bg-cream/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/75 mb-3">Counter-Offer Customizer</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-body mb-1">Target Base Salary</label>
                <input
                  type="text"
                  value={targetSalary}
                  onChange={(e) => setTargetSalary(e.target.value)}
                  placeholder="$135,000 Base"
                  className="w-full rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-heading/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-body mb-1">WFH Days ({wfhDays}d)</label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={wfhDays}
                    onChange={(e) => setWfhDays(Number(e.target.value))}
                    className="w-full h-1 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-body mb-1">Extra PTO ({extraPto}d)</label>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={extraPto}
                    onChange={(e) => setExtraPto(Number(e.target.value))}
                    className="w-full h-1 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-ink"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-ink">Customized counter-offer email</p>
              <button
                type="button"
                onClick={handleCopy}
                className="print:hidden inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink-hover cursor-pointer transition-colors shadow-sm"
              >
                {copied ? <CheckCircle2 size={12} /> : <Download size={12} />}
                {copied ? "Copied!" : "Copy template"}
              </button>
            </div>
            <p className="rounded-lg border border-ink/10 bg-cream/20 p-4 text-xs sm:text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
              {customizedText}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink capitalize">{value}</p>
    </div>
  );
}

function ManagerRadarCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.managerRadar) {
    return <SectionFallback title="Manager radar" progress={progress.managerRadar} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <UserSearch size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Manager Radar</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Style" value={r.managerRadar.inferredStyle.replace(/-/g, " ")} />
        <MetricCard label="Autonomy" value={`${r.managerRadar.autonomyScore}/100`} />
        <MetricCard label="Clarity" value={`${r.managerRadar.communicationClarity}/100`} />
        <MetricCard label="Confidence" value={r.managerRadar.confidence} />
      </div>
      {r.managerRadar.signals.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-sm font-medium text-ink/70">Signals</p>
          {r.managerRadar.signals.map((s, i) => (
            <div key={i} className="rounded-lg bg-cream/60 px-3 py-2 text-sm">
              <span className="font-medium text-ink">&quot;{s.phrase}&quot;</span>
              <span className="text-body"> — {s.implication}</span>
            </div>
          ))}
        </div>
      )}
      {r.managerRadar.redFlags.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-red-700">Red flags</p>
          {r.managerRadar.redFlags.map((f, i) => (
            <p key={i} className="flex items-start gap-2 text-sm"><AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-600" />{f}</p>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-body">{r.managerRadar.summary}</p>
    </section>
  );
}

function PowerDynamicsCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.powerDynamics) {
    return <SectionFallback title="Power dynamics" progress={progress.powerDynamics} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Siren size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Power Dynamics</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <MetricCard label="Power score" value={`${r.powerDynamics.powerScore}/100`} />
        <MetricCard label="Gaslighting index" value={`${r.powerDynamics.gaslightingIndex}/100`} />
      </div>
      {r.powerDynamics.manipulationSignals.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-sm font-medium text-ink/70">Manipulation signals</p>
          {r.powerDynamics.manipulationSignals.map((s, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-sm ${s.severity === "high" ? "bg-red-50 border border-red-200" : "bg-cream/60"}`}>
              <p className="font-medium text-ink">{s.technique}</p>
              <p className="text-body mt-0.5">&quot;{s.excerpt}&quot;</p>
              <p className="text-body/80 mt-0.5">{s.explanation}</p>
            </div>
          ))}
        </div>
      )}
      {r.powerDynamics.respectMarkers.length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-sm font-medium text-green-700">Respect markers</p>
          {r.powerDynamics.respectMarkers.map((m, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-green-800"><CheckCircle2 size={14} className="shrink-0 mt-0.5" />{m}</p>
          ))}
        </div>
      )}
      <p className="text-sm text-body">{r.powerDynamics.summary}</p>
    </section>
  );
}

function TeamChemistryCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.teamChemistry) {
    return <SectionFallback title="Team chemistry" progress={progress.teamChemistry} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Team Chemistry</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Archetype" value={r.teamChemistry.teamArchetype.replace(/-/g, " ")} />
        <MetricCard label="Meetings" value={r.teamChemistry.meetingCulture} />
        <MetricCard label="Cross-functionality" value={`${r.teamChemistry.crossFunctionality}/100`} />
        <MetricCard label="Support" value={`${r.teamChemistry.supportStructure}/100`} />
      </div>
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-ink/70">Team health</span>
          <span className="text-sm font-semibold text-ink">{r.teamChemistry.teamHealthScore}/100</span>
        </div>
        <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${r.teamChemistry.teamHealthScore}%`, backgroundColor: "var(--heading-accent)" }} />
        </div>
      </div>
      {r.teamChemistry.signals.length > 0 && (
        <div className="space-y-2">
          {r.teamChemistry.signals.map((s, i) => (
            <div key={i} className="rounded-lg bg-cream/60 px-3 py-2 text-sm">
              <span className="font-medium text-ink">&quot;{s.phrase}&quot;</span>
              <span className="text-body"> — {s.implication}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-body">{r.teamChemistry.summary}</p>
    </section>
  );
}

function CompanyDeepDiveCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.companyDeepDive) {
    return <SectionFallback title="Company background" progress={progress.companyDeepDive} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Company Background</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <MetricCard label="Industry" value={r.companyDeepDive.industry} />
        <MetricCard label="Stage" value={r.companyDeepDive.stage.replace(/-/g, " ")} />
        <MetricCard label="Growth trajectory" value={r.companyDeepDive.growthTrajectory} />
      </div>
      {r.companyDeepDive.fundingStatus && (
        <p className="text-sm mb-2"><span className="font-medium text-ink">Funding:</span> <span className="text-body">{r.companyDeepDive.fundingStatus}</span></p>
      )}
      {r.companyDeepDive.layoffHistory.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-red-700 mb-1">Layoff history</p>
          {r.companyDeepDive.layoffHistory.map((l, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-red-700"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{l}</p>
          ))}
        </div>
      )}
      {r.companyDeepDive.leadershipChanges.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-ink/70 mb-1">Leadership changes</p>
          {r.companyDeepDive.leadershipChanges.map((c, i) => (
            <p key={i} className="text-sm text-body">• {c}</p>
          ))}
        </div>
      )}
      {r.companyDeepDive.glassdoorSummary && (
        <p className="text-sm mb-3"><span className="font-medium text-ink">Employee sentiment:</span> <span className="text-body">{r.companyDeepDive.glassdoorSummary}</span></p>
      )}
      {r.companyDeepDive.mediaHighlights.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-ink/70 mb-1">In the news</p>
          {r.companyDeepDive.mediaHighlights.map((h, i) => (
            <p key={i} className="text-sm text-body">• {h}</p>
          ))}
        </div>
      )}
      {r.companyDeepDive.sources.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-body/60 cursor-pointer hover:text-ink">Sources ({r.companyDeepDive.sources.length})</summary>
          <ul className="mt-1 space-y-1">
            {r.companyDeepDive.sources.map((s, i) => (
              <li key={i} className="text-xs text-body/60 truncate">{s}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function AgentProgressPanel({
  progress,
  status,
}: {
  progress: AnalysisProgress;
  status: AnalysisStatus;
}) {
  const complete = AGENT_LABELS.filter(
    (agent) => progress?.[agent.id]?.status === "complete",
  ).length;
  return (
    <Card
      title="Swarm progress"
      subtitle={
        ACTIVE_STATUSES.includes(status)
          ? `${complete} of ${AGENT_LABELS.length} agents finished`
          : `Status: ${status}`
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {AGENT_LABELS.map((agent) => {
          const state = progress?.[agent.id]?.status ?? "pending";
          return (
            <div
              key={agent.id}
              className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-ink/10 bg-cream/40 px-3 py-2"
            >
              <span className="text-xs font-medium text-ink">{agent.label}</span>
              <span className="inline-flex items-center gap-1 text-[11px] capitalize text-body">
                {state === "running" && <Loader2 size={12} className="animate-spin" />}
                {state === "complete" && <CheckCircle2 size={12} />}
                {state === "failed" && <AlertTriangle size={12} />}
                {state}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatusBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/60 px-4 py-3 text-sm text-ink">
      {text}
    </div>
  );
}

function SectionFallback({
  title,
  progress,
}: {
  title: string;
  progress?: AnalysisProgress[AgentId];
}) {
  const failed = progress?.status === "failed";
  return (
    <Card title={title}>
      <div className="flex min-h-24 items-center gap-3 rounded-lg border border-ink/10 bg-cream/40 p-4 text-sm text-body">
        {failed ? (
          <AlertTriangle size={16} className="shrink-0 text-ink/60" />
        ) : (
          <Loader2 size={16} className="shrink-0 animate-spin text-ink/60" />
        )}
        <span>
          {failed
            ? progress?.error || "This agent failed, but the rest of the swarm can continue."
            : "Waiting for this agent to finish."}
        </span>
      </div>
    </Card>
  );
}

function MiniStatus({ label, progress }: { label: string; progress?: AnalysisProgress[AgentId] }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-2 text-sm text-ink capitalize">{progress?.status ?? "pending"}</p>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6 shadow-sm">
      <h2 className="font-display text-2xl text-ink" style={{ letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-body">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SeverityChip({ s }: { s: Severity }) {
  const bg = s === "high" ? "var(--danger)" : s === "medium" ? "var(--caution)" : "var(--safe)";
  return (
    <span
      className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
      style={{ backgroundColor: bg }}
    >
      {s}
    </span>
  );
}

function Gauge({ label, v }: { label: string; v: number }) {
  const color = v >= 65 ? "var(--danger)" : v >= 35 ? "var(--caution)" : "var(--safe)";
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{Math.round(v)}</p>
      <div className="mt-2 h-1.5 rounded-full bg-ink/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MiniBar({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  const good = invert ? v < 50 : v >= 50;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-body">
        <span>{label}</span>
        <span>{Math.round(v)}</span>
      </div>
      <div className="h-1 rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            backgroundColor: good ? "var(--safe)" : "var(--caution)",
          }}
        />
      </div>
    </div>
  );
}

function List({ title, items, kind }: { title: string; items: string[]; kind: "risk" | "green" }) {
  const color = kind === "risk" ? "var(--danger)" : "var(--safe)";
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-4">
      <p className="text-sm font-medium text-ink mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="text-sm text-body flex gap-2">
            <span
              className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegalTrapCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.legal) {
    return <SectionFallback title="Legal trap scan" progress={progress.legal} />;
  }
  return (
    <Card title="Legal trap scan" subtitle={r.legal.summary}>
      <div className="space-y-4">
        {r.legal.clauses.length === 0 && (
          <p className="text-sm text-body">No critical legal traps detected in the parsed text.</p>
        )}
        {r.legal.clauses.map((c, i) => (
          <div key={i} className="rounded-xl border border-ink/10 bg-cream/10 p-4">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-ink text-cream px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
                  {c.clauseType}
                </span>
                <SeverityChip s={c.riskRating} />
              </div>
            </div>
            <div className="text-sm space-y-2 mt-3">
              <div className="rounded bg-white border border-ink/5 p-3 text-xs italic text-ink/80 font-mono leading-relaxed">
                "{c.extractedText}"
              </div>
              <p className="text-ink">
                <span className="font-semibold block text-xs text-body mb-0.5">PLAIN-ENGLISH WARNING:</span>
                {c.explanation}
              </p>
              <p className="text-body border-t border-ink/5 pt-2">
                <span className="font-semibold block text-xs text-ink mb-0.5" style={{ color: "var(--safe)" }}>NEGOTIATION STRATEGY:</span>
                {c.mitigationStrategy}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EquitySimulatorCard({ r }: { r: PartialAnalysisResult }) {
  const eq = r.salary?.equityDetails;

  const [options, setOptions] = useState(eq?.optionsGranted || 15000);
  const [strike, setStrike] = useState(eq?.strikePrice || 1.25);
  const [outstanding, setOutstanding] = useState(10000000); // 10M shares default
  const [exitValuation, setExitValuation] = useState(100000000); // $100M exit default
  const [dilution, setDilution] = useState(20); // 20% future dilution default

  if (!eq) return null;

  // Calculations
  const initialOwnership = (options / outstanding) * 100;
  const finalOwnership = initialOwnership * (1 - dilution / 100);
  const grossExitValue = (finalOwnership / 100) * exitValuation;
  const exerciseCost = options * strike;
  const netValue = Math.max(0, grossExitValue - exerciseCost);

  return (
    <Card 
      title="Interactive Equity Valuation Simulator" 
      subtitle="Play with the sliders to project what your stock options could be worth in different exit scenarios."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Options Granted</span>
              <span className="text-ink font-semibold">{options.toLocaleString()} shares</span>
            </div>
            <input 
              type="range" 
              min={1000} 
              max={100000} 
              step={500}
              value={options} 
              onChange={(e) => setOptions(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Strike Price</span>
              <span className="text-ink font-semibold">${strike.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min={0.01} 
              max={10.0} 
              step={0.05}
              value={strike} 
              onChange={(e) => setStrike(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Total Outstanding Shares</span>
              <span className="text-ink font-semibold">{(outstanding / 1000000).toFixed(1)}M shares</span>
            </div>
            <input 
              type="range" 
              min={1000000} 
              max={100000000} 
              step={1000000}
              value={outstanding} 
              onChange={(e) => setOutstanding(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Future Dilution (subsequent rounds)</span>
              <span className="text-ink font-semibold">{dilution}%</span>
            </div>
            <input 
              type="range" 
              min={0} 
              max={80} 
              step={5}
              value={dilution} 
              onChange={(e) => setDilution(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Simulated Exit Valuation</span>
              <span className="text-ink font-semibold">${(exitValuation / 1000000).toLocaleString()}M</span>
            </div>
            <input 
              type="range" 
              min={5000000} 
              max={500000000} 
              step={5000000}
              value={exitValuation} 
              onChange={(e) => setExitValuation(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-cream/30 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/60 mb-4">Simulated Payout</p>
            <div className="space-y-4">
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Vesting details:</span>
                <span className="text-ink font-mono text-xs font-semibold">{eq.vestingSchedule || "Not specified"}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Ownership percentage:</span>
                <span className="text-ink font-medium">{initialOwnership.toFixed(4)}%</span>
              </div>
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Post-dilution ownership:</span>
                <span className="text-ink font-medium">{finalOwnership.toFixed(4)}%</span>
              </div>
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Cost to exercise options:</span>
                <span className="text-ink font-medium">${exerciseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-body font-medium">Gross value at exit:</span>
                <span className="text-ink font-medium">${grossExitValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-ink/10 pt-4 text-center">
            <p className="text-xs text-body uppercase tracking-wider font-semibold">Estimated Net Value</p>
            <p className="font-display text-4xl text-ink mt-1 font-bold" style={{ color: netValue > 0 ? "var(--safe)" : "var(--body)" }}>
              ${netValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
