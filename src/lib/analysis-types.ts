// Shared types between server and client for the analysis result.
// Keep this file client-safe (no server imports).

export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type AnalysisStatus = "queued" | "running" | "complete" | "partial" | "failed";
export type AgentStatus = "pending" | "running" | "complete" | "failed" | "skipped";
export type AgentId =
  | "culture"
  | "burnout"
  | "salary"
  | "ghost"
  | "negotiation"
  | "reverse"
  | "lie"
  | "simulation"
  | "critic"
  | "orchestrator"
  | "legal"
  | "managerRadar"
  | "powerDynamics"
  | "teamChemistry"
  | "companyDeepDive";

export type AgentProgress = {
  status: AgentStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type AnalysisProgress = Record<AgentId, AgentProgress>;

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

export type EquityDetails = {
  optionsGranted?: number;
  strikePrice?: number;
  estimatedPercentage?: number; // e.g. 0.05 for 0.05%
  vestingSchedule?: string;
};

export type SalaryAgent = {
  verdict: "underpaid" | "fair" | "overpaid" | "unknown";
  marketRangeEstimate: string;
  confidence: Confidence;
  reasoning: string;
  equityDetails?: EquityDetails;
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

export type Discrepancy = {
  category: "Location" | "Compensation" | "Scope" | "Benefits" | "Other";
  jdClaim?: string;
  chatClaim?: string;
  contractClaim?: string;
  severity: Severity;
  assessment: string;
};

export type LieAgent = {
  mismatches: Mismatch[];
  discrepancies?: Discrepancy[];
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

export type LegalClauseFlag = {
  clauseType: "IP Assignment" | "Clawback" | "Non-Compete" | "Termination" | "Equity Vesting" | "Other";
  extractedText: string;
  riskRating: Severity;
  explanation: string;
  mitigationStrategy: string;
};

export type LegalAgent = {
  clauses: LegalClauseFlag[];
  summary: string;
};

export type PreliminaryResponse = {
  vibeScore: number;
  topRedFlags: string[];
  topGreenFlags: string[];
};

export type ManagerStyle = "micromanager" | "hands-off" | "delegator" | "coach" | "unknown";

export type ManagerRadarSignal = {
  phrase: string;
  implication: string;
  severity: Severity;
};

export type ManagerRadarAgent = {
  inferredStyle: ManagerStyle;
  confidence: Confidence;
  signals: ManagerRadarSignal[];
  autonomyScore: number;
  communicationClarity: number;
  redFlags: string[];
  summary: string;
};

export type ManipulationSignal = {
  technique: string;
  excerpt: string;
  explanation: string;
  severity: Severity;
};

export type PowerDynamicsAgent = {
  powerScore: number;
  manipulationSignals: ManipulationSignal[];
  respectMarkers: string[];
  gaslightingIndex: number;
  summary: string;
};

export type TeamArchetype = "startup-grind" | "corporate-ladder" | "flat-collaborative" | "siloed" | "cross-functional-pod" | "unknown";

export type TeamChemistrySignal = {
  phrase: string;
  implication: string;
};

export type TeamChemistryAgent = {
  teamArchetype: TeamArchetype;
  meetingCulture: "heavy" | "moderate" | "light" | "unknown";
  crossFunctionality: number;
  supportStructure: number;
  teamHealthScore: number;
  signals: TeamChemistrySignal[];
  summary: string;
};

export type CompanyDeepDive = {
  companyName: string;
  industry: string;
  stage: "startup" | "growth" | "public" | "nonprofit" | "unknown";
  fundingStatus: string;
  layoffHistory: string[];
  leadershipChanges: string[];
  glassdoorSummary: string;
  mediaHighlights: string[];
  deAuthenticity: { score: number; signals: string[] };
  growthTrajectory: "growing" | "stable" | "declining" | "unknown";
  sources: string[];
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

export type CriticAgent = {
  unsupportedClaims: string[];
  contradictions: string[];
  confidenceWarnings: string[];
  summary: string;
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
  critic?: CriticAgent;
  orchestrator: Orchestrator;
  legal?: LegalAgent;
  managerRadar?: ManagerRadarAgent;
  powerDynamics?: PowerDynamicsAgent;
  teamChemistry?: TeamChemistryAgent;
  companyDeepDive?: CompanyDeepDive;
};

export type PartialAnalysisResult = Partial<
  Omit<AnalysisResult, "orchestrator">
> & {
  preliminary?: PreliminaryResponse;
  company?: string;
  roleTitle?: string;
  orchestrator?: Orchestrator;
};
