import { callStructured } from "../ai-gateway.server";
import type { CriticAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt } from "./shared";

export async function runCriticAgent(
  input: AnalysisInput,
  specialistResults: Record<string, unknown>,
  specialistErrors: Partial<Record<string, string>>,
): Promise<CriticAgent> {
  const result = await callStructured<{
    unsupportedClaims: string[];
    contradictions: string[];
    confidenceWarnings: string[];
    summary: string;
  }>({
    toolName: "criticReview",
    toolDescription:
      "Review all specialist analyses for quality issues, contradictions, unsupported claims, and confidence warnings.",
    parameters: {
      type: "object",
      properties: {
        unsupportedClaims: {
          type: "array",
          description:
            "Claims made by specialists that are not supported by the original job text. Max 4.",
          items: { type: "string" },
        },
        contradictions: {
          type: "array",
          description: "Contradictions between different specialist analyses. Max 4.",
          items: { type: "string" },
        },
        confidenceWarnings: {
          type: "array",
          description: "Warnings about analysis quality or confidence. Max 3.",
          items: { type: "string" },
        },
        summary: {
          type: "string",
          description: "1-2 sentence quality assessment of the overall analysis",
        },
      },
      required: ["unsupportedClaims", "contradictions", "confidenceWarnings", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Analysis Critic / Quality Reviewer",
          `Review all specialist analysis results for a job text analysis. Your job is to catch:
- Claims that go beyond what the original job text supports
- Contradictions between different specialist assessments
- Overconfidence where evidence is thin
- Missing important signals the specialists overlooked

Be honest and constructive. Do not invent problems. The goal is quality, not criticism for its own sake.`,
        ),
      },
      {
        role: "user",
        content: `ORIGINAL JOB TEXT:
---
${input.sourceText}
---

${input.company ? `Company: ${input.company}` : ""}
${input.roleTitle ? `Role: ${input.roleTitle}` : ""}

SPECIALIST RESULTS:
${JSON.stringify(specialistResults, null, 2)}

SPECIALIST ERRORS:
${JSON.stringify(specialistErrors, null, 2)}

Review these analyses for quality issues. Focus on whether they stay grounded in the original text.`,
      },
    ],
  });
  return {
    unsupportedClaims: result.arguments.unsupportedClaims.slice(0, 4),
    contradictions: result.arguments.contradictions.slice(0, 4),
    confidenceWarnings: result.arguments.confidenceWarnings.slice(0, 3),
    summary: result.arguments.summary,
  };
}
