import { callText } from "./ai-gateway.server";
import type { PreliminaryResponse } from "./analysis-types";

const SYSTEM_PROMPT = `You are a fast, first-pass job text scanner. Read the text and return:
- vibeScore (0-100): overall gut feel, how positive vs concerning the text feels
- topRedFlags (max 3): most urgent signals you spot immediately
- topGreenFlags (max 3): most positive signals you spot immediately

Be honest. A score of 50 means neutral/mixed. Speed matters — use instinct, not deep analysis.`;

const USER_PROMPT_PREFIX = `Quick-scan this job text and return JSON with vibeScore, topRedFlags (max 3), topGreenFlags (max 3):

TEXT:
---
`;

function keywordHeuristic(text: string): PreliminaryResponse {
  const lower = text.toLowerCase();
  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  const redPatterns = [
    { keyword: "urgent", flag: "Urgency pressure — 'urgent' hire signals potential exploitation" },
    { keyword: "rockstar", flag: "Loaded language — 'rockstar' often means overwork" },
    { keyword: "family", flag: "Loaded language — 'family' culture can mean guilt-based boundaries" },
    { keyword: "hustle", flag: "Hustle culture signal — expects grind mentality" },
    { keyword: "wear many hats", flag: "Scope creep — unclear role boundaries" },
    { keyword: "fast-paced", flag: "Fast-paced is often code for understaffed" },
    { keyword: "unlimited pto", flag: "Unlimited PTO without minimum — often means zero PTO taken" },
  ];

  const greenPatterns = [
    { keyword: "salary range", flag: "Salary transparency — clear compensation expectations" },
    { keyword: "salary", flag: "Salary disclosed — pay is transparent" },
    { keyword: "mentorship", flag: "Mentorship offered — invests in employee growth" },
    { keyword: "work-life balance", flag: "Work-life balance explicitly valued" },
    { keyword: "learning", flag: "Learning opportunities promoted" },
    { keyword: "flexible", flag: "Flexibility offered" },
    { keyword: "remote", flag: "Remote work supported" },
  ];

  for (const pattern of redPatterns) {
    if (lower.includes(pattern.keyword)) {
      redFlags.push(pattern.flag);
      if (redFlags.length >= 3) break;
    }
  }

  for (const pattern of greenPatterns) {
    if (lower.includes(pattern.keyword)) {
      greenFlags.push(pattern.flag);
      if (greenFlags.length >= 3) break;
    }
  }

  const redScore = Math.min(redFlags.length * 25, 70);
  const greenScore = Math.min(greenFlags.length * 20, 60);
  const vibeScore = Math.max(10, Math.min(90, 50 - redScore + greenScore));

  return {
    vibeScore,
    topRedFlags: redFlags,
    topGreenFlags: greenFlags,
  };
}

export async function runPreliminaryAnalysis(sourceText: string): Promise<PreliminaryResponse> {
  try {
    const result = await callText({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT_PREFIX + sourceText + "\n---" },
      ],
    });

    const parsed = JSON.parse(result);
    return {
      vibeScore: Math.max(0, Math.min(100, parsed.vibeScore ?? 50)),
      topRedFlags: (parsed.topRedFlags ?? []).slice(0, 3),
      topGreenFlags: (parsed.topGreenFlags ?? []).slice(0, 3),
    };
  } catch {
    return keywordHeuristic(sourceText);
  }
}
