import { callStructured } from "../ai-gateway.server";
import type { LieAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt } from "./shared";

export async function runLieAgent(input: AnalysisInput): Promise<LieAgent> {
  const hasTimeline = !!(input.jobDescriptionText || input.recruiterChatText || input.offerLetterText);

  const result = await callStructured<{
    mismatches: Array<{
      claim: string;
      evidence: string;
      confidence: "low" | "medium" | "high";
    }>;
    discrepancies?: Array<{
      category: "Location" | "Compensation" | "Scope" | "Benefits" | "Other";
      jdClaim?: string;
      chatClaim?: string;
      contractClaim?: string;
      severity: "low" | "medium" | "high";
      assessment: string;
    }>;
    summary: string;
  }>({
    toolName: "claimVerification",
    toolDescription:
      "Find contradictions, inconsistencies, and unsupported claims within the job text or across the hiring timeline stages.",
    parameters: {
      type: "object",
      properties: {
        mismatches: {
          type: "array",
          description: "Internal contradictions found within the main text itself. Max 4.",
          items: {
            type: "object",
            properties: {
              claim: { type: "string", description: "The claim or promise made" },
              evidence: {
                type: "string",
                description: "Contradicting evidence from elsewhere in the text",
              },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["claim", "evidence", "confidence"],
          },
        },
        discrepancies: {
          type: "array",
          description: "Shifts and discrepancies between recruiting timeline stages (JD, Chat/Emails, and Offer/Contract). Max 5.",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["Location", "Compensation", "Scope", "Benefits", "Other"] },
              jdClaim: { type: "string", description: "What was stated in the Job Description, if applicable." },
              chatClaim: { type: "string", description: "What was promised in recruiter chats/emails, if applicable." },
              contractClaim: { type: "string", description: "What was written in the final offer letter/contract, if applicable." },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              assessment: { type: "string", description: "Explain the shift or bait-and-switch details in plain terms." }
            },
            required: ["category", "severity", "assessment"]
          }
        },
        summary: { type: "string", description: "1-2 sentence summary of contradictions or timeline discrepancies found." },
      },
      required: ["mismatches", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "HR Claim Verifier / Lie & Discrepancy Detector",
          `Read the job texts and identify contradictions and timeline shifts.
${
  hasTimeline
    ? `You have separate texts for:
1. The Job Description
2. Recruiter Emails/Chats
3. The final Offer Letter/Contract

Compare these documents chronologically. Look for:
- "Bait-and-switch" shifts in location (e.g. Remote promised in JD, Hybrid or On-site in contract)
- Compensation changes (e.g. $130k base discussed in email, $115k in contract)
- Scope shifts (e.g. Senior role title, but contract says Junior or expands duties heavily without adjustment)
- Benefit shifts (e.g. Unlimited PTO discussed, but contract specifies strict caps/limits)`
    : `Find internal inconsistencies within the text (e.g., "work-life balance" vs "on-call", "unlimited PTO" vs "high burnout", etc.).`
}

Only flag discrepancies that are genuinely present. Return empty arrays if none found.`,
        ),
      },
      {
        role: "user",
        content: userPrompt(
          input.sourceText,
          hasTimeline
            ? `TIMELINE DOCUMENTS TO CROSS-REFERENCE:
1. Job Description:
${input.jobDescriptionText || "(Not provided)"}

2. Recruiter Emails/Chats:
${input.recruiterChatText || "(Not provided)"}

3. Final Offer Letter / Contract:
${input.offerLetterText || "(Not provided)"}`
            : undefined,
        ),
      },
    ],
  });
  return {
    mismatches: result.arguments.mismatches.slice(0, 4),
    discrepancies: result.arguments.discrepancies?.slice(0, 5),
    summary: result.arguments.summary,
  };
}
