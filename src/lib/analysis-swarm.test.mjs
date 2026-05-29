import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInitialProgress,
  runSwarmJob,
} from "./analysis-swarm.server.ts";

test("creates pending progress for every swarm agent", () => {
  const progress = createInitialProgress();

  assert.equal(progress.culture.status, "pending");
  assert.equal(progress.burnout.status, "pending");
  assert.equal(progress.critic.status, "pending");
  assert.equal(progress.orchestrator.status, "pending");
});

test("persists specialist results before critic and orchestrator complete", async () => {
  const patches = [];
  let tick = 0;

  await runSwarmJob({
    analysisId: "analysis-1",
    input: { sourceText: "A useful job description with enough content to test." },
    specialistAgents: [
      {
        id: "culture",
        run: async () => ({ summary: "culture done" }),
      },
      {
        id: "burnout",
        run: async () => ({ summary: "burnout done" }),
      },
    ],
    criticAgent: {
      id: "critic",
      run: async ({ specialistResults }) => ({
        notes: [`reviewed ${Object.keys(specialistResults).length}`],
      }),
    },
    orchestratorAgent: {
      id: "orchestrator",
      run: async ({ specialistResults, critic }) => ({
        verdict: `${Object.keys(specialistResults).join(",")} ${critic.notes[0]}`,
      }),
    },
    persistPatch: async (patch) => {
      patches.push(patch);
    },
    now: () => `2026-05-28T00:00:${String(tick++).padStart(2, "0")}.000Z`,
  });

  const cultureComplete = patches.find(
    (patch) => patch.progress?.culture?.status === "complete"
  );
  const burnoutComplete = patches.find(
    (patch) => patch.progress?.burnout?.status === "complete"
  );
  const criticStartIndex = patches.findIndex(
    (patch) => patch.progress?.critic?.status === "running"
  );
  const cultureIndex = patches.indexOf(cultureComplete);
  const burnoutIndex = patches.indexOf(burnoutComplete);
  const finalPatch = patches.at(-1);

  assert.ok(cultureComplete);
  assert.ok(burnoutComplete);
  assert.ok(cultureIndex > -1 && cultureIndex < criticStartIndex);
  assert.ok(burnoutIndex > -1 && burnoutIndex < criticStartIndex);
  assert.equal(finalPatch.status, "complete");
  assert.equal(finalPatch.result.orchestrator.verdict, "culture,burnout reviewed 2");
});

