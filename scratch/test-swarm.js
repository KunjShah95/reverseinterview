import fs from "node:fs";
import path from "node:path";

try {
  const envContent = fs.readFileSync(path.resolve(".env"), "utf8");
  envContent.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      if (key && !key.startsWith("#")) {
        process.env[key] = val;
      }
    }
  });
} catch (e) {
  console.log("Failed to parse .env:", e.message);
}

console.log("DEBUG ENV VARS:");
console.log("  DEFAULT_AI_PROVIDER:", process.env.DEFAULT_AI_PROVIDER);
console.log("  DEFAULT_AI_MODEL:", process.env.DEFAULT_AI_MODEL);
console.log("  OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? `${process.env.OPENROUTER_API_KEY.slice(0, 10)}...` : "undefined");
console.log("  OPENROUTER_BASE_URL:", process.env.OPENROUTER_BASE_URL);

// Override model to a valid OpenRouter model for testing
process.env.DEFAULT_AI_MODEL = "openrouter/free";

// Now dynamically import everything else after env variables are set:
const {
  runCultureAgent,
  runBurnoutAgent,
  runSalaryAgent,
  runGhostAgent,
  runNegotiationAgent,
  runReverseAgent,
  runLieAgent,
  runSimulationAgent,
  runLegalAgent,
  runCriticAgent,
  runOrchestratorAgent,
} = await import("../src/lib/agents.server.ts");

const { runSwarmJob } = await import("../src/lib/analysis-swarm.server.ts");

const input = {
  sourceText: "We are looking for a rockstar Software Engineer. Urgent hire! $100k base. Remote. Unlimited PTO.",
  company: "Acme Corp",
  roleTitle: "Software Engineer",
};

const specialistAgents = [
  { id: "culture", run: runCultureAgent },
  { id: "burnout", run: runBurnoutAgent },
  { id: "salary", run: runSalaryAgent },
  { id: "ghost", run: runGhostAgent },
  { id: "negotiation", run: runNegotiationAgent },
  { id: "reverse", run: runReverseAgent },
  { id: "lie", run: runLieAgent },
  { id: "simulation", run: runSimulationAgent },
  { id: "legal", run: runLegalAgent },
];

const criticAgent = {
  id: "critic",
  run: async (ctx) => {
    return runCriticAgent(ctx, ctx.specialistResults, ctx.specialistErrors);
  },
};

const orchestratorAgent = {
  id: "orchestrator",
  run: async (ctx) => {
    return runOrchestratorAgent(
      ctx,
      ctx.specialistResults,
      ctx.specialistErrors,
      ctx.critic
    );
  },
};

const persistPatch = async (patch) => {
  console.log("PERSIST PATCH STATUS:", patch.status, "ERROR:", patch.error);
  if (patch.progress) {
    for (const key of Object.keys(patch.progress)) {
      console.log(`  - Agent ${key}:`, patch.progress[key].status, patch.progress[key].error || "");
    }
  }
};

try {
  console.log("Starting swarm job...");
  await runSwarmJob({
    analysisId: "test-analysis-1",
    input,
    specialistAgents,
    criticAgent,
    orchestratorAgent,
    persistPatch,
  });
  console.log("Swarm job completed.");
} catch (err) {
  console.error("Swarm job failed:", err);
}
process.exit(0);
