// Shared types between server and client for the analysis result.
// Keep this file client-safe (no server imports).

export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";

export type ToxicityFlag = {
  phrase: string;
  hiddenMeaning: string;
  severity: Severity;
};

export type CultureAgent = {
  toxicityScore: number; // 0-100
  flags: ToxicityFlag[];
  summary: string;
};

export type BurnoutAgent = {
  burnoutRisk: number; // 0-100
  overtimeProbability: number; // 0-100
  signals: string[];
  summary: string;
};

export type SalaryAgent = {
  verdict: "underpaid" | "fair" | "overpaid" | "unknown";
  marketRangeEstimate: string;
  confidence: Confidence;
  reasoning: string;
};

export type GhostAgent = {
  ghostScore: number; // 0-100
  signals: string[];
  summary: string;
};

export type NegotiationAgent = {
  talkingPoints: string[];
  counterOfferTemplate: string;
  redLines: string[];
};

export type ReverseQuestion = {
  q: string;
  why: string;
  category: "Workload" | "Culture" | "Compensation" | "Growth" | "Stability";
};

export type ReverseAgent = {
  questions: ReverseQuestion[];
};

export type Mismatch = {
  claim: string;
  evidence: string;
  confidence: Confidence;
};

export type LieAgent = {
  mismatches: Mismatch[];
  summary: string;
};

export type Phase = {
  label: "6 months in" | "1 year in" | "2 years in";
  narrative: string;
  stress: number; // 0-100
  growth: number; // 0-100
  learning: number; // 0-100
};

export type SimulationAgent = {
  phases: Phase[];
  promotionProbability: number; // 0-100
  retentionProbability: number; // 0-100
};

export type TruthScore = {
  transparency: number;
  workLifeBalance: number;
  careerGrowth: number;
  hiringIntegrity: number;
  compensationFairness: number;
};

export type Orchestrator = {
  recommendation: "proceed" | "caution" | "avoid";
  verdict: string; // single sentence
  truthScore: TruthScore;
  topRisks: string[];
  topGreens: string[];
};

export type AnalysisResult = {
  company: string;
  roleTitle: string;
  culture: CultureAgent;
  burnout: BurnoutAgent;
  salary: SalaryAgent;
  ghost: GhostAgent;
  negotiation: NegotiationAgent;
  reverse: ReverseAgent;
  lie: LieAgent;
  simulation: SimulationAgent;
  orchestrator: Orchestrator;
};
