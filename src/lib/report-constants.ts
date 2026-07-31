import type { AgentId, AnalysisStatus } from "./analysis-types";

export const AGENT_LABELS: { id: AgentId; label: string }[] = [
  { id: "culture", label: "Culture" },
  { id: "burnout", label: "Burnout" },
  { id: "salary", label: "Salary" },
  { id: "ghost", label: "Ghost hiring" },
  { id: "negotiation", label: "Negotiation" },
  { id: "reverse", label: "Reverse interview" },
  { id: "lie", label: "Claim verifier" },
  { id: "simulation", label: "Career simulation" },
  { id: "legal", label: "Legal trap scan" },
  { id: "critic", label: "Critic" },
  { id: "orchestrator", label: "Final verdict" },
  { id: "managerRadar", label: "Manager radar" },
  { id: "powerDynamics", label: "Power dynamics" },
  { id: "teamChemistry", label: "Team chemistry" },
  { id: "companyDeepDive", label: "Company background" },
];

export const ACTIVE_STATUSES: AnalysisStatus[] = ["queued", "running"];
