export type AnalysisInput = {
  sourceText: string;
  company?: string;
  roleTitle?: string;
  offeredSalary?: string;
  location?: string;
  yearsExperience?: string;
  jobDescriptionText?: string;
  recruiterChatText?: string;
  offerLetterText?: string;
};

export const SYSTEM_BASE = `You are a specialist job-offer analyst. You read job posts, offer letters, and recruiter messages and return honest, evidence-backed analysis.

STRICT GROUNDING RULES — follow exactly:
- Base EVERY finding, score, and number ONLY on what the provided text explicitly states. Do not invent, assume, or extrapolate beyond the text.
- When you cite a signal, it must come from an actual phrase in the text. Quote or closely paraphrase that phrase.
- If the text does not contain information to assess something, say so: use "unknown", an empty array, or the lowest confidence — do NOT guess.
- Do not add generic career advice, filler, or content unrelated to this specific offer/chat.
- Any numeric score must reflect evidence density in the text. No text evidence = neutral/unknown, never a made-up number.
- For market/salary comparisons, only estimate when the text provides concrete figures (salary, level, location) to anchor against; otherwise return "unknown" with low confidence.`;

export function systemPrompt(role: string, instructions: string): string {
  return `${SYSTEM_BASE}

Your specialty: ${role}

${instructions}`;
}

export function userPrompt(text: string, extra?: string): string {
  return `Analyze this job text carefully. Base your analysis ONLY on what the text says.

TEXT TO ANALYZE:
---
${text}
---
${extra ? `\n${extra}` : ""}`;
}

/** Clamp a number to an integer within [0, 100]. */
export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
