import type { CompanyDeepDive } from "./analysis-types";
import { callStructured } from "./ai-gateway.server";

type SearchResult = { title: string; url: string; snippet: string };

async function searchWeb(query: string): Promise<SearchResult[]> {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const EXA_API_KEY = process.env.EXA_API_KEY;

  const results: SearchResult[] = [];

  if (TAVILY_API_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_API_KEY}` },
        body: JSON.stringify({ query, max_results: 3, search_depth: "advanced" }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of (data.results ?? []) as Array<{ title: string; url: string; content: string }>) {
          results.push({ title: r.title, url: r.url, snippet: r.content.slice(0, 500) });
        }
      }
    } catch { /* fall through */ }
  }

  if (EXA_API_KEY && results.length < 3) {
    try {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${EXA_API_KEY}` },
        body: JSON.stringify({ query, numResults: 3, contents: { text: true } }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of (data.results ?? []) as Array<{ title: string; url: string; text: string }>) {
          if (!results.some((x) => x.url === r.url)) {
            results.push({ title: r.title, url: r.url, snippet: (r.text ?? "").slice(0, 500) });
          }
        }
      }
    } catch { /* fall through */ }
  }

  return results;
}

function buildCompanySearches(companyName: string): string[] {
  return [
    `${companyName} layoffs`,
    `${companyName} funding`,
    `${companyName} Glassdoor reviews`,
    `${companyName} CEO leadership changes`,
    `${companyName} culture DEI`,
  ];
}

export async function runCompanyDeepDive(companyName: string): Promise<CompanyDeepDive> {
  const queries = buildCompanySearches(companyName);
  const allResults = await Promise.all(queries.map(searchWeb));
  const combinedSnippets = allResults
    .flat()
    .map((r) => `[${r.title}](${r.url}): ${r.snippet}`)
    .join("\n\n");

  const result = await callStructured<{
    industry: string;
    stage: string;
    fundingStatus: string;
    layoffHistory: string[];
    leadershipChanges: string[];
    glassdoorSummary: string;
    mediaHighlights: string[];
    deAuthenticity: { score: number; signals: string[] };
    growthTrajectory: string;
  }>({
    toolName: "companyDeepDive",
    toolDescription: `Research "${companyName}" and produce a structured company intelligence report based on web search results.`,
    parameters: {
      type: "object",
      properties: {
        industry: { type: "string", description: "Company's industry" },
        stage: { type: "string", enum: ["startup", "growth", "public", "nonprofit", "unknown"] },
        fundingStatus: { type: "string", description: "E.g. 'Series B, $50M' or 'Public (NYSE: X)'" },
        layoffHistory: { type: "array", items: { type: "string" }, description: "Recent layoffs found. Max 3." },
        leadershipChanges: { type: "array", items: { type: "string" }, description: "Recent executive changes. Max 3." },
        glassdoorSummary: { type: "string", description: "Aggregated employee sentiment summary" },
        mediaHighlights: { type: "array", items: { type: "string" }, description: "Recent notable news. Max 3." },
        deAuthenticity: { type: "object", properties: { score: { type: "number", minimum: 0, maximum: 100 }, signals: { type: "array", items: { type: "string" } } }, required: ["score", "signals"] },
        growthTrajectory: { type: "string", enum: ["growing", "stable", "declining", "unknown"] },
      },
      required: ["industry", "stage", "fundingStatus", "layoffHistory", "leadershipChanges", "glassdoorSummary", "mediaHighlights", "deAuthenticity", "growthTrajectory"],
    },
    messages: [
      {
        role: "system",
        content: `You are a company research analyst. Summarize web search results about "${companyName}" into a structured company intelligence report. Base everything on the search results provided. If search results don't cover an area, say what's unknown rather than inventing.`,
      },
      { role: "user", content: `Search results for "${companyName}":\n\n${combinedSnippets}\n\nProduce a structured company intelligence report.` },
    ],
  });

  return {
    companyName,
    industry: result.arguments.industry,
    stage: result.arguments.stage as CompanyDeepDive["stage"],
    fundingStatus: result.arguments.fundingStatus,
    layoffHistory: (result.arguments.layoffHistory ?? []).slice(0, 3),
    leadershipChanges: (result.arguments.leadershipChanges ?? []).slice(0, 3),
    glassdoorSummary: result.arguments.glassdoorSummary,
    mediaHighlights: (result.arguments.mediaHighlights ?? []).slice(0, 3),
    deAuthenticity: {
      score: Math.max(0, Math.min(100, result.arguments.deAuthenticity.score)),
      signals: (result.arguments.deAuthenticity.signals ?? []).slice(0, 4),
    },
    growthTrajectory: result.arguments.growthTrajectory as CompanyDeepDive["growthTrajectory"],
    sources: allResults.flat().map((r) => r.url).slice(0, 10),
  };
}
