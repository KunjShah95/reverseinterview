import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callStructured } from "./ai-gateway.server";
import type {
  AnalysisProgress,
  AnalysisResult,
  AnalysisStatus,
  CultureAgent,
  BurnoutAgent,
  SalaryAgent,
  GhostAgent,
  NegotiationAgent,
  ReverseAgent,
  LieAgent,
  SimulationAgent,
  Orchestrator,
  CriticAgent,
  PartialAnalysisResult,
} from "./analysis-types";
import { createInitialProgress, runSwarmJob, type SwarmPatch } from "./analysis-swarm.server";

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

const criticSchema = {
  type: "object",
  properties: {
    unsupportedClaims: { type: "array", items: { type: "string" } },
    contradictions: { type: "array", items: { type: "string" } },
    confidenceWarnings: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["unsupportedClaims", "contradictions", "confidenceWarnings", "summary"],
};

async function agent<T>(
  name: string,
  description: string,
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const { arguments: args } = await callStructured<T>({
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

const analysisInputSchema = z.object({
  sourceText: z.string().min(40).max(20000),
  company: z.string().max(200).optional(),
  roleTitle: z.string().max(200).optional(),
  offeredSalary: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  yearsExperience: z.string().max(50).optional(),
  sessionId: z.string().max(100).optional(),
});

type AnalysisInput = z.infer<typeof analysisInputSchema>;

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeProgress(
  current: AnalysisProgress,
  patch?: SwarmPatch["progress"],
): AnalysisProgress {
  if (!patch) return current;
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).map(([agentId, progress]) => [
        agentId,
        { ...current[agentId as keyof AnalysisProgress], ...progress },
      ]),
    ),
  } as AnalysisProgress;
}

async function markAnalysisFailed(analysisId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Analysis failed.";
  await supabaseAdmin
    .from("analyses")
    .update({
      status: "failed",
      error: message,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
}

async function startAnalysisSwarm(analysisId: string, input: AnalysisInput) {
  const ctx = baseContext(input.sourceText, {
    company: input.company,
    roleTitle: input.roleTitle,
    offeredSalary: input.offeredSalary,
    location: input.location,
    yearsExperience: input.yearsExperience,
  });
  let progress = createInitialProgress();
  let result: PartialAnalysisResult = {
    company: input.company || "Unknown company",
    roleTitle: input.roleTitle || "Unknown role",
  };

  const persistPatch = async (patch: SwarmPatch) => {
    progress = mergeProgress(progress, patch.progress);
    if (patch.result) {
      result = { ...result, ...patch.result };
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      progress: jsonSafe(progress),
      result: jsonSafe(result),
    };
    if (patch.status) update.status = patch.status;
    if (patch.error !== undefined) update.error = patch.error;
    if (patch.startedAt) update.started_at = patch.startedAt;
    if (patch.completedAt) update.completed_at = patch.completedAt;
    if (typeof result.company === "string") update.company = result.company;

    const { error } = await supabaseAdmin.from("analyses").update(update).eq("id", analysisId);
    if (error) throw new Error(error.message);
  };

  try {
    await runSwarmJob({
      analysisId,
      input,
      persistPatch,
      specialistAgents: [
        {
          id: "culture",
          run: () =>
            agent<CultureAgent>(
              "culture_analysis",
              "Detect toxic, manipulative, or hidden-meaning phrases.",
              "You are a workplace culture analyst. Identify suspicious phrases like 'fast-paced', 'wear many hats', 'family culture', 'rockstar', 'self-starter' and explain their possible hidden meanings.",
              ctx,
              cultureSchema,
            ),
        },
        {
          id: "burnout",
          run: () =>
            agent<BurnoutAgent>(
              "burnout_prediction",
              "Estimate burnout & overtime risk.",
              "You are a burnout analyst. Score 0-100 risk based on role overlap, on-call hints, urgency language, and unrealistic expectations.",
              ctx,
              burnoutSchema,
            ),
        },
        {
          id: "salary",
          run: () =>
            agent<SalaryAgent>(
              "salary_fairness",
              "Compare offered comp to market.",
              "You are a compensation analyst. Estimate the market range for the role/level/location and assess fairness. If salary not provided or unknowable, say 'unknown' with low confidence.",
              ctx,
              salarySchema,
            ),
        },
        {
          id: "ghost",
          run: () =>
            agent<GhostAgent>(
              "ghost_hiring_detection",
              "Detect fake-urgency / ghost hiring signals.",
              "You are a hiring-integrity analyst. Look for fake urgency, vague responsibilities, repost cues, mass-hiring spam, suspiciously broad scope.",
              ctx,
              ghostSchema,
            ),
        },
        {
          id: "negotiation",
          run: () =>
            agent<NegotiationAgent>(
              "negotiation_coach",
              "Generate negotiation talking points & counter-offer.",
              "You are an expert salary negotiator. Give 4-6 talking points, a counter-offer template paragraph, and 2-4 red-line items the candidate should not concede.",
              ctx,
              negotiationSchema,
            ),
        },
        {
          id: "reverse",
          run: () =>
            agent<ReverseAgent>(
              "reverse_interview_generator",
              "Generate sharp interview questions for the candidate to ask back.",
              "You are an interview coach. Generate 8-12 SHARP, SPECIFIC, NON-GENERIC questions the candidate should ask. Replace soft questions ('What's the culture like?') with concrete ones ('What percentage of roadmap deadlines slipped last quarter?').",
              ctx,
              reverseSchema,
            ),
        },
        {
          id: "lie",
          run: () =>
            agent<LieAgent>(
              "hr_lie_detector",
              "Find mismatches between stated claims and observable evidence in the same text.",
              "You are an HR claim verifier. Find internal contradictions: claims in the text ('work-life balance', 'flat hierarchy') that are contradicted by other parts of the same text or by stated responsibilities. Return 0-5 mismatches.",
              ctx,
              lieSchema,
            ),
        },
        {
          id: "simulation",
          run: () =>
            agent<SimulationAgent>(
              "join_simulation",
              "Predict 6mo / 1yr / 2yr experience after joining.",
              "You are a career simulator. Predict the candidate's experience at 6 months, 1 year, and 2 years. Each phase needs a 1-2 sentence narrative and scores (0-100) for stress, growth, learning.",
              ctx,
              simulationSchema,
            ),
        },
      ],
      criticAgent: {
        id: "critic",
        run: ({ specialistResults, specialistErrors }) =>
          agent<CriticAgent>(
            "swarm_critic",
            "Review specialist outputs for unsupported or overconfident claims.",
            "You are a strict QA critic. Review the specialist agent outputs. Identify unsupported claims, contradictions, and any places where the confidence should be lower. Do not add new claims.",
            `SOURCE:\n"""\n${input.sourceText.slice(0, 4000)}\n"""\n\nSPECIALIST OUTPUTS:\n${JSON.stringify(
              specialistResults,
            ).slice(0, 10000)}\n\nSPECIALIST ERRORS:\n${JSON.stringify(specialistErrors)}`,
            criticSchema,
          ),
      },
      orchestratorAgent: {
        id: "orchestrator",
        run: async ({ specialistResults, specialistErrors, critic }) => {
          const orchestrator = await agent<Orchestrator & { company: string; roleTitle: string }>(
            "final_verdict",
            "Merge all agent outputs into a final recommendation.",
            "You are the senior reviewer. Read all available sub-agent outputs and critic feedback. Produce one TruthScore (0-100 per dimension), one recommendation (proceed/caution/avoid), one punchy 1-sentence verdict, top 3 risks, top 3 greens, plus the inferred company name and role title from the source. If some agents failed, rely only on available evidence and avoid overclaiming.",
            `SOURCE:\n"""\n${input.sourceText.slice(0, 4000)}\n"""\n\nAGENT OUTPUTS:\n${JSON.stringify(
              specialistResults,
            ).slice(0, 10000)}\n\nCRITIC FEEDBACK:\n${JSON.stringify(
              critic,
            )}\n\nAGENT ERRORS:\n${JSON.stringify(
              specialistErrors,
            )}\n\nProvided context: ${JSON.stringify({
              company: input.company,
              roleTitle: input.roleTitle,
            })}`,
            orchestratorSchema,
          );

          return {
            company: orchestrator.company || input.company || "Unknown company",
            roleTitle: orchestrator.roleTitle || input.roleTitle || "Unknown role",
            orchestrator: {
              recommendation: orchestrator.recommendation,
              verdict: orchestrator.verdict,
              truthScore: orchestrator.truthScore,
              topRisks: orchestrator.topRisks,
              topGreens: orchestrator.topGreens,
            },
          };
        },
      },
    });
  } catch (error) {
    console.error(error);
    await markAnalysisFailed(analysisId, error);
  }
}

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(analysisInputSchema)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId;
    const progress = createInitialProgress();
    const initialResult: PartialAnalysisResult = {
      company: data.company || "Unknown company",
      roleTitle: data.roleTitle || "Unknown role",
    };

    const { data: row, error } = await supabaseAdmin
      .from("analyses")
      .insert({
        user_id: userId ?? null,
        company: data.company ?? null,
        source_type: "text",
        source_text: data.sourceText.slice(0, 20000),
        structured_input: {
          roleTitle: data.roleTitle,
          offeredSalary: data.offeredSalary,
          location: data.location,
          yearsExperience: data.yearsExperience,
        },
        result: jsonSafe(initialResult),
        progress: jsonSafe(progress),
        status: "queued",
      })
      .select("id")
      .single();

    if (error || !row) {
      throw new Error(`Failed to create analysis job: ${error?.message}`);
    }

    void startAnalysisSwarm(row.id as string, data);

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
      result: row.result as PartialAnalysisResult | AnalysisResult | null,
      progress: row.progress as AnalysisProgress,
      status: row.status as AnalysisStatus,
      error: row.error as string | null,
      createdAt: row.created_at as string,
      startedAt: row.started_at as string | null,
      completedAt: row.completed_at as string | null,
    };
  });

export const listAnalysesForSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("analyses")
      .select("id, company, created_at, status, result, error")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      company: (r.company as string | null) ?? "Unknown",
      createdAt: r.created_at as string,
      status: r.status as AnalysisStatus,
      error: r.error as string | null,
      recommendation:
        (r.result as PartialAnalysisResult | null)?.orchestrator?.recommendation ?? null,
    }));
  });
