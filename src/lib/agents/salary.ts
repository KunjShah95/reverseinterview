import { callStructured } from "../ai-gateway.server";
import { fetchMarketSalary, formatMarketRange } from "../salary-data.server";
import type { SalaryAgent } from "../analysis-types";
import { type AnalysisInput, systemPrompt, userPrompt } from "./shared";

export async function runSalaryAgent(input: AnalysisInput): Promise<SalaryAgent> {
  // Pull REAL market compensation before the LLM runs, so the verdict is
  // anchored to actual posting data instead of a hallucinated range. Null when
  // no key / no match — the agent then falls back to its model estimate.
  const marketData = await fetchMarketSalary({
    title: input.roleTitle || "",
    location: input.location,
  });

  const result = await callStructured<{
    verdict: "underpaid" | "fair" | "overpaid" | "unknown";
    marketRangeEstimate: string;
    confidence: "low" | "medium" | "high";
    reasoning: string;
    equityDetails?: {
      optionsGranted?: number;
      strikePrice?: number;
      estimatedPercentage?: number;
      vestingSchedule?: string;
    };
  }>({
    toolName: "salaryAnalysis",
    toolDescription:
      "Evaluate salary, compensation fairness, and extract stock options/equity details from the job text.",
    parameters: {
      type: "object",
      properties: {
        verdict: {
          type: "string",
          enum: ["underpaid", "fair", "overpaid", "unknown"],
          description: "Fairness verdict based on available information",
        },
        marketRangeEstimate: {
          type: "string",
          description: "Estimated market range for this role, or note if insufficient data",
        },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Confidence in the salary assessment",
        },
        reasoning: {
          type: "string",
          description: "2-3 sentence explanation of the salary verdict",
        },
        equityDetails: {
          type: "object",
          description: "Structured details about any stock options, RSUs, or equity mentioned in the text.",
          properties: {
            optionsGranted: { type: "number", description: "Number of options or shares granted, if explicitly specified." },
            strikePrice: { type: "number", description: "The strike or exercise price of the options, if specified." },
            estimatedPercentage: { type: "number", description: "Estimated equity percentage (e.g. 0.05 for 0.05%), if specified." },
            vestingSchedule: { type: "string", description: "Description of the vesting schedule, e.g. '1-year cliff, 4-year monthly vesting'." }
          }
        }
      },
      required: ["verdict", "marketRangeEstimate", "confidence", "reasoning"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Compensation & Equity Analyst",
          `Analyze the job text for compensation signals:
- Salary range transparency vs. vagueness
- Whether stated salary matches role seniority expectations
- Equity, bonus, and benefits quality
- Location-based compensation context
- Stock/options language quality (extract optionsGranted, strikePrice, estimatedPercentage, and vestingSchedule if available)

Use the provided offeredSalary, location, yearsExperience if supplied as additional context.

Verdict meaning:
- underpaid: compensation is clearly below what the role/scope demands
- fair: compensation seems reasonable for the described scope
- overpaid: compensation appears above market (rare)
- unknown: not enough compensation data to judge

Base verdict ONLY on what the text and provided context supports.`,
        ),
      },
      {
        role: "user",
        content: userPrompt(
          input.sourceText,
          [
            input.offeredSalary && `Offered salary/compensation: ${input.offeredSalary}`,
            input.location && `Location: ${input.location}`,
            input.yearsExperience && `Candidate experience: ${input.yearsExperience} years`,
            marketData &&
              `REAL MARKET DATA (authoritative — sourced from ${marketData.source} across ${marketData.sampleSize} live postings for "${marketData.title}"${marketData.location ? ` in ${marketData.location}` : ""}): ${formatMarketRange(marketData)}. Base your verdict and marketRangeEstimate on THESE real numbers, not a guess. Compare the offered compensation against this range.`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      },
    ],
  });
  return {
    verdict: result.arguments.verdict,
    // Prefer the real, sourced range over the model's estimate when available.
    marketRangeEstimate: marketData
      ? formatMarketRange(marketData)
      : result.arguments.marketRangeEstimate,
    confidence: result.arguments.confidence,
    reasoning: result.arguments.reasoning,
    equityDetails: result.arguments.equityDetails,
    marketData,
  };
}
