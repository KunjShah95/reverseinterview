import type {
  AnalysisProgress,
  AnalysisStatus,
  PartialAnalysisResult,
  ToxicityFlag,
} from "./analysis-types";

const LOCAL_ANALYSES_KEY = "rev-int-local-analyses";

export type LocalAnalysisRecord = {
  id: string;
  sessionId: string;
  company: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: AnalysisStatus;
  error: string | null;
  progress: AnalysisProgress;
  result: PartialAnalysisResult;
};

export type LocalAnalysisInput = {
  sourceText: string;
  company?: string;
  roleTitle?: string;
  offeredSalary?: string;
  location?: string;
  yearsExperience?: string;
  sessionId?: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAnalyses(): LocalAnalysisRecord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ANALYSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalAnalysisRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAnalyses(records: LocalAnalysisRecord[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(records.slice(0, 50)));
}

function scoreForKeywords(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.reduce((count, keyword) => count + (normalized.includes(keyword) ? 1 : 0), 0);
}

function pickCompany(input: LocalAnalysisInput) {
  if (input.company?.trim()) return input.company.trim();
  const firstLine = input.sourceText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine && firstLine.length <= 80) return firstLine.replace(/[:\-–—].*$/, "");
  return "Sample Startup Inc.";
}

function pickRole(input: LocalAnalysisInput) {
  if (input.roleTitle?.trim()) return input.roleTitle.trim();
  const text = input.sourceText.toLowerCase();
  if (text.includes("engineer")) return "Engineer";
  if (text.includes("designer")) return "Designer";
  if (text.includes("manager")) return "Manager";
  return "Unknown role";
}

function buildProgress(): AnalysisProgress {
  const now = new Date().toISOString();
  return {
    culture: { status: "complete", startedAt: now, completedAt: now },
    burnout: { status: "complete", startedAt: now, completedAt: now },
    salary: { status: "complete", startedAt: now, completedAt: now },
    ghost: { status: "complete", startedAt: now, completedAt: now },
    negotiation: { status: "complete", startedAt: now, completedAt: now },
    reverse: { status: "complete", startedAt: now, completedAt: now },
    lie: { status: "complete", startedAt: now, completedAt: now },
    simulation: { status: "complete", startedAt: now, completedAt: now },
    critic: { status: "complete", startedAt: now, completedAt: now },
    orchestrator: { status: "complete", startedAt: now, completedAt: now },
  };
}

function clamp(score: number) {
  return Math.max(0, Math.min(100, score));
}

function makeQuestions(company: string, role: string) {
  return [
    {
      q: `How does ${company} measure success for this ${role} role in the first 90 days?`,
      why: "Turns vague expectations into concrete success criteria.",
      category: "Growth" as const,
    },
    {
      q: "What percentage of deadlines slipped last quarter, and what changed after that?",
      why: "Checks whether urgency is a pattern or a one-off.",
      category: "Workload" as const,
    },
    {
      q: "How often do people actually use their PTO here?",
      why: "Probes the real work-life balance behind the pitch.",
      category: "Culture" as const,
    },
    {
      q: "What has changed in compensation bands for this level over the last 12 months?",
      why: "Surfaces whether the offer is aligned with the market.",
      category: "Compensation" as const,
    },
    {
      q: "What would make you say this hire was the wrong fit after 6 months?",
      why: "Reveals hidden risks and unstated expectations.",
      category: "Stability" as const,
    },
  ];
}

export function createLocalAnalysis(input: LocalAnalysisInput): LocalAnalysisRecord {
  const source = input.sourceText.toLowerCase();
  const company = pickCompany(input);
  const roleTitle = pickRole(input);
  const now = new Date().toISOString();

  const toxicityTriggers = [
    "rockstar",
    "family",
    "fast-paced",
    "wear many hats",
    "self-starter",
    "urgent",
  ];
  const burnoutTriggers = [
    "on-call",
    "2am",
    "always",
    "immediately",
    "ship fast",
    "weekend",
    "pressure",
  ];
  const ghostTriggers = ["urgent", "apply asap", "immediately", "tbd", "vague", "repost"];
  const salaryMentioned = /\$\s?\d|salary|compensation|equity|base/i.test(input.sourceText);

  const toxicityHits = scoreForKeywords(source, toxicityTriggers);
  const burnoutHits = scoreForKeywords(source, burnoutTriggers);
  const ghostHits = scoreForKeywords(source, ghostTriggers);

  const cultureScore = clamp(18 + toxicityHits * 16 + burnoutHits * 4);
  const burnoutScore = clamp(22 + burnoutHits * 18 + toxicityHits * 6);
  const ghostScore = clamp(15 + ghostHits * 18);

  const salaryVerdict: "underpaid" | "fair" | "overpaid" | "unknown" = salaryMentioned
    ? burnoutScore >= 60 || toxicityHits >= 2
      ? "underpaid"
      : "fair"
    : "unknown";

  const recommendation: "proceed" | "caution" | "avoid" =
    cultureScore >= 70 || burnoutScore >= 70 || ghostScore >= 65
      ? "avoid"
      : cultureScore >= 45 || burnoutScore >= 45 || ghostScore >= 45
        ? "caution"
        : "proceed";

  const flags: ToxicityFlag[] = toxicityHits
    ? [
        {
          phrase: toxicityTriggers
            .filter((trigger) => source.includes(trigger))
            .slice(0, 3)
            .join(" · "),
          hiddenMeaning:
            "Possible interpretation: the job may expect broad ownership and constant availability.",
          severity: toxicityHits >= 2 ? "high" : "medium",
        },
      ]
    : [];

  const topRisks = [
    burnoutScore >= 50
      ? "Signals suggest a higher-than-average workload and urgency."
      : "No major workload red flags detected.",
    ghostScore >= 45
      ? "Some phrasing reads like a role that may be rushed or underdefined."
      : "The hiring story is relatively coherent.",
    salaryVerdict === "underpaid"
      ? "Compensation may lag the scope implied by the description."
      : salaryVerdict === "fair"
        ? "Compensation looks reasonable at a glance, but verify details."
        : "Compensation is too unclear to judge confidently.",
  ];

  const topGreens = [
    "The role is at least specific enough to infer ownership areas.",
    "You can ask sharper questions before you commit.",
    recommendation === "proceed"
      ? "Nothing here screams immediate danger."
      : "There is enough signal to negotiate or clarify aggressively.",
  ];

  const result: PartialAnalysisResult = {
    company,
    roleTitle,
    culture: {
      toxicityScore: cultureScore,
      summary:
        toxicityHits > 0
          ? "A few classic startup buzzwords suggest possible overwork or fuzzy expectations."
          : "No strong culture red flags detected in the text.",
      flags,
    },
    burnout: {
      burnoutRisk: burnoutScore,
      overtimeProbability: clamp(burnoutScore + 8),
      signals: [
        burnoutHits > 0
          ? "Urgency language shows up more than once."
          : "No strong overtime language found.",
        burnoutScore >= 60
          ? "The role may expect frequent context switching or after-hours work."
          : "Workload signals are moderate.",
      ],
      summary:
        burnoutScore >= 60
          ? "The text suggests a fairly elevated risk of churn and stress."
          : "Workload risk looks manageable, though still worth verifying.",
    },
    salary: {
      verdict: salaryVerdict,
      marketRangeEstimate: salaryMentioned
        ? "Likely near market, but confirm level and location."
        : "No clear salary range found.",
      confidence: salaryMentioned ? "medium" : "low",
      reasoning:
        salaryVerdict === "underpaid"
          ? "The combination of urgency and scope hints that the offer may not fully price in the workload."
          : salaryVerdict === "fair"
            ? "There is enough information to treat the offer as potentially reasonable, pending details."
            : "The text does not contain enough compensation detail for a serious estimate.",
    },
    ghost: {
      ghostScore,
      signals: [
        ghostHits > 0 ? "Urgent language appears repeatedly." : "No obvious ghost-hiring markers.",
        "Scope, if present, is not fully constrained by the text.",
      ],
      summary:
        ghostScore >= 45
          ? "Some of the wording could fit a rushed or opportunistic hiring process."
          : "The role description feels reasonably stable from the wording alone.",
    },
    negotiation: {
      talkingPoints: [
        `Ask how ${company} defines success for this ${roleTitle} role in the first 90 days.`,
        "Clarify actual expectations around hours, on-call, and response times.",
        "Request the salary band and the exact level the offer maps to.",
      ],
      counterOfferTemplate: `Thanks again — I’m excited about the opportunity at ${company}. Based on the scope and expectations we discussed, I’d like to revisit the compensation and confirm the role level before moving forward. If we can align on those points, I’d be happy to continue.`,
      redLines: [
        "Undefined scope with no clear success criteria.",
        "Frequent after-hours work without compensation or comp time.",
      ],
    },
    reverse: {
      questions: makeQuestions(company, roleTitle),
    },
    lie: {
      mismatches:
        source.includes("work-life balance") && source.includes("on-call")
          ? [
              {
                claim: "Work-life balance",
                evidence: "The same text also mentions on-call and urgent turnaround expectations.",
                confidence: "high",
              },
            ]
          : [],
      summary:
        source.includes("work-life balance") && source.includes("on-call")
          ? "The text contains at least one internal tension worth asking about."
          : "No strong self-contradictions are obvious from the text alone.",
    },
    simulation: {
      phases: [
        {
          label: "6 months in",
          narrative:
            recommendation === "avoid"
              ? "You are likely clarifying expectations, cleaning up ambiguity, and feeling the workload pressure early."
              : "You are learning the real operating rhythm and setting boundaries as you go.",
          stress: clamp(burnoutScore + 5),
          growth: clamp(72 - burnoutScore / 2),
          learning: clamp(78 - ghostScore / 3),
        },
        {
          label: "1 year in",
          narrative:
            recommendation === "avoid"
              ? "If nothing changes, the role may feel heavier than advertised."
              : "You likely have a decent map of what matters, but you still need to defend your time.",
          stress: clamp(burnoutScore + 2),
          growth: clamp(68 - burnoutScore / 3),
          learning: clamp(74 - ghostScore / 4),
        },
        {
          label: "2 years in",
          narrative:
            recommendation === "proceed"
              ? "This could become a useful career step if the team remains stable and you keep leverage on scope."
              : "By this point, your experience will depend heavily on whether the company improved its process.",
          stress: clamp(burnoutScore - 4),
          growth: clamp(60 - burnoutScore / 4),
          learning: clamp(66 - ghostScore / 5),
        },
      ],
      promotionProbability: clamp(55 - burnoutScore / 2 + (salaryVerdict === "fair" ? 8 : 0)),
      retentionProbability: clamp(70 - burnoutScore / 2 - ghostScore / 4),
    },
    critic: {
      unsupportedClaims: [],
      contradictions: [],
      confidenceWarnings:
        recommendation === "avoid"
          ? ["This is a heuristic fallback, so treat it as directional rather than factual."]
          : [
              "This local fallback is useful for testing, but still not a replacement for the live model.",
            ],
      summary: "Local fallback analysis generated without Supabase or AI provider credentials.",
    },
    orchestrator: {
      recommendation,
      verdict:
        recommendation === "avoid"
          ? "This looks risky enough that I would not sign without clarification and leverage."
          : recommendation === "caution"
            ? "This deserves a careful follow-up before you commit."
            : "This looks workable, but you should still verify the details.",
      truthScore: {
        transparency: clamp(82 - ghostScore / 2),
        workLifeBalance: clamp(76 - burnoutScore / 2),
        careerGrowth: clamp(70 - burnoutScore / 4),
        hiringIntegrity: clamp(80 - ghostScore / 2),
        compensationFairness: clamp(
          salaryVerdict === "underpaid" ? 38 : salaryVerdict === "fair" ? 68 : 50,
        ),
      },
      topRisks,
      topGreens,
    },
  };
  function makeId() {
    try {
      // prefer Web Crypto / Node crypto if available
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `local-${crypto.randomUUID()}`;
      }
    } catch (_) {
      // fall through to Math-based fallback
    }
    // fallback UUID v4-ish generator (not cryptographically strong but fine for local ids)
    const rnd = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `local-${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
  }

  return {
    id: makeId(),
    sessionId: input.sessionId ?? "local",
    company,
    createdAt: now,
    startedAt: now,
    completedAt: now,
    status: "complete",
    error: null,
    progress: buildProgress(),
    result,
  };
}

export function saveLocalAnalysis(record: LocalAnalysisRecord, uid?: string) {
  // Always save to localStorage
  const records = readAnalyses();
  const next = [record, ...records.filter((existing) => existing.id !== record.id)];
  writeAnalyses(next);

  // Also persist to Firestore when user is authenticated (non-blocking)
  if (uid) {
    import("./firestore")
      .then(({ saveReportToFirestore }) => {
        saveReportToFirestore(uid, record).catch((err) => {
          console.error("Failed to save report to Firestore:", err);
        });
      })
      .catch((err) => {
        console.error("Failed to load firestore module:", err);
      });
  }
}

export function getLocalAnalysis(id: string) {
  return readAnalyses().find((record) => record.id === id) ?? null;
}

export function listLocalAnalyses(sessionId: string) {
  return readAnalyses()
    .filter((record) => record.sessionId === sessionId)
    .map((record) => ({
      id: record.id,
      company: record.company ?? "Unknown",
      createdAt: record.createdAt,
      status: record.status,
      recommendation: record.result.orchestrator?.recommendation ?? null,
    }));
}

export function listLocalAnalysisRecords(sessionId: string) {
  return readAnalyses().filter((record) => record.sessionId === sessionId);
}

// Returns every locally-saved analysis, regardless of which session it was
// tagged with. We use this on the history/dashboard pages so users still see
// analyses they ran before logging in (those were saved under the anonymous
// device UUID, which differs from the firebase UID once they sign in).
export function listAllLocalAnalysisRecords() {
  return readAnalyses();
}

export function getLocalDashboardStats(sessionId: string) {
  const records = readAnalyses().filter((record) => record.sessionId === sessionId);
  return computeStats(records);
}

// Session-agnostic version of the above. Counts every analysis in localStorage.
export function getAllLocalDashboardStats() {
  return computeStats(readAnalyses());
}

function computeStats(records: LocalAnalysisRecord[]) {
  let proceed = 0;
  let caution = 0;
  let avoid = 0;
  let running = 0;

  for (const record of records) {
    if (record.status === "queued" || record.status === "running") {
      running++;
      continue;
    }

    const recommendation = record.result.orchestrator?.recommendation;
    if (recommendation === "proceed") proceed++;
    else if (recommendation === "avoid") avoid++;
    else if (recommendation === "caution") caution++;
  }

  return {
    total: records.length,
    proceed,
    caution,
    avoid,
    running,
  };
}

// Re-tag every locally-saved analysis that was written under a different
// session (e.g. an anonymous device UUID) so it shows up under the active
// session ID going forward. Pass `previousSessionId = "any"` to re-tag
// every record that isn't already tagged with `nextSessionId`.
// Returns the number of records that were re-tagged.
export function reTagLocalAnalyses(previousSessionId: string, nextSessionId: string) {
  if (!nextSessionId) return 0;
  const records = readAnalyses();
  let changed = 0;
  const next = records.map((record) => {
    const matches = previousSessionId === "any"
      ? record.sessionId !== nextSessionId
      : record.sessionId === previousSessionId;
    if (matches) {
      changed++;
      return { ...record, sessionId: nextSessionId };
    }
    return record;
  });
  if (changed > 0) writeAnalyses(next);
  return changed;
}
