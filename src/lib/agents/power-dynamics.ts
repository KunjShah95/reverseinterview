import { callStructured } from "../ai-gateway.server";
import type { PowerDynamicsAgent, ManipulationSignal } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt, clampScore } from "./shared";

export async function runPowerDynamicsAgent(input: AnalysisInput): Promise<PowerDynamicsAgent> {
  const result = await callStructured<{
    powerScore: number;
    manipulationSignals: Array<{ technique: string; excerpt: string; explanation: string; severity: "low" | "medium" | "high" }>;
    respectMarkers: string[];
    gaslightingIndex: number;
    summary: string;
  }>({
    toolName: "powerDynamics",
    toolDescription: "Detect manipulative language, power imbalances, and psychological pressure in job/recruiter text.",
    parameters: {
      type: "object",
      properties: {
        powerScore: { type: "number", minimum: 0, maximum: 100, description: "Power imbalance score 0-100. 0=healthy, 100=abusive." },
        manipulationSignals: { type: "array", items: { type: "object", properties: { technique: { type: "string", description: "E.g. 'urgency pressure', 'love bombing', 'guilt induction'" }, excerpt: { type: "string", description: "The actual text excerpt" }, explanation: { type: "string", description: "Why this is concerning" }, severity: { type: "string", enum: ["low", "medium", "high"] } }, required: ["technique", "excerpt", "explanation", "severity"] }, description: "Manipulation techniques detected. Max 5." },
        respectMarkers: { type: "array", items: { type: "string" }, description: "Positive respect/transparency signals. Max 3." },
        gaslightingIndex: { type: "number", minimum: 0, maximum: 100, description: "Likelihood of gaslighting or contradiction 0-100" },
        summary: { type: "string", description: "1-2 sentence power dynamics assessment" },
      },
      required: ["powerScore", "manipulationSignals", "respectMarkers", "gaslightingIndex", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Power Dynamics Analyst",
          `Analyze the job text for power dynamics and manipulation tactics:
- Urgency pressure: "ASAP", "immediately", "urgent hire", "multiple offers pending", "act now"
- Love bombing: exaggerated praise, "best team ever", "you're the one", "perfect fit"
- Guilt induction: "team is overwhelmed", "we really need you", "hard to fill"
- Gaslighting: contradictory claims in same text ("work-life balance" + "24/7 on-call")
- Power moves: "take it or leave it", "offer expires", "non-negotiable", NDAs that prevent comparison
- Respect markers: transparent salary ranges, clear expectations, reasonable timelines

Score powerScore 0-100 based on density and severity of manipulation signals.
Score gaslightingIndex 0-100 based on internal contradictions found.
Only flag what the text actually contains — do not invent.`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    powerScore: clampScore(result.arguments.powerScore),
    manipulationSignals: (result.arguments.manipulationSignals as ManipulationSignal[]).slice(0, 5),
    respectMarkers: (result.arguments.respectMarkers as string[]).slice(0, 3),
    gaslightingIndex: clampScore(result.arguments.gaslightingIndex),
    summary: result.arguments.summary,
  };
}
