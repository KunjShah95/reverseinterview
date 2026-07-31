import { callStructured } from "../ai-gateway.server";
import type { NegotiationAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt } from "./shared";

export async function runNegotiationAgent(input: AnalysisInput): Promise<NegotiationAgent> {
  const company = input.company || "the company";
  const role = input.roleTitle || "the role";
  const result = await callStructured<{
    talkingPoints: string[];
    counterOfferTemplate: string;
    redLines: string[];
  }>({
    toolName: "negotiationStrategy",
    toolDescription:
      "Generate negotiation talking points, counter-offer template, and red lines based on the job text analysis.",
    parameters: {
      type: "object",
      properties: {
        talkingPoints: {
          type: "array",
          description: "3-5 negotiation talking points specific to this role and text",
          items: { type: "string" },
        },
        counterOfferTemplate: {
          type: "string",
          description:
            "A 2-3 sentence professional counter-offer template addressing specific concerns from the text",
        },
        redLines: {
          type: "array",
          description: "2-4 non-negotiable red lines specific to this job",
          items: { type: "string" },
        },
      },
      required: ["talkingPoints", "counterOfferTemplate", "redLines"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Negotiation Coach",
          `Read the job text and generate specific negotiation advice:
- Identify points of leverage from the job description itself
- Spot areas where the candidate should push back or clarify
- Identify potential red flags that should be dealbreakers unless addressed
- Base all advice on actual content in the text — do not make generic suggestions`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText, `Company: ${company}\nRole: ${role}`) },
    ],
  });
  return {
    talkingPoints: result.arguments.talkingPoints.slice(0, 5),
    counterOfferTemplate: result.arguments.counterOfferTemplate,
    redLines: result.arguments.redLines.slice(0, 4),
  };
}
