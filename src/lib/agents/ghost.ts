import { callStructured } from "../ai-gateway.server";
import type { GhostAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt, clampScore } from "./shared";

export async function runGhostAgent(input: AnalysisInput): Promise<GhostAgent> {
  const result = await callStructured<{
    ghostScore: number;
    signals: string[];
    summary: string;
  }>({
    toolName: "ghostHiringAnalysis",
    toolDescription:
      "Detect ghost-hiring signals — fake job postings, phantom listings, non-genuine hiring intent.",
    parameters: {
      type: "object",
      properties: {
        ghostScore: {
          type: "number",
          description: "Ghost-hiring risk score 0-100. 0=genuine post, 100=definitely ghost.",
          minimum: 0,
          maximum: 100,
        },
        signals: {
          type: "array",
          description: "Specific ghost-hiring signals found. Max 5.",
          items: { type: "string" },
        },
        summary: { type: "string", description: "1-2 sentence ghost-hiring assessment" },
      },
      required: ["ghostScore", "signals", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Ghost-Hiring Detection Specialist",
          `Analyze the job text for ghost-hiring indicators:
- Fake urgency ("URGENT", "ASAP", "immediately")
- Vague or recycled job descriptions
- "Always hiring" or perpetually open postings
- No specific team, manager, or reporting structure
- Repeated reposting patterns in language
- Too-good-to-be-true offers with unclear details
- Overly broad scope with no clear ownership
- Missing salary bands or concrete details

Return ghostScore 0-100 based ONLY on evidence in the text. A score over 50 suggests reason to verify the listing's authenticity.`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    ghostScore: clampScore(result.arguments.ghostScore),
    signals: result.arguments.signals.slice(0, 5),
    summary: result.arguments.summary,
  };
}
