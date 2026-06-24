import type { PartialAnalysisResult, CompanyDeepDive } from "./analysis-types";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  attachment?: {
    filename: string;
    content: string; // base64
    contentType: string;
  };
};

export async function sendReportEmail(
  to: string,
  result: PartialAnalysisResult,
  deepDive?: CompanyDeepDive | null,
  pdfBase64?: string | null,
): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return false;
  }

  const FROM = process.env.EMAIL_FROM ?? "reports@offerguard.ai";
  const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "OfferGuard AI";

  const html = buildEmailHtml(result, deepDive);
  const attachments: Array<{ filename: string; content: string; contentType: string }> = [];

  if (pdfBase64) {
    attachments.push({
      filename: "OfferGuard-Report.pdf",
      content: pdfBase64,
      contentType: "application/pdf",
    });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM}>`,
        to: [to],
        subject: `Your OfferGuard AI Report is ready`,
        html,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend email failed:", res.status, errBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

function buildEmailHtml(result: PartialAnalysisResult, deepDive?: CompanyDeepDive | null): string {
  const orchestrator = result.orchestrator;
  const recColor = orchestrator?.recommendation === "proceed" ? "#22c55e"
    : orchestrator?.recommendation === "caution" ? "#eab308"
    : "#ef4444";

  const scoreBar = (label: string, score: number) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#666;">${label}</td>
      <td style="width:60%;padding:4px 0;">
        <div style="height:8px;background:#eee;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${score}%;background:#2563eb;border-radius:4px;"></div>
        </div>
      </td>
      <td style="padding:4px 0 4px 8px;font-size:13px;font-weight:600;color:#333;">${score}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f0; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
  .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #e5e5e0; }
  .verdict-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; color: #fff; font-size: 14px; font-weight: 600; }
  h1 { font-size: 24px; margin: 0 0 8px; }
  h2 { font-size: 18px; margin: 0 0 12px; }
  p { margin: 0 0 8px; color: #555; line-height: 1.5; }
  .footer { text-align: center; font-size: 12px; color: #999; padding: 16px; }
</style>
</head>
<body>
  <div class="container">
    <div class="card" style="text-align:center;">
      <h1 style="font-size:28px;">OfferGuard AI</h1>
      <p style="color:#888;">Your full analysis report is ready</p>
    </div>

    <div class="card" style="text-align:center;border-top:4px solid ${recColor};">
      ${orchestrator ? `<span class="verdict-badge" style="background:${recColor};">${orchestrator.recommendation.toUpperCase()}</span>` : ""}
      ${orchestrator ? `<p style="margin-top:12px;font-size:15px;font-style:italic;color:#333;">&quot;${orchestrator.verdict}&quot;</p>` : ""}
      ${orchestrator ? `
      <table style="width:100%;margin-top:16px;">
        ${scoreBar("Transparency", orchestrator.truthScore.transparency)}
        ${scoreBar("Work-life balance", orchestrator.truthScore.workLifeBalance)}
        ${scoreBar("Career growth", orchestrator.truthScore.careerGrowth)}
        ${scoreBar("Hiring integrity", orchestrator.truthScore.hiringIntegrity)}
        ${scoreBar("Compensation fairness", orchestrator.truthScore.compensationFairness)}
      </table>` : ""}
    </div>

    <div class="card">
      <h2>Report Summary</h2>
      <p><strong>Company:</strong> ${result.company || "N/A"}</p>
      <p><strong>Role:</strong> ${result.roleTitle || "N/A"}</p>
      ${orchestrator?.topRisks ? `<p><strong>Top risks:</strong></p><ul>${orchestrator.topRisks.map((r: string) => `<li style="color:#dc2626;margin-bottom:4px;">${r}</li>`).join("")}</ul>` : ""}
      ${orchestrator?.topGreens ? `<p><strong>Green flags:</strong></p><ul>${orchestrator.topGreens.map((g: string) => `<li style="color:#16a34a;margin-bottom:4px;">${g}</li>`).join("")}</ul>` : ""}
    </div>

    ${deepDive ? `
    <div class="card">
      <h2>Company Deep Dive</h2>
      <p><strong>Industry:</strong> ${deepDive.industry}</p>
      <p><strong>Stage:</strong> ${deepDive.stage.replace("-", " ")}</p>
      <p><strong>Funding:</strong> ${deepDive.fundingStatus}</p>
      <p><strong>Growth:</strong> ${deepDive.growthTrajectory}</p>
      ${deepDive.layoffHistory.length > 0 ? `<p><strong>Layoffs:</strong></p><ul>${deepDive.layoffHistory.map((l: string) => `<li style="margin-bottom:4px;">${l}</li>`).join("")}</ul>` : ""}
      ${deepDive.leadershipChanges.length > 0 ? `<p><strong>Leadership changes:</strong></p><ul>${deepDive.leadershipChanges.map((l: string) => `<li style="margin-bottom:4px;">${l}</li>`).join("")}</ul>` : ""}
      <p><strong>Employee sentiment:</strong> ${deepDive.glassdoorSummary}</p>
    </div>` : ""}

    <div class="card" style="text-align:center;">
      <p style="margin-bottom:12px;">View the full interactive report online with all agent breakdowns.</p>
      <p style="font-size:12px;color:#999;">This report was generated by OfferGuard AI.</p>
    </div>

    <div class="footer">
      <p>OfferGuard AI — Interview the company before you join.</p>
    </div>
  </div>
</body>
</html>`;
}
