import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callStructured } from "./ai-gateway.server";
import type {
  AnalysisResult,
  CultureAgent,
  BurnoutAgent,
  SalaryAgent,
  GhostAgent,
  NegotiationAgent,
  ReverseAgent,
  LieAgent,
  SimulationAgent,
  Orchestrator,
} from "./analysis-types";

const baseContext = (text: string, input: Record<string, unknown>) =>
  `You are analyzing a job opportunity for a candidate. Cite EXACT short quotes from the source as evidence. Never make definitive accusations — use "possible interpretation". Mark confidence honestly.

SOURCE TEXT:
"""
${text.slice(0, 8000)}
"""

CANDIDATE CONTEXT: ${JSON.stringify(input)}`;

const cultureSchema = {
  type: "object",
  properties: {
    toxicityScore: { type: "number", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phrase: { type: "string" },
          hiddenMeaning: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["phrase", "hiddenMeaning", "severity"],
      },
    },
  },
  required: ["toxicityScore", "summary", "flags"],
};

const burnoutSchema = {
  type: "object",
  properties: {
    burnoutRisk: { type: "number", minimum: 0, maximum: 100 },
    overtimeProbability: { type: "number", minimum: 0, maximum: 100 },
    signals: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["burnoutRisk", "overtimeProbability", "signals", "summary"],
};

const salarySchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["underpaid", "fair", "overpaid", "unknown"] },
    marketRangeEstimate: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoning: { type: "string" },
  },
  required: ["verdict", "marketRangeEstimate", "confidence", "reasoning"],
};

const ghostSchema = {
  type: "object",
  properties: {
    ghostScore: { type: "number", minimum: 0, maximum: 100 },
    signals: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["ghostScore", "signals", "summary"],
};

const negotiationSchema = {
  type: "object",
  properties: {
    talkingPoints: { type: "array", items: { type: "string" } },
    counterOfferTemplate: { type: "string" },
    redLines: { type: "array", items: { type: "string" } },
  },
  required: ["talkingPoints", "counterOfferTemplate", "redLines"],
};

const reverseSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          q: { type: "string" },
          why: { type: "string" },
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
};

const lieSchema = {
  type: "object",
  properties: {
    mismatches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["claim", "evidence", "confidence"],
      },
    },
    summary: { type: "string" },
  },
  required: ["mismatches", "summary"],
};

const simulationSchema = {
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
          narrative: { type: "string" },
          stress: { type: "number", minimum: 0, maximum: 100 },
          growth: { type: "number", minimum: 0, maximum: 100 },
          learning: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["label", "narrative", "stress", "growth", "learning"],
      },
    },
    promotionProbability: { type: "number", minimum: 0, maximum: 100 },
    retentionProbability: { type: "number", minimum: 0, maximum: 100 },
  },
  required: ["phases", "promotionProbability", "retentionProbability"],
};

const orchestratorSchema = {
  type: "object",
  properties: {
    recommendation: { type: "string", enum: ["proceed", "caution", "avoid"] },
    verdict: { type: "string" },
    truthScore: {
      type: "object",
      properties: {
        transparency: { type: "number", minimum: 0, maximum: 100 },
        workLifeBalance: { type: "number", minimum: 0, maximum: 100 },
        careerGrowth: { type: "number", minimum: 0, maximum: 100 },
        hiringIntegrity: { type: "number", minimum: 0, maximum: 100 },
        compensationFairness: { type: "number", minimum: 0, maximum: 100 },
      },
      required: [
        "transparency",
        "workLifeBalance",
        "careerGrowth",
        "hiringIntegrity",
        "compensationFairness",
      ],
    },
    topRisks: { type: "array", items: { type: "string" } },
    topGreens: { type: "array", items: { type: "string" } },
    company: { type: "string" },
    roleTitle: { type: "string" },
  },
  required: [
    "recommendation",
    "verdict",
    "truthScore",
    "topRisks",
    "topGreens",
    "company",
    "roleTitle",
  ],
};

async function agent<T>(
  name: string,
  description: string,
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>
): Promise<T> {
  const { arguments: args } = await callStructured<T>({
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    toolName: name,
    toolDescription: description,
    parameters: schema,
  });
  return args;
}

export const runAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sourceText: z.string().min(40).max(20000),
      company: z.string().max(200).optional(),
      roleTitle: z.string().max(200).optional(),
      offeredSalary: z.string().max(100).optional(),
      location: z.string().max(200).optional(),
      yearsExperience: z.string().max(50).optional(),
      sessionId: z.string().max(100).optional(),
    })
  )
  .handler(async ({ data }) => {
    const ctx = baseContext(data.sourceText, {
      company: data.company,
      roleTitle: data.roleTitle,
      offeredSalary: data.offeredSalary,
      location: data.location,
      yearsExperience: data.yearsExperience,
    });

    const [culture, burnout, salary, ghost, negotiation, reverse, lie, simulation] =
      await Promise.all([
        agent<CultureAgent>(
          "culture_analysis",
          "Detect toxic, manipulative, or hidden-meaning phrases.",
          "You are a workplace culture analyst. Identify suspicious phrases like 'fast-paced', 'wear many hats', 'family culture', 'rockstar', 'self-starter' and explain their possible hidden meanings.",
          ctx,
          cultureSchema
        ),
        agent<BurnoutAgent>(
          "burnout_prediction",
          "Estimate burnout & overtime risk.",
          "You are a burnout analyst. Score 0-100 risk based on role overlap, on-call hints, urgency language, and unrealistic expectations.",
          ctx,
          burnoutSchema
        ),
        agent<SalaryAgent>(
          "salary_fairness",
          "Compare offered comp to market.",
          "You are a compensation analyst. Estimate the market range for the role/level/location and assess fairness. If salary not provided or unknowable, say 'unknown' with low confidence.",
          ctx,
          salarySchema
        ),
        agent<GhostAgent>(
          "ghost_hiring_detection",
          "Detect fake-urgency / ghost hiring signals.",
          "You are a hiring-integrity analyst. Look for fake urgency, vague responsibilities, repost cues, mass-hiring spam, suspiciously broad scope.",
          ctx,
          ghostSchema
        ),
        agent<NegotiationAgent>(
          "negotiation_coach",
          "Generate negotiation talking points & counter-offer.",
          "You are an expert salary negotiator. Give 4-6 talking points, a counter-offer template paragraph, and 2-4 red-line items the candidate should not concede.",
          ctx,
          negotiationSchema
        ),
        agent<ReverseAgent>(
          "reverse_interview_generator",
          "Generate sharp interview questions for the candidate to ask back.",
          "You are an interview coach. Generate 8-12 SHARP, SPECIFIC, NON-GENERIC questions the candidate should ask. Replace soft questions ('What's the culture like?') with concrete ones ('What percentage of roadmap deadlines slipped last quarter?').",
          ctx,
          reverseSchema
        ),
        agent<LieAgent>(
          "hr_lie_detector",
          "Find mismatches between stated claims and observable evidence in the same text.",
          "You are an HR claim verifier. Find internal contradictions: claims in the text ('work-life balance', 'flat hierarchy') that are contradicted by other parts of the same text or by stated responsibilities. Return 0-5 mismatches.",
          ctx,
          lieSchema
        ),
        agent<SimulationAgent>(
          "join_simulation",
          "Predict 6mo / 1yr / 2yr experience after joining.",
          "You are a career simulator. Predict the candidate's experience at 6 months, 1 year, and 2 years. Each phase needs a 1-2 sentence narrative and scores (0-100) for stress, growth, learning.",
          ctx,
          simulationSchema
        ),
      ]);

    // Orchestrator merges everything into a final verdict.
    const orchestrator = await agent<Orchestrator & { company: string; roleTitle: string }>(
      "final_verdict",
      "Merge all agent outputs into a final recommendation.",
      "You are the senior reviewer. Read all sub-agent outputs and produce one TruthScore (0-100 per dimension), one recommendation (proceed/caution/avoid), one punchy 1-sentence verdict, top 3 risks, top 3 greens, plus the inferred company name and role title from the source.",
      `SOURCE:\n"""\n${data.sourceText.slice(0, 4000)}\n"""\n\nAGENT OUTPUTS:\n${JSON.stringify(
        { culture, burnout, salary, ghost, lie, simulation }
      ).slice(0, 8000)}\n\nProvided context: ${JSON.stringify({
        company: data.company,
        roleTitle: data.roleTitle,
      })}`,
      orchestratorSchema
    );

    const result: AnalysisResult = {
      company: orchestrator.company || data.company || "Unknown company",
      roleTitle: orchestrator.roleTitle || data.roleTitle || "Unknown role",
      culture,
      burnout,
      salary,
      ghost,
      negotiation,
      reverse,
      lie,
      simulation,
      orchestrator: {
        recommendation: orchestrator.recommendation,
        verdict: orchestrator.verdict,
        truthScore: orchestrator.truthScore,
        topRisks: orchestrator.topRisks,
        topGreens: orchestrator.topGreens,
      },
    };

    const { data: row, error } = await supabaseAdmin
      .from("analyses")
      .insert({
        session_id: data.sessionId ?? null,
        company: result.company,
        source_type: "text",
        source_text: data.sourceText.slice(0, 20000),
        structured_input: {
          roleTitle: data.roleTitle,
          offeredSalary: data.offeredSalary,
          location: data.location,
          yearsExperience: data.yearsExperience,
        },
        result: JSON.parse(JSON.stringify(result)),
        status: "complete",
      })
      .select("id")
      .single();

    if (error || !row) {
      throw new Error(`Failed to persist analysis: ${error?.message}`);
    }

    return { id: row.id as string };
  });

export const getAnalysis = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("analyses")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Analysis not found");
    return {
      id: row.id as string,
      company: row.company as string | null,
      result: row.result as AnalysisResult | null,
      status: row.status as string,
      createdAt: row.created_at as string,
    };
  });

export const listAnalysesForSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("analyses")
      .select("id, company, created_at, status, result")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      company: (r.company as string | null) ?? "Unknown",
      createdAt: r.created_at as string,
      status: r.status as string,
      recommendation:
        (r.result as AnalysisResult | null)?.orchestrator?.recommendation ?? null,
    }));
  });
