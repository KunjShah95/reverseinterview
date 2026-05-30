import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AnalysisResult, AnalysisProgress, AnalysisStatus } from "./analysis-types";
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
  runCriticAgent,
  runOrchestratorAgent,
} from "./agents.server";

export type RunProgress = {
  culture: "pending" | "running" | "complete" | "failed";
  burnout: "pending" | "running" | "complete" | "failed";
  salary: "pending" | "running" | "complete" | "failed";
  ghost: "pending" | "running" | "complete" | "failed";
  negotiation: "pending" | "running" | "complete" | "failed";
  reverse: "pending" | "running" | "complete" | "failed";
  lie: "pending" | "running" | "complete" | "failed";
  simulation: "pending" | "running" | "complete" | "failed";
  critic: "pending" | "running" | "complete" | "failed";
  orchestrator: "pending" | "running" | "complete" | "failed";
};

type RunStatus = {
  status: "running" | "complete" | "failed";
  error?: string;
  progress: RunProgress;
  result?: AnalysisResult;
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
    }),
  )
  .handler(async ({ data }) => {
    const analysisId = genId();

    progressStore.set(analysisId, {
      status: "running",
      progress: {
        culture: "running",
        burnout: "running",
        salary: "running",
        ghost: "running",
        negotiation: "running",
        reverse: "running",
        lie: "running",
        simulation: "running",
        critic: "pending",
        orchestrator: "pending",
      },
    });

    (async () => {
      try {
        const input: AnalysisInput = {
          sourceText: data.sourceText,
          company: data.company,
          roleTitle: data.roleTitle,
          offeredSalary: data.offeredSalary,
          location: data.location,
          yearsExperience: data.yearsExperience,
        };

        const [culture, burnout, salary, ghost, negotiation, reverse, lie, simulation] =
          await Promise.all([
            runCultureAgent(input),
            runBurnoutAgent(input),
            runSalaryAgent(input),
            runGhostAgent(input),
            runNegotiationAgent(input),
            runReverseAgent(input),
            runLieAgent(input),
            runSimulationAgent(input),
          ]);

        const status = progressStore.get(analysisId);
        if (status) {
          status.progress.culture = "complete";
          status.progress.burnout = "complete";
          status.progress.salary = "complete";
          status.progress.ghost = "complete";
          status.progress.negotiation = "complete";
          status.progress.reverse = "complete";
          status.progress.lie = "complete";
          status.progress.simulation = "complete";
          status.progress.critic = "running";
        }

        const specialistResults = {
          culture,
          burnout,
          salary,
          ghost,
          negotiation,
          reverse,
          lie,
          simulation,
        } as any;

        const critic = await runCriticAgent(input, specialistResults, {});

        if (progressStore.get(analysisId)) {
          const s = progressStore.get(analysisId)!;
          s.progress.critic = "complete";
          s.progress.orchestrator = "running";
        }

        const orchestrator = await runOrchestratorAgent(input, specialistResults, {}, critic);

        const result: AnalysisResult = {
          company: data.company || pickCompany(data.sourceText),
          roleTitle: data.roleTitle || pickRole(data.sourceText),
          culture,
          burnout,
          salary,
          ghost,
          negotiation,
          reverse,
          lie,
          simulation,
          critic,
          orchestrator,
        };

        if (progressStore.get(analysisId)) {
          const s = progressStore.get(analysisId)!;
          s.status = "complete";
          s.progress.orchestrator = "complete";
          s.result = result;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        if (progressStore.get(analysisId)) {
          const s = progressStore.get(analysisId)!;
          s.status = "failed";
          s.error = message;
        }
      }
    })();

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
