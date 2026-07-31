import { callStructured } from "../ai-gateway.server";
import type { TeamChemistryAgent, TeamArchetype, TeamChemistrySignal } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt, clampScore } from "./shared";

export async function runTeamChemistryAgent(input: AnalysisInput): Promise<TeamChemistryAgent> {
  const result = await callStructured<{
    teamArchetype: string;
    meetingCulture: string;
    crossFunctionality: number;
    supportStructure: number;
    teamHealthScore: number;
    signals: Array<{ phrase: string; implication: string }>;
    summary: string;
  }>({
    toolName: "teamChemistry",
    toolDescription: "Analyze job text to predict team dynamics, culture fit, and day-to-day work reality.",
    parameters: {
      type: "object",
      properties: {
        teamArchetype: { type: "string", enum: ["startup-grind", "corporate-ladder", "flat-collaborative", "siloed", "cross-functional-pod", "unknown"] },
        meetingCulture: { type: "string", enum: ["heavy", "moderate", "light", "unknown"] },
        crossFunctionality: { type: "number", minimum: 0, maximum: 100, description: "How cross-functional the role is 0-100" },
        supportStructure: { type: "number", minimum: 0, maximum: 100, description: "Strength of mentorship/onboarding support 0-100" },
        teamHealthScore: { type: "number", minimum: 0, maximum: 100, description: "Overall team health prediction 0-100" },
        signals: { type: "array", items: { type: "object", properties: { phrase: { type: "string" }, implication: { type: "string" } }, required: ["phrase", "implication"] }, description: "Team dynamic signals found. Max 4." },
        summary: { type: "string", description: "1-2 sentence team chemistry assessment" },
      },
      required: ["teamArchetype", "meetingCulture", "crossFunctionality", "supportStructure", "teamHealthScore", "signals", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Team Chemistry Analyst",
          `Analyze the job text to predict the team environment:
- Team archetypes:
  * startup-grind: "wear many hats", "fast-paced", "move fast", "all-hands"
  * corporate-ladder: "career path", "promotion", "levels", "structured growth"
  * flat-collaborative: "flat hierarchy", "everyone has a voice", "collaborative"
  * siloed: "independent contributor", "deep focus", "own area"
  * cross-functional-pod: "pod", "squad", "mission team", "cross-functional"
- Meeting culture: look for "standup", "sprint", "agile" (heavy) vs "async", "written" (light)
- Cross-functionality: how many different skill areas are mentioned
- Support structure: "mentorship", "onboarding", "buddy", "learning budget" signals
- Team health: overall vibe based on collaboration language, support signals, and clarity

Score 0-100 based ONLY on evidence in the text.`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    teamArchetype: result.arguments.teamArchetype as TeamArchetype,
    meetingCulture: result.arguments.meetingCulture as "heavy" | "moderate" | "light" | "unknown",
    crossFunctionality: clampScore(result.arguments.crossFunctionality),
    supportStructure: clampScore(result.arguments.supportStructure),
    teamHealthScore: clampScore(result.arguments.teamHealthScore),
    signals: (result.arguments.signals as TeamChemistrySignal[]).slice(0, 4),
    summary: result.arguments.summary,
  };
}
