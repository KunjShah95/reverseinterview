import { callStructured } from "../ai-gateway.server";
import type { ReverseAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt } from "./shared";

export async function runReverseAgent(input: AnalysisInput): Promise<ReverseAgent> {
  const company = input.company || "the company";
  const role = input.roleTitle || "the role";
  const result = await callStructured<{
    questions: Array<{
      q: string;
      why: string;
      category: "Workload" | "Culture" | "Compensation" | "Growth" | "Stability";
    }>;
  }>({
    toolName: "reverseInterviewQuestions",
    toolDescription:
      "Generate sharp, specific questions the candidate should ask the employer during interviews.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description: "3-5 questions to ask during the interview process",
          items: {
            type: "object",
            properties: {
              q: { type: "string", description: "The question to ask" },
              why: {
                type: "string",
                description: "Why this question matters for this specific role",
              },
              category: {
                type: "string",
                enum: ["Workload", "Culture", "Compensation", "Growth", "Stability"],
              },
            },
            required: ["q", "why", "category"],
          },
        },
      },
      required: ["questions"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Reverse Interview Specialist",
          `Read the job text and generate questions the candidate should ask back. Each question should:
- Target a specific claim or gap in the job description
- Reveal information the employer is not volunteering
- Be practical and actionable for the candidate
- Cover different categories (Workload, Culture, Compensation, Growth, Stability)`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText, `Company: ${company}\nRole: ${role}`) },
    ],
  });
  return {
    questions: result.arguments.questions.slice(0, 5),
  };
}
