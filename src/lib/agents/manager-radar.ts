import { callStructured } from "../ai-gateway.server";
import type {
  ManagerRadarAgent,
  ManagerStyle,
  ManagerRadarSignal,
  Confidence,
} from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt, clampScore } from "./shared";

export async function runManagerRadarAgent(input: AnalysisInput): Promise<ManagerRadarAgent> {
  const result = await callStructured<{
    inferredStyle: string;
    confidence: "low" | "medium" | "high";
    signals: Array<{ phrase: string; implication: string; severity: "low" | "medium" | "high" }>;
    autonomyScore: number;
    communicationClarity: number;
    redFlags: string[];
    summary: string;
  }>({
    toolName: "managerRadar",
    toolDescription: "Analyze job text to infer the hiring manager's likely management style.",
    parameters: {
      type: "object",
      properties: {
        inferredStyle: { type: "string", enum: ["micromanager", "hands-off", "delegator", "coach", "unknown"], description: "Most likely management style inferred from text signals" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        signals: { type: "array", items: { type: "object", properties: { phrase: { type: "string" }, implication: { type: "string" }, severity: { type: "string", enum: ["low", "medium", "high"] } }, required: ["phrase", "implication", "severity"] }, description: "Specific phrases and what they imply about management. Max 4." },
        autonomyScore: { type: "number", minimum: 0, maximum: 100, description: "How much autonomy the manager likely gives 0-100" },
        communicationClarity: { type: "number", minimum: 0, maximum: 100, description: "How clearly the manager communicates expectations 0-100" },
        redFlags: { type: "array", items: { type: "string" }, description: "Management-related red flags. Max 3." },
        summary: { type: "string", description: "1-2 sentence summary of management style assessment" },
      },
      required: ["inferredStyle", "confidence", "signals", "autonomyScore", "communicationClarity", "redFlags", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Management Style Analyst",
          `Analyze the job text for signals about the hiring manager's management style:
- Micromanager signals: "detail-oriented", "tracking progress", "regular updates", "metrics-driven", "daily check-ins"
- Hands-off signals: "self-starter", "independent", "minimal guidance", "figure it out"
- Delegator signals: "delegate", "ownership", "accountable", "take the lead"
- Coach signals: "mentorship", "growth", "develop your skills", "guidance", "career development"
- Communication clarity: specific well-defined scope vs. vague open-ended expectations
- Red flags: lack of defined expectations, contradictory signals, overly tight control language

Score autonomyScore and communicationClarity 0-100 based ONLY on evidence in the text.`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    inferredStyle: result.arguments.inferredStyle as ManagerStyle,
    confidence: result.arguments.confidence as Confidence,
    signals: (result.arguments.signals as ManagerRadarSignal[]).slice(0, 4),
    autonomyScore: clampScore(result.arguments.autonomyScore),
    communicationClarity: clampScore(result.arguments.communicationClarity),
    redFlags: (result.arguments.redFlags as string[]).slice(0, 3),
    summary: result.arguments.summary,
  };
}
