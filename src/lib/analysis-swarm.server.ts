export type AgentProgress = {
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type PartialAnalysisResult = Record<string, unknown>;

export type SwarmPatch = {
  status?: "queued" | "running" | "complete" | "partial" | "failed";
  progress?: Partial<Record<string, AgentProgress>>;
  result?: PartialAnalysisResult;
  error?: string | null;
  startedAt?: string;
  completedAt?: string;
};

export type SwarmAgent<TInput, TResult> = {
  id: string;
  run: (context: TInput) => Promise<TResult>;
};

export type SpecialistAgent<TInput> = {
  id: string;
  run: (context: TInput) => Promise<unknown>;
};

export type CriticContext<TInput> = TInput & {
  specialistResults: Partial<Record<string, unknown>>;
  specialistErrors: Partial<Record<string, string>>;
};

export type OrchestratorContext<TInput> = CriticContext<TInput> & {
  critic: unknown | null;
};

export type RunSwarmJobOptions<TInput> = {
  analysisId: string;
  input: TInput;
  specialistAgents: SpecialistAgent<TInput>[];
  criticAgent: SwarmAgent<CriticContext<TInput>, unknown>;
  orchestratorAgent: SwarmAgent<OrchestratorContext<TInput>, unknown>;
  persistPatch: (patch: SwarmPatch) => Promise<void>;
  now?: () => string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Agent failed.";
}

function isMeaningfulResult(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function isResultPatch(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    ("orchestrator" in value || "company" in value || "roleTitle" in value)
  );
}

export async function runSwarmJob<TInput>({
  analysisId: _analysisId,
  input,
  specialistAgents,
  criticAgent,
  orchestratorAgent,
  persistPatch,
  now = () => new Date().toISOString(),
}: RunSwarmJobOptions<TInput>): Promise<void> {
  const result: Record<string, unknown> = {};
  const specialistResults: Partial<Record<string, unknown>> = {};
  const specialistErrors: Partial<Record<string, string>> = {};

  await persistPatch({ status: "running", startedAt: now(), error: null });

  await Promise.all(
    specialistAgents.map(async (agent) => {
      await persistPatch({
        progress: { [agent.id]: { status: "running", startedAt: now() } },
      });

      try {
        const agentResult = await agent.run(input);
        specialistResults[agent.id] = agentResult;
        result[agent.id] = agentResult;
        await persistPatch({
          result: { ...result },
          progress: {
            [agent.id]: { status: "complete", completedAt: now() },
          },
        });
      } catch (error) {
        const message = errorMessage(error);
        specialistErrors[agent.id] = message;
        await persistPatch({
          progress: {
            [agent.id]: { status: "failed", completedAt: now(), error: message },
          },
        });
      }
    })
  );

  const completedSpecialists = Object.values(specialistResults).filter(isMeaningfulResult);
  if (completedSpecialists.length === 0) {
    await persistPatch({
      status: "failed",
      error: "All specialist agents failed.",
      completedAt: now(),
    });
    return;
  }

  let critic: unknown | null = null;
  await persistPatch({
    progress: { critic: { status: "running", startedAt: now() } },
  });
  try {
    critic = await criticAgent.run({
      ...input,
      specialistResults,
      specialistErrors,
    });
    result.critic = critic;
    await persistPatch({
      result: { ...result },
      progress: { critic: { status: "complete", completedAt: now() } },
    });
  } catch (error) {
    await persistPatch({
      progress: {
        critic: {
          status: "failed",
          completedAt: now(),
          error: errorMessage(error),
        },
      },
    });
  }

  await persistPatch({
    progress: { orchestrator: { status: "running", startedAt: now() } },
  });
  try {
    const orchestrator = await orchestratorAgent.run({
      ...input,
      specialistResults,
      specialistErrors,
      critic,
    });
    if (isResultPatch(orchestrator)) {
      Object.assign(result, orchestrator);
    } else {
      result.orchestrator = orchestrator;
    }
    const hasFailures =
      Object.keys(specialistErrors).length > 0 ||
      critic === null ||
      completedSpecialists.length < specialistAgents.length;
    await persistPatch({
      status: hasFailures ? "partial" : "complete",
      result: { ...result },
      progress: {
        orchestrator: { status: "complete", completedAt: now() },
      },
      completedAt: now(),
    });
  } catch (error) {
    await persistPatch({
      status: "partial",
      error: errorMessage(error),
      progress: {
        orchestrator: {
          status: "failed",
          completedAt: now(),
          error: errorMessage(error),
        },
      },
      completedAt: now(),
    });
  }
}
