import { callStructured, AIServiceError } from "./ai-gateway.server";
import { fetchMarketSalary, formatMarketRange } from "./salary-data.server";
import type {
  CultureAgent,
  BurnoutAgent,
  SalaryAgent,
  GhostAgent,
  NegotiationAgent,
  ReverseAgent,
  LieAgent,
  SimulationAgent,
  CriticAgent,
  Orchestrator,
  LegalAgent,
  ManagerRadarAgent,
  ManagerStyle,
  ManagerRadarSignal,
  PowerDynamicsAgent,
  ManipulationSignal,
  TeamChemistryAgent,
  TeamArchetype,
  TeamChemistrySignal,
  Confidence,
} from "./analysis-types";

export type AnalysisInput = {
  sourceText: string;
  company?: string;
  roleTitle?: string;
  offeredSalary?: string;
  location?: string;
  yearsExperience?: string;
  jobDescriptionText?: string;
  recruiterChatText?: string;
  offerLetterText?: string;
};

const SYSTEM_BASE = `You are a specialist job-offer analyst. You read job posts, offer letters, and recruiter messages and return honest, evidence-backed analysis.

STRICT GROUNDING RULES — follow exactly:
- Base EVERY finding, score, and number ONLY on what the provided text explicitly states. Do not invent, assume, or extrapolate beyond the text.
- When you cite a signal, it must come from an actual phrase in the text. Quote or closely paraphrase that phrase.
- If the text does not contain information to assess something, say so: use "unknown", an empty array, or the lowest confidence — do NOT guess.
- Do not add generic career advice, filler, or content unrelated to this specific offer/chat.
- Any numeric score must reflect evidence density in the text. No text evidence = neutral/unknown, never a made-up number.
- For market/salary comparisons, only estimate when the text provides concrete figures (salary, level, location) to anchor against; otherwise return "unknown" with low confidence.`;

function systemPrompt(role: string, instructions: string): string {
  return `${SYSTEM_BASE}

Your specialty: ${role}

${instructions}`;
}

function userPrompt(text: string, extra?: string): string {
  return `Analyze this job text carefully. Base your analysis ONLY on what the text says.

TEXT TO ANALYZE:
---
${text}
---
${extra ? `\n${extra}` : ""}`;
}

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
    toxicityScore: Math.max(0, Math.min(100, Math.round(result.arguments.toxicityScore))),
    flags: result.arguments.flags.slice(0, 6),
    summary: result.arguments.summary,
  };
}

export async function runBurnoutAgent(input: AnalysisInput): Promise<BurnoutAgent> {
  const result = await callStructured<{
    burnoutRisk: number;
    overtimeProbability: number;
    signals: string[];
    summary: string;
  }>({
    toolName: "burnoutAnalysis",
    toolDescription:
      "Assess burnout risk, overtime expectations, and workload sustainability from the job text.",
    parameters: {
      type: "object",
      properties: {
        burnoutRisk: {
          type: "number",
          description: "Burnout risk score 0-100. 0=very sustainable, 100=extremely high risk.",
          minimum: 0,
          maximum: 100,
        },
        overtimeProbability: {
          type: "number",
          description: "Likelihood of regular overtime 0-100.",
          minimum: 0,
          maximum: 100,
        },
        signals: {
          type: "array",
          description: "Specific workload or burnout signals found. Max 5.",
          items: { type: "string" },
        },
        summary: { type: "string", description: "1-2 sentence burnout risk summary" },
      },
      required: ["burnoutRisk", "overtimeProbability", "signals", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Burnout Risk Analyst",
          `Analyze the job text for:
- Overtime signals (urgent hiring, "fast-paced", "wear many hats", on-call expectations)
- Workload intensity indicators
- Turnover risk signs
- Work-life balance claims vs. implied expectations
- Team size and support structure hints
- "Unlimited PTO" and similar patterns

Score burnout risk and overtime probability 0-100 based ONLY on evidence in the text.`,
        ),
      },
      { role: "user", content: userPrompt(input.sourceText) },
    ],
  });
  return {
    burnoutRisk: Math.max(0, Math.min(100, Math.round(result.arguments.burnoutRisk))),
    overtimeProbability: Math.max(
      0,
      Math.min(100, Math.round(result.arguments.overtimeProbability)),
    ),
    signals: result.arguments.signals.slice(0, 5),
    summary: result.arguments.summary,
  };
}

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
    ghostScore: Math.max(0, Math.min(100, Math.round(result.arguments.ghostScore))),
    signals: result.arguments.signals.slice(0, 5),
    summary: result.arguments.summary,
  };
}

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

export async function runLieAgent(input: AnalysisInput): Promise<LieAgent> {
  const hasTimeline = !!(input.jobDescriptionText || input.recruiterChatText || input.offerLetterText);

  const result = await callStructured<{
    mismatches: Array<{
      claim: string;
      evidence: string;
      confidence: "low" | "medium" | "high";
    }>;
    discrepancies?: Array<{
      category: "Location" | "Compensation" | "Scope" | "Benefits" | "Other";
      jdClaim?: string;
      chatClaim?: string;
      contractClaim?: string;
      severity: "low" | "medium" | "high";
      assessment: string;
    }>;
    summary: string;
  }>({
    toolName: "claimVerification",
    toolDescription:
      "Find contradictions, inconsistencies, and unsupported claims within the job text or across the hiring timeline stages.",
    parameters: {
      type: "object",
      properties: {
        mismatches: {
          type: "array",
          description: "Internal contradictions found within the main text itself. Max 4.",
          items: {
            type: "object",
            properties: {
              claim: { type: "string", description: "The claim or promise made" },
              evidence: {
                type: "string",
                description: "Contradicting evidence from elsewhere in the text",
              },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["claim", "evidence", "confidence"],
          },
        },
        discrepancies: {
          type: "array",
          description: "Shifts and discrepancies between recruiting timeline stages (JD, Chat/Emails, and Offer/Contract). Max 5.",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["Location", "Compensation", "Scope", "Benefits", "Other"] },
              jdClaim: { type: "string", description: "What was stated in the Job Description, if applicable." },
              chatClaim: { type: "string", description: "What was promised in recruiter chats/emails, if applicable." },
              contractClaim: { type: "string", description: "What was written in the final offer letter/contract, if applicable." },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              assessment: { type: "string", description: "Explain the shift or bait-and-switch details in plain terms." }
            },
            required: ["category", "severity", "assessment"]
          }
        },
        summary: { type: "string", description: "1-2 sentence summary of contradictions or timeline discrepancies found." },
      },
      required: ["mismatches", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "HR Claim Verifier / Lie & Discrepancy Detector",
          `Read the job texts and identify contradictions and timeline shifts.
${
  hasTimeline
    ? `You have separate texts for:
1. The Job Description
2. Recruiter Emails/Chats
3. The final Offer Letter/Contract

Compare these documents chronologically. Look for:
- "Bait-and-switch" shifts in location (e.g. Remote promised in JD, Hybrid or On-site in contract)
- Compensation changes (e.g. $130k base discussed in email, $115k in contract)
- Scope shifts (e.g. Senior role title, but contract says Junior or expands duties heavily without adjustment)
- Benefit shifts (e.g. Unlimited PTO discussed, but contract specifies strict caps/limits)`
    : `Find internal inconsistencies within the text (e.g., "work-life balance" vs "on-call", "unlimited PTO" vs "high burnout", etc.).`
}

Only flag discrepancies that are genuinely present. Return empty arrays if none found.`,
        ),
      },
      {
        role: "user",
        content: userPrompt(
          input.sourceText,
          hasTimeline
            ? `TIMELINE DOCUMENTS TO CROSS-REFERENCE:
1. Job Description:
${input.jobDescriptionText || "(Not provided)"}

2. Recruiter Emails/Chats:
${input.recruiterChatText || "(Not provided)"}

3. Final Offer Letter / Contract:
${input.offerLetterText || "(Not provided)"}`
            : undefined,
        ),
      },
    ],
  });
  return {
    mismatches: result.arguments.mismatches.slice(0, 4),
    discrepancies: result.arguments.discrepancies?.slice(0, 5),
    summary: result.arguments.summary,
  };
}

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
    promotionProbability: Math.max(
      0,
      Math.min(100, Math.round(result.arguments.promotionProbability)),
    ),
    retentionProbability: Math.max(
      0,
      Math.min(100, Math.round(result.arguments.retentionProbability)),
    ),
  };
}

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
    autonomyScore: Math.max(0, Math.min(100, Math.round(result.arguments.autonomyScore))),
    communicationClarity: Math.max(0, Math.min(100, Math.round(result.arguments.communicationClarity))),
    redFlags: (result.arguments.redFlags as string[]).slice(0, 3),
    summary: result.arguments.summary,
  };
}

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
    powerScore: Math.max(0, Math.min(100, Math.round(result.arguments.powerScore))),
    manipulationSignals: (result.arguments.manipulationSignals as ManipulationSignal[]).slice(0, 5),
    respectMarkers: (result.arguments.respectMarkers as string[]).slice(0, 3),
    gaslightingIndex: Math.max(0, Math.min(100, Math.round(result.arguments.gaslightingIndex))),
    summary: result.arguments.summary,
  };
}

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
    crossFunctionality: Math.max(0, Math.min(100, Math.round(result.arguments.crossFunctionality))),
    supportStructure: Math.max(0, Math.min(100, Math.round(result.arguments.supportStructure))),
    teamHealthScore: Math.max(0, Math.min(100, Math.round(result.arguments.teamHealthScore))),
    signals: (result.arguments.signals as TeamChemistrySignal[]).slice(0, 4),
    summary: result.arguments.summary,
  };
}

export async function runCriticAgent(
  input: AnalysisInput,
  specialistResults: Record<string, unknown>,
  specialistErrors: Partial<Record<string, string>>,
): Promise<CriticAgent> {
  const result = await callStructured<{
    unsupportedClaims: string[];
    contradictions: string[];
    confidenceWarnings: string[];
    summary: string;
  }>({
    toolName: "criticReview",
    toolDescription:
      "Review all specialist analyses for quality issues, contradictions, unsupported claims, and confidence warnings.",
    parameters: {
      type: "object",
      properties: {
        unsupportedClaims: {
          type: "array",
          description:
            "Claims made by specialists that are not supported by the original job text. Max 4.",
          items: { type: "string" },
        },
        contradictions: {
          type: "array",
          description: "Contradictions between different specialist analyses. Max 4.",
          items: { type: "string" },
        },
        confidenceWarnings: {
          type: "array",
          description: "Warnings about analysis quality or confidence. Max 3.",
          items: { type: "string" },
        },
        summary: {
          type: "string",
          description: "1-2 sentence quality assessment of the overall analysis",
        },
      },
      required: ["unsupportedClaims", "contradictions", "confidenceWarnings", "summary"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Analysis Critic / Quality Reviewer",
          `Review all specialist analysis results for a job text analysis. Your job is to catch:
- Claims that go beyond what the original job text supports
- Contradictions between different specialist assessments
- Overconfidence where evidence is thin
- Missing important signals the specialists overlooked

Be honest and constructive. Do not invent problems. The goal is quality, not criticism for its own sake.`,
        ),
      },
      {
        role: "user",
        content: `ORIGINAL JOB TEXT:
---
${input.sourceText}
---

${input.company ? `Company: ${input.company}` : ""}
${input.roleTitle ? `Role: ${input.roleTitle}` : ""}

SPECIALIST RESULTS:
${JSON.stringify(specialistResults, null, 2)}

SPECIALIST ERRORS:
${JSON.stringify(specialistErrors, null, 2)}

Review these analyses for quality issues. Focus on whether they stay grounded in the original text.`,
      },
    ],
  });
  return {
    unsupportedClaims: result.arguments.unsupportedClaims.slice(0, 4),
    contradictions: result.arguments.contradictions.slice(0, 4),
    confidenceWarnings: result.arguments.confidenceWarnings.slice(0, 3),
    summary: result.arguments.summary,
  };
}

export async function runOrchestratorAgent(
  input: AnalysisInput,
  specialistResults: Record<string, unknown>,
  specialistErrors: Partial<Record<string, string>>,
  critic: CriticAgent | null,
): Promise<Orchestrator> {
  const result = await callStructured<{
    recommendation: "proceed" | "caution" | "avoid";
    verdict: string;
    truthScore: {
      transparency: number;
      workLifeBalance: number;
      careerGrowth: number;
      hiringIntegrity: number;
      compensationFairness: number;
    };
    topRisks: string[];
    topGreens: string[];
  }>({
    toolName: "finalVerdict",
    toolDescription:
      "Produce the final TruthScore, recommendation, and summary verdict combining all specialist analyses.",
    parameters: {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["proceed", "caution", "avoid"],
        },
        verdict: {
          type: "string",
          description: "A single compelling sentence summarizing the overall assessment",
        },
        truthScore: {
          type: "object",
          properties: {
            transparency: {
              type: "number",
              description: "How honest and transparent the posting seems 0-100",
              minimum: 0,
              maximum: 100,
            },
            workLifeBalance: {
              type: "number",
              description: "Expected work-life balance quality 0-100",
              minimum: 0,
              maximum: 100,
            },
            careerGrowth: {
              type: "number",
              description: "Opportunities for growth and learning 0-100",
              minimum: 0,
              maximum: 100,
            },
            hiringIntegrity: {
              type: "number",
              description: "Whether the hiring process appears genuine 0-100",
              minimum: 0,
              maximum: 100,
            },
            compensationFairness: {
              type: "number",
              description: "Fairness of compensation based on available data 0-100",
              minimum: 0,
              maximum: 100,
            },
          },
          required: [
            "transparency",
            "workLifeBalance",
            "careerGrowth",
            "hiringIntegrity",
            "compensationFairness",
          ],
        },
        topRisks: {
          type: "array",
          description: "Top 3 risks the candidate should be aware of",
          items: { type: "string" },
        },
        topGreens: {
          type: "array",
          description: "Top 3 positive signals or green flags",
          items: { type: "string" },
        },
      },
      required: ["recommendation", "verdict", "truthScore", "topRisks", "topGreens"],
    },
    messages: [
      {
        role: "system",
        content: systemPrompt(
          "Senior Reviewer / Final Verdict",
          `You are the senior reviewer. You have access to all specialist analyses and the critic review. Your job is to:
1. Weigh all evidence and produce a single clear recommendation: proceed, caution, or avoid
2. Assign TruthScore dimensions (0-100 each) based on the overall evidence
3. Write a compelling one-sentence verdict that captures the essence
4. List the top 3 risks and top 3 green flags

Be honest and balanced. A "caution" or "avoid" should only come when there is genuine evidence of problems. A "proceed" should acknowledge any open questions.

Each TruthScore dimension should reflect genuine analysis:
- transparency: how much the posting hides vs reveals
- workLifeBalance: real workload expectations
- careerGrowth: advancement opportunities visible in the text
- hiringIntegrity: whether the process feels genuine
- compensationFairness: pay relative to expectations`,
        ),
      },
      {
        role: "user",
        content: `ORIGINAL JOB TEXT:
---
${input.sourceText}
---

${input.company ? `Company: ${input.company}` : ""}
${input.roleTitle ? `Role: ${input.roleTitle}` : ""}

SPECIALIST RESULTS:
${JSON.stringify(specialistResults, null, 2)}

SPECIALIST ERRORS:
${JSON.stringify(specialistErrors, null, 2)}

CRITIC REVIEW:
${critic ? JSON.stringify(critic, null, 2) : "Not available"}

Produce your final verdict. Be honest and evidence-based.`,
      },
    ],
  });
  return {
    recommendation: result.arguments.recommendation,
    verdict: result.arguments.verdict,
    truthScore: {
      transparency: Math.max(
        0,
        Math.min(100, Math.round(result.arguments.truthScore.transparency)),
      ),
      workLifeBalance: Math.max(
        0,
        Math.min(100, Math.round(result.arguments.truthScore.workLifeBalance)),
      ),
      careerGrowth: Math.max(
        0,
        Math.min(100, Math.round(result.arguments.truthScore.careerGrowth)),
      ),
      hiringIntegrity: Math.max(
        0,
        Math.min(100, Math.round(result.arguments.truthScore.hiringIntegrity)),
      ),
      compensationFairness: Math.max(
        0,
        Math.min(100, Math.round(result.arguments.truthScore.compensationFairness)),
      ),
    },
    topRisks: result.arguments.topRisks.slice(0, 3),
    topGreens: result.arguments.topGreens.slice(0, 3),
  };
}
