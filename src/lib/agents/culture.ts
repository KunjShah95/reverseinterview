import { callStructured } from "../ai-gateway.server";
import type { CultureAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt, clampScore } from "./shared";

export async function runCultureAgent(input: AnalysisInput): Promise<CultureAgent> {
  const result = await callStructured<{
    toxicityScore: number;
    flags: Array<{ phrase: string; hiddenMeaning: string; severity: "low" | "medium" | "high" }>;
    summary: string;
  }>({
    toolName: "cultureAnalysis",
    toolDescription:
      "Analyze company culture signals, toxicity flags, and loaded language in the job text.",
    parameters: {
      type: "object",
      properties: {
        toxicityScore: {
          type: "number",
          description: "Overall toxicity score 0-100. 0=healthy, 100=extremely toxic.",
          minimum: 0,
          maximum: 100,
        },
        flags: {
          type: "array",
          description:
            "Specific loaded phrases found in the text with their hidden meaning. Max 6 flags.",
          items: {
            type: "object",
            properties: {
              phrase: { type: "string", description: "The actual phrase from the text" },
              hiddenMeaning: {
                type: "string",
                description: "What this phrase often implies in practice",
              },
              severity: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["phrase", "hiddenMeaning", "severity"],
          },
        },
        summary: { type: "string", description: "1-2 sentence summary of culture signals found" },
      },
      required: ["toxicityScore", "flags", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Culture & Toxicity Analyst",
          `Analyze the job text for:
- Loaded language ("rockstar", "ninja", "family", "hustle", "grind")
- Culture red flags (lack of boundaries, vague expectations, flat hierarchy warnings)
- Work-life balance signals
- Diversity and inclusion substance vs. performance
- Signs of toxic environments from the text

Score toxicity 0-100 based ONLY on what the text contains. Return empty flags array if no toxicity found.`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    toxicityScore: clampScore(result.arguments.toxicityScore),
    flags: result.arguments.flags.slice(0, 6),
    summary: result.arguments.summary,
  };
}
