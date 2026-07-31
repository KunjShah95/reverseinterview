// Barrel entry point for the analysis agents. Each agent now lives in its own
// file under ./agents/ for easier maintenance. Import from here as before.
export type { AnalysisInput } from "./agents/shared";

export { runCultureAgent } from "./agents/culture";
export { runBurnoutAgent } from "./agents/burnout";
export { runSalaryAgent } from "./agents/salary";
export { runGhostAgent } from "./agents/ghost";
export { runNegotiationAgent } from "./agents/negotiation";
export { runReverseAgent } from "./agents/reverse";
export { runLieAgent } from "./agents/lie";
export { runLegalAgent } from "./agents/legal";
export { runSimulationAgent } from "./agents/simulation";
export { runManagerRadarAgent } from "./agents/manager-radar";
export { runPowerDynamicsAgent } from "./agents/power-dynamics";
export { runTeamChemistryAgent } from "./agents/team-chemistry";
export { runCriticAgent } from "./agents/critic";
export { runOrchestratorAgent } from "./agents/orchestrator";
