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
  runLegalAgent,
  runCriticAgent,
  runOrchestratorAgent,
} from "./agents.server";
import { runSwarmJob, type SwarmPatch } from "./analysis-swarm.server";
import { runPreliminaryAnalysis } from "./preliminary.server";
import { runCompanyDeepDive } from "./company-deep-dive.server";
import { sendReportEmail } from "./email.server";

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
      email: z.string().email().optional().or(z.literal("")),
      emailConsent: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const analysisId = genId();

    progressStore.set(analysisId, {
      status: "running",
      progress: resetProgress(),
    });

    // Run preliminary analysis (fast first-pass)
    runPreliminaryAnalysis(data.sourceText).then((preliminary) => {
      const current = progressStore.get(analysisId);
      if (current) {
        current.preliminary = preliminary;
      }
    }).catch(() => {
      // Non-blocking — preliminary is optional
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
      { id: "legal" as const, run: runLegalAgent },
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
    const swarmPromise = runSwarmJob({
      analysisId,
      input,
      specialistAgents,
      criticAgent,
      orchestratorAgent,
      persistPatch,
    });

    swarmPromise.catch((err) => {
      console.error("Swarm job unhandled exception:", err);
    });

    // After swarm complete, trigger email + deep dive if opted in
    if (data.email && data.emailConsent) {
      swarmPromise.then(async () => {
        const current = progressStore.get(analysisId);
        const result = current?.result;
        if (!result) return;

        // Generate PDF
        let pdfBase64: string | null = null;
        try {
          const { jsPDF } = await import("jspdf");
          const doc = new jsPDF();
          doc.text("OfferGuard AI Report", 20, 20);
          doc.text(`Company: ${result.company || "N/A"}`, 20, 30);
          doc.text(`Role: ${result.roleTitle || "N/A"}`, 20, 40);
          if (result.orchestrator) {
            doc.text(`Verdict: ${result.orchestrator.recommendation}`, 20, 50);
            doc.text(result.orchestrator.verdict, 20, 60);
          }
          const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
          pdfBase64 = pdfBuffer.toString("base64");
        } catch (err) {
          console.error("PDF generation failed:", err);
        }

        // Wave 1: Send main report
        await sendReportEmail(data.email!, result, undefined, pdfBase64);

        // Wave 2: Company deep dive (only if we have a company name)
        if (result.company && result.company !== "Unknown Company") {
          if (current) current.progress.companyDeepDive = "running";
          try {
            const deepDive = await runCompanyDeepDive(result.company);
            if (current?.result) {
              current.result = { ...current.result, companyDeepDive: deepDive };
            }
            if (current) current.progress.companyDeepDive = "complete";
            await sendReportEmail(data.email!, result, deepDive, undefined);
          } catch (err) {
            if (current) current.progress.companyDeepDive = "failed";
            console.error("Company deep dive failed:", err);
          }
        }
      }).catch((err) => {
        console.error("Email + deep dive pipeline failed:", err);
      });
    }

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
        preliminary: null,
      };
    }
    return {
      status: cached.status,
      error: cached.error,
      progress: cached.progress,
      result: cached.result ?? null,
      preliminary: cached.preliminary ?? null,
    };
  });
