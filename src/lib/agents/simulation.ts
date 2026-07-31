import { callStructured } from "../ai-gateway.server";
import type { SimulationAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt, clampScore } from "./shared";

export async function runSimulationAgent(input: AnalysisInput): Promise<SimulationAgent> {
  const result = await callStructured<{
    phases: Array<{
      label: "6 months in" | "1 year in" | "2 years in";
      narrative: string;
      stress: number;
      growth: number;
      learning: number;
    }>;
    promotionProbability: number;
    retentionProbability: number;
  }>({
    toolName: "careerSimulation",
    toolDescription:
      "Simulate the candidate's likely experience at 6 months, 1 year, and 2 years based on the job text.",
    parameters: {
      type: "object",
      properties: {
        phases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                enum: ["6 months in", "1 year in", "2 years in"],
              },
              narrative: {
                type: "string",
                description:
                  "Realistic narrative of what the experience may feel like at this point",
              },
              stress: {
                type: "number",
                description: "Expected stress level 0-100 at this phase",
                minimum: 0,
                maximum: 100,
              },
              growth: {
                type: "number",
                description: "Expected career growth 0-100 at this phase",
                minimum: 0,
                maximum: 100,
              },
              learning: {
                type: "number",
                description: "Expected learning/development 0-100 at this phase",
                minimum: 0,
                maximum: 100,
              },
            },
            required: ["label", "narrative", "stress", "growth", "learning"],
          },
        },
        promotionProbability: {
          type: "number",
          description: "Probability of promotion within 2 years 0-100",
          minimum: 0,
          maximum: 100,
        },
        retentionProbability: {
          type: "number",
          description: "Probability of staying 2+ years 0-100",
          minimum: 0,
          maximum: 100,
        },
      },
      required: ["phases", "promotionProbability", "retentionProbability"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Career Simulation Analyst",
          `Read the job text and simulate realistic career progression:
- Project how the role will evolve at 6 months, 1 year, and 2 years
- Base stress/growth/learning scores on text evidence (urgency, scope, learning opportunities)
- Consider the maturity of the company and role definition
- Be realistic — do not sugarcoat or catastrophize
- Scores should vary across phases to reflect real dynamics`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    phases: result.arguments.phases as SimulationAgent["phases"],
    promotionProbability: clampScore(result.arguments.promotionProbability),
    retentionProbability: clampScore(result.arguments.retentionProbability),
  };
}
