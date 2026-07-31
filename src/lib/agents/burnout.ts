import { callStructured } from "../ai-gateway.server";
import type { BurnoutAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt, clampScore } from "./shared";

export async function runBurnoutAgent(input: AnalysisInput): Promise<BurnoutAgent> {
  const result = await callStructured<{
    burnoutRisk: number;
    overtimeProbability: number;
    signals: string[];
    summary: string;
  }>({
    toolName: "burnoutAnalysis",
    toolDescription:
      "Assess burnout risk, overtime expectations, and workload sustainability from the job text.",
    parameters: {
      type: "object",
      properties: {
        burnoutRisk: {
          type: "number",
          description: "Burnout risk score 0-100. 0=very sustainable, 100=extremely high risk.",
          minimum: 0,
          maximum: 100,
        },
        overtimeProbability: {
          type: "number",
          description: "Likelihood of regular overtime 0-100.",
          minimum: 0,
          maximum: 100,
        },
        signals: {
          type: "array",
          description: "Specific workload or burnout signals found. Max 5.",
          items: { type: "string" },
        },
        summary: { type: "string", description: "1-2 sentence burnout risk summary" },
      },
      required: ["burnoutRisk", "overtimeProbability", "signals", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Burnout Risk Analyst",
          `Analyze the job text for:
- Overtime signals (urgent hiring, "fast-paced", "wear many hats", on-call expectations)
- Workload intensity indicators
- Turnover risk signs
- Work-life balance claims vs. implied expectations
- Team size and support structure hints
- "Unlimited PTO" and similar patterns

Score burnout risk and overtime probability 0-100 based ONLY on evidence in the text.`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    burnoutRisk: clampScore(result.arguments.burnoutRisk),
    overtimeProbability: clampScore(result.arguments.overtimeProbability),
    signals: result.arguments.signals.slice(0, 5),
    summary: result.arguments.summary,
  };
}
