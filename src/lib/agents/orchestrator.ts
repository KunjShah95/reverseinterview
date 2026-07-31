import { callStructured } from "../ai-gateway.server";
import type { CriticAgent, Orchestrator } from "../analysis-types";
import { type AnalysisInput, systemPrompt, clampScore } from "./shared";

export async function runOrchestratorAgent(
  input: AnalysisInput,
  specialistResults: Record<string, unknown>,
  specialistErrors: Partial<Record<string, string>>,
  critic: CriticAgent | null,
): Promise<Orchestrator> {
  const result = await callStructured<{
    recommendation: "proceed" | "caution" | "avoid";
    verdict: string;
    truthScore: {
      transparency: number;
      workLifeBalance: number;
      careerGrowth: number;
      hiringIntegrity: number;
      compensationFairness: number;
    };
    topRisks: string[];
    topGreens: string[];
  }>({
    toolName: "finalVerdict",
    toolDescription:
      "Produce the final TruthScore, recommendation, and summary verdict combining all specialist analyses.",
    parameters: {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["proceed", "caution", "avoid"],
        },
        verdict: {
          type: "string",
          description: "A single compelling sentence summarizing the overall assessment",
        },
        truthScore: {
          type: "object",
          properties: {
            transparency: {
              type: "number",
              description: "How honest and transparent the posting seems 0-100",
              minimum: 0,
              maximum: 100,
            },
            workLifeBalance: {
              type: "number",
              description: "Expected work-life balance quality 0-100",
              minimum: 0,
              maximum: 100,
            },
            careerGrowth: {
              type: "number",
              description: "Opportunities for growth and learning 0-100",
              minimum: 0,
              maximum: 100,
            },
            hiringIntegrity: {
              type: "number",
              description: "Whether the hiring process appears genuine 0-100",
              minimum: 0,
              maximum: 100,
            },
            compensationFairness: {
              type: "number",
              description: "Fairness of compensation based on available data 0-100",
              minimum: 0,
              maximum: 100,
            },
          },
          required: [
            "transparency",
            "workLifeBalance",
            "careerGrowth",
            "hiringIntegrity",
            "compensationFairness",
          ],
        },
        topRisks: {
          type: "array",
          description: "Top 3 risks the candidate should be aware of",
          items: { type: "string" },
        },
        topGreens: {
          type: "array",
          description: "Top 3 positive signals or green flags",
          items: { type: "string" },
        },
      },
      required: ["recommendation", "verdict", "truthScore", "topRisks", "topGreens"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Senior Reviewer / Final Verdict",
          `You are the senior reviewer. You have access to all specialist analyses and the critic review. Your job is to:
1. Weigh all evidence and produce a single clear recommendation: proceed, caution, or avoid
2. Assign TruthScore dimensions (0-100 each) based on the overall evidence
3. Write a compelling one-sentence verdict that captures the essence
4. List the top 3 risks and top 3 green flags

Be honest and balanced. A "caution" or "avoid" should only come when there is genuine evidence of problems. A "proceed" should acknowledge any open questions.

Each TruthScore dimension should reflect genuine analysis:
- transparency: how much the posting hides vs reveals
- workLifeBalance: real workload expectations
- careerGrowth: advancement opportunities visible in the text
- hiringIntegrity: whether the process feels genuine
- compensationFairness: pay relative to expectations`,
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

CRITIC REVIEW:
${critic ? JSON.stringify(critic, null, 2) : "Not available"}

Produce your final verdict. Be honest and evidence-based.`,
      },
    ],
  });
  return {
    recommendation: result.arguments.recommendation,
    verdict: result.arguments.verdict,
    truthScore: {
      transparency: clampScore(result.arguments.truthScore.transparency),
      workLifeBalance: clampScore(result.arguments.truthScore.workLifeBalance),
      careerGrowth: clampScore(result.arguments.truthScore.careerGrowth),
      hiringIntegrity: clampScore(result.arguments.truthScore.hiringIntegrity),
      compensationFairness: clampScore(result.arguments.truthScore.compensationFairness),
    },
    topRisks: result.arguments.topRisks.slice(0, 3),
    topGreens: result.arguments.topGreens.slice(0, 3),
  };
}
