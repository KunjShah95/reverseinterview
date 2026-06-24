import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  AnalysisProgress,
  PartialAnalysisResult,
  CriticAgent,
  PreliminaryResponse,
} from "./analysis-types";
import type { AnalysisInput } from "./agents.server";
import {
  runCultureAgent,
  runBurnoutAgent,
  runSalaryAgent,
  runGhostAgent,
  runNegotiationAgent,
  runReverseAgent,
  runLieAgent,
  runSimulationAgent,
  runManagerRadarAgent,
  runPowerDynamicsAgent,
  runTeamChemistryAgent,
  runCriticAgent,
  runOrchestratorAgent,
} from "./agents.server";
import { runSwarmJob, type SwarmPatch } from "./analysis-swarm.server";

export type RunProgress = {
  culture: "pending" | "running" | "complete" | "failed" | "skipped";
  burnout: "pending" | "running" | "complete" | "failed" | "skipped";
  salary: "pending" | "running" | "complete" | "failed" | "skipped";
  ghost: "pending" | "running" | "complete" | "failed" | "skipped";
  negotiation: "pending" | "running" | "complete" | "failed" | "skipped";
  reverse: "pending" | "running" | "complete" | "failed" | "skipped";
  lie: "pending" | "running" | "complete" | "failed" | "skipped";
  simulation: "pending" | "running" | "complete" | "failed" | "skipped";
  legal: "pending" | "running" | "complete" | "failed" | "skipped";
  managerRadar: "pending" | "running" | "complete" | "failed" | "skipped";
  powerDynamics: "pending" | "running" | "complete" | "failed" | "skipped";
  teamChemistry: "pending" | "running" | "complete" | "failed" | "skipped";
  companyDeepDive: "pending" | "running" | "complete" | "failed" | "skipped";
  critic: "pending" | "running" | "complete" | "failed" | "skipped";
  orchestrator: "pending" | "running" | "complete" | "failed" | "skipped";
};

type RunStatus = {
  status: "queued" | "running" | "complete" | "partial" | "failed";
  error?: string;
  progress: RunProgress;
  result?: PartialAnalysisResult;
  preliminary?: PreliminaryResponse;
};

function resetProgress(): RunProgress {
  return {
    culture: "pending",
    burnout: "pending",
    salary: "pending",
    ghost: "pending",
    negotiation: "pending",
    reverse: "pending",
    lie: "pending",
    simulation: "pending",
    legal: "pending",
    managerRadar: "pending",
    powerDynamics: "pending",
    teamChemistry: "pending",
    companyDeepDive: "pending",
    critic: "pending",
    orchestrator: "pending",
  };
}

const progressStore = new Map<string, RunStatus>();

function genId(): string {
  return `ai-${crypto.randomUUID()}`;
}

function pickCompany(text: string): string {
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (firstLine && firstLine.length <= 80) return firstLine.replace(/[:\-–—].*$/, "").trim();
  return "Unknown Company";
}

function pickRole(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("engineer")) return "Engineer";
  if (lower.includes("designer")) return "Designer";
  if (lower.includes("manager")) return "Manager";
  if (lower.includes("analyst")) return "Analyst";
  if (lower.includes("scientist")) return "Scientist";
  if (lower.includes("developer")) return "Developer";
  if (lower.includes("director")) return "Director";
  if (lower.includes("lead")) return "Lead";
  if (lower.includes("head")) return "Head";
  return "Unknown role";
}

export const startAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sourceText: z.string().min(40).max(100_000),
      company: z.string().optional(),
      roleTitle: z.string().optional(),
      offeredSalary: z.string().optional(),
      location: z.string().optional(),
      yearsExperience: z.string().optional(),
      jobDescriptionText: z.string().optional(),
      recruiterChatText: z.string().optional(),
      offerLetterText: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const analysisId = genId();

    progressStore.set(analysisId, {
      status: "running",
      progress: resetProgress(),
    });

    const input: AnalysisInput = {
      sourceText: data.sourceText,
      company: data.company,
      roleTitle: data.roleTitle,
      offeredSalary: data.offeredSalary,
      location: data.location,
      yearsExperience: data.yearsExperience,
      jobDescriptionText: data.jobDescriptionText,
      recruiterChatText: data.recruiterChatText,
      offerLetterText: data.offerLetterText,
    };

    const persistPatch = async (patch: SwarmPatch) => {
      const current = progressStore.get(analysisId);
      if (!current) return;

      if (patch.status) {
        current.status = patch.status;
      }
      if (patch.error !== undefined) {
        current.error = patch.error ?? undefined;
      }
      if (patch.progress) {
        for (const key of Object.keys(patch.progress) as (keyof RunProgress)[]) {
          const agentPatch = patch.progress[key];
          if (agentPatch) {
            current.progress[key] = agentPatch.status;
          }
        }
      }
      if (patch.result) {
        current.result = {
          company: data.company || pickCompany(data.sourceText),
          roleTitle: data.roleTitle || pickRole(data.sourceText),
          ...current.result,
          ...patch.result,
        } as PartialAnalysisResult;
      }
    };

    const specialistAgents = [
      { id: "culture" as const, run: runCultureAgent },
      { id: "burnout" as const, run: runBurnoutAgent },
      { id: "salary" as const, run: runSalaryAgent },
      { id: "ghost" as const, run: runGhostAgent },
      { id: "negotiation" as const, run: runNegotiationAgent },
      { id: "reverse" as const, run: runReverseAgent },
      { id: "lie" as const, run: runLieAgent },
      { id: "simulation" as const, run: runSimulationAgent },
      { id: "managerRadar" as const, run: runManagerRadarAgent },
      { id: "powerDynamics" as const, run: runPowerDynamicsAgent },
      { id: "teamChemistry" as const, run: runTeamChemistryAgent },
    ];

    const criticAgent = {
      id: "critic" as const,
      run: async (ctx: {
        sourceText: string;
        specialistResults: Partial<Record<string, unknown>>;
        specialistErrors: Partial<Record<string, string>>;
        company?: string;
        roleTitle?: string;
      }) => {
        return runCriticAgent(ctx, ctx.specialistResults, ctx.specialistErrors);
      },
    };

    const orchestratorAgent = {
      id: "orchestrator" as const,
      run: async (ctx: {
        sourceText: string;
        specialistResults: Partial<Record<string, unknown>>;
        specialistErrors: Partial<Record<string, string>>;
        critic: unknown;
        company?: string;
        roleTitle?: string;
      }) => {
        return runOrchestratorAgent(
          ctx,
          ctx.specialistResults,
          ctx.specialistErrors,
          ctx.critic as CriticAgent | null
        );
      },
    };

    // Run swarm in background and return analysis ID immediately
    runSwarmJob({
      analysisId,
      input,
      specialistAgents,
      criticAgent,
      orchestratorAgent,
      persistPatch,
    }).catch((err) => {
      console.error("Swarm job unhandled exception:", err);
    });

    return { analysisId };
  });

export const pollAnalysis = createServerFn({ method: "POST" })
  .inputValidator(z.object({ analysisId: z.string() }))
  .handler(async ({ data }) => {
    const cached = progressStore.get(data.analysisId);
    if (!cached) {
      return {
        status: "failed" as const,
        error: "Analysis not found",
        progress: resetProgress(),
        result: null,
      };
    }
    return {
      status: cached.status,
      error: cached.error,
      progress: cached.progress,
      result: cached.result ?? null,
    };
  });
