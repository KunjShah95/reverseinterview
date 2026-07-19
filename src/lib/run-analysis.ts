import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  PartialAnalysisResult,
  CriticAgent,
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
import { setJob, getJob, updateJob, type JobRecord } from "./job-store.server";

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

function genId(): string {
  return `ai-${crypto.randomUUID()}`;
}

// Keep background work (swarm + email/deep-dive) alive after the HTTP response
// is sent. On Vercel this uses the platform primitive; elsewhere the promise
// simply runs unobserved (the durable job store still captures its progress).
async function keepAlive(promise: Promise<unknown>): Promise<void> {
  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(promise);
  } catch {
    // Not on Vercel (e.g. local dev) — let the promise run in the background.
    void promise;
  }
}

function pickCompany(text: string): string {
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (firstLine && firstLine.length <= 80) return firstLine.replace(/[:\-–—].*$/, "").trim();
  return "Unknown Company";
}

// Cheap, zero-cost relevance gate. Runs BEFORE any LLM call so unrelated text
// (random questions, greetings, pasted code, spam) never spins up the 14-agent
// swarm and burns tokens. Only obvious non-job input is rejected — the bar is
// deliberately low so real offer letters / JDs / recruiter chats always pass,
// even terse ones.
const JOB_TERMS = [
  "job", "role", "position", "offer", "salary", "compensation", "comp",
  "employment", "employer", "employee", "hiring", "hire", "candidate",
  "responsibilities", "requirements", "qualifications", "benefits", "equity",
  "stock", "options", "vesting", "pto", "vacation", "remote", "onsite",
  "on-site", "hybrid", "full-time", "part-time", "contract", "recruiter",
  "interview", "company", "team", "manager", "experience", "skills",
  "engineer", "developer", "designer", "analyst", "scientist", "director",
  "bonus", "relocation", "start date", "offer letter", "job description",
  "work", "startup", "onboarding", "base pay", "wage", "annual", "per year",
  "reports to", "seniority", "senior", "junior", "lead", "intern", "internship",
];

function countJobTerms(text: string): number {
  const lower = text.toLowerCase();
  const seen = new Set<string>();
  for (const term of JOB_TERMS) {
    if (lower.includes(term)) seen.add(term);
  }
  return seen.size;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// A free-pasted blob must look like a real job document: enough length AND
// enough distinct job vocabulary. A one-liner with a stray keyword is not a JD.
function isJobRelated(text: string): boolean {
  return wordCount(text) >= 20 && countJobTerms(text) >= 3;
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
    // APIs fire only when the user actually supplied a JD / recruiter chat /
    // offer letter. The timeline fields are explicitly labeled by the user, so
    // trust them; free-pasted text must pass the keyword gate. Either way, no
    // token is spent on random/unrelated input.
    const hasStructuredDoc = !!(
      data.jobDescriptionText?.trim() ||
      data.recruiterChatText?.trim() ||
      data.offerLetterText?.trim()
    );

    if (!hasStructuredDoc && !isJobRelated(data.sourceText)) {
      return {
        analysisId: "",
        rejected: true as const,
        reason:
          "This doesn't look like a job description, offer letter, or recruiter message. Paste the actual job text and try again.",
      };
    }

    const analysisId = genId();

    await setJob(analysisId, {
      status: "running",
      progress: resetProgress(),
    });

    // Run preliminary analysis (fast first-pass)
    const preliminaryPromise = runPreliminaryAnalysis(data.sourceText)
      .then(async (preliminary) => {
        await updateJob(analysisId, (current) =>
          current ? { ...current, preliminary } : current,
        );
      })
      .catch(() => {
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
      await updateJob(analysisId, (current) => {
        if (!current) return current;
        const next: JobRecord = { ...current, progress: { ...current.progress } };

        if (patch.status) {
          next.status = patch.status;
        }
        if (patch.error !== undefined) {
          next.error = patch.error ?? undefined;
        }
        if (patch.progress) {
          for (const key of Object.keys(patch.progress) as (keyof RunProgress)[]) {
            const agentPatch = patch.progress[key];
            if (agentPatch) {
              next.progress[key] = agentPatch.status;
            }
          }
        }
        if (patch.result) {
          next.result = {
            company: data.company || pickCompany(data.sourceText),
            roleTitle: data.roleTitle || pickRole(data.sourceText),
            ...current.result,
            ...patch.result,
          } as PartialAnalysisResult;
        }
        return next;
      });
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
      {
        id: "companyDeepDive" as const,
        // Runs as part of the swarm for every analysis (previously it only ran
        // when the user opted into email, so the "Company background" card spun
        // forever for everyone else). Resolves the company from the explicit
        // field or the first line of the pasted text.
        run: async (ctx: AnalysisInput) => {
          const companyName = ctx.company?.trim() || pickCompany(ctx.sourceText);
          if (!companyName || companyName === "Unknown Company") {
            throw new Error("No company name detected to research.");
          }
          return runCompanyDeepDive(companyName);
        },
      },
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

    // Run the full pipeline as background work. State is persisted to the
    // durable job store on every step, so even if this instance is frozen or
    // recycled, the last completed progress + partial result survives and the
    // client can keep polling successfully.
    const pipeline = (async () => {
      const swarmDone = runSwarmJob({
        analysisId,
        input,
        specialistAgents,
        criticAgent,
        orchestratorAgent,
        persistPatch,
      });

      // Watchdog: guarantee the job reaches a terminal state within the
      // function's time budget. If the swarm stalls (e.g. a provider hangs),
      // flip any still pending/running agents to "skipped" and finalize as
      // "partial" so the client stops spinning instead of polling a job that is
      // "running" forever. Well under a typical 300s Vercel maxDuration.
      const PIPELINE_DEADLINE_MS = Math.max(
        60_000,
        Number(process.env.PIPELINE_DEADLINE_MS) || 240_000,
      );
      const timedOut = await Promise.race([
        swarmDone.then(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(true), PIPELINE_DEADLINE_MS)),
      ]);
      if (timedOut) {
        await updateJob(analysisId, (c) => {
          if (!c) return c;
          const progress = { ...c.progress };
          for (const key of Object.keys(progress) as (keyof RunProgress)[]) {
            if (progress[key] === "pending" || progress[key] === "running") {
              progress[key] = "skipped";
            }
          }
          return {
            ...c,
            status: c.status === "complete" ? c.status : "partial",
            progress,
            error: c.error ?? "Analysis took too long; showing partial results.",
          };
        });
        return;
      }

      // After swarm, trigger email if opted in. The company deep dive already
      // ran inside the swarm, so just reuse its result for the follow-up email.
      if (!(data.email && data.emailConsent)) return;

      const current = await getJob(analysisId);
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

      // Wave 2: Follow-up email with the company deep dive that the swarm
      // already produced (if any). No second LLM/search call needed.
      if (result.companyDeepDive) {
        await sendReportEmail(data.email!, result, result.companyDeepDive, undefined);
      }
    })().catch((err) => {
      console.error("Analysis pipeline unhandled exception:", err);
    });

    await keepAlive(Promise.all([preliminaryPromise, pipeline]));

    return { analysisId };
  });

export const pollAnalysis = createServerFn({ method: "POST" })
  .inputValidator(z.object({ analysisId: z.string() }))
  .handler(async ({ data }) => {
    const cached = await getJob(data.analysisId);
    if (!cached) {
      // Distinct from "failed": the job may simply have aged out of the store
      // or not be visible yet. The client keeps its last good partial instead
      // of clobbering it, and can offer a retry.
      return {
        status: "expired" as const,
        error: "Analysis session expired or not found",
        progress: resetProgress(),
        result: null,
        preliminary: null,
        updatedAt: null,
      };
    }
    return {
      status: cached.status,
      error: cached.error,
      progress: cached.progress,
      result: cached.result ?? null,
      preliminary: cached.preliminary ?? null,
      updatedAt: cached.updatedAt ?? null,
    };
  });
