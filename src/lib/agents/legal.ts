import { callStructured } from "../ai-gateway.server";
import type { LegalAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt } from "./shared";

export async function runLegalAgent(input: AnalysisInput): Promise<LegalAgent> {
  const result = await callStructured<{
    clauses: Array<{
      clauseType: "IP Assignment" | "Clawback" | "Non-Compete" | "Termination" | "Equity Vesting" | "Other";
      extractedText: string;
      riskRating: "low" | "medium" | "high";
      explanation: string;
      mitigationStrategy: string;
    }>;
    summary: string;
  }>({
    toolName: "legalTrapScanner",
    toolDescription: "Scan the employment contract or offer letter text for predatory legal clauses and traps.",
    parameters: {
      type: "object",
      properties: {
        clauses: {
          type: "array",
          description: "Extracted legal clauses with their risk ratings and mitigation advice. Max 5.",
          items: {
            type: "object",
            properties: {
              clauseType: {
                type: "string",
                enum: ["IP Assignment", "Clawback", "Non-Compete", "Termination", "Equity Vesting", "Other"]
              },
              extractedText: { type: "string", description: "The raw text of the clause or sentence(s) of interest." },
              riskRating: { type: "string", enum: ["low", "medium", "high"] },
              explanation: { type: "string", description: "What this clause means in plain English, and why it is a trap or risk." },
              mitigationStrategy: { type: "string", description: "How the candidate can negotiate or clarify this clause to protect themselves." }
            },
            required: ["clauseType", "extractedText", "riskRating", "explanation", "mitigationStrategy"]
          }
        },
        summary: { type: "string", description: "1-2 sentence overall legal risk summary." }
      },
      required: ["clauses", "summary"]
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Legal Trap Scanner & Contract Auditor",
          `Analyze the job text/offer letter for predatory or highly restrictive legal clauses:
- IP Assignment: does it claim personal/off-hours projects or prior inventions?
- Clawbacks: requirements to pay back signing bonuses, relocation, or training costs if leaving early.
- Non-Compete: limits on future employment (duration, geography, scope).
- Termination: notice period imbalances (e.g. they can fire immediately, but candidate must give 4 weeks) or at-will traps.
- Equity Vesting: bad leaver provisions, lack of acceleration during acquisition.

Keep assessments realistic and practical. Return empty clauses array if no legal traps are detected.`
        )
      },
      { role: "user", content: userPrompt(input.sourceText) }
    ]
  });
  return {
    clauses: result.arguments.clauses.slice(0, 5),
    summary: result.arguments.summary
  };
}
