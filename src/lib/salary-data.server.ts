// Server-only real-market salary lookup via the Adzuna Jobs API.
// Free key: https://developer.adzuna.com/  →  set ADZUNA_APP_ID + ADZUNA_APP_KEY.
// Returns null (never throws) when unconfigured, timed out, or no match, so the
// salary agent transparently falls back to its model estimate.

import type { SalaryMarketData } from "./analysis-types";

const APP_ID = process.env.ADZUNA_APP_ID?.trim() || "";
const APP_KEY = process.env.ADZUNA_APP_KEY?.trim() || "";
const TIMEOUT_MS = Math.max(2_000, Number(process.env.ADZUNA_TIMEOUT_MS) || 8_000);

// Adzuna supports one endpoint per country. Map a free-text location to a
// supported country code; default is configurable, else "us".
const DEFAULT_COUNTRY = (process.env.ADZUNA_COUNTRY?.trim() || "us").toLowerCase();

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  us: "USD", gb: "GBP", au: "AUD", ca: "CAD", de: "EUR", fr: "EUR",
  in: "INR", it: "EUR", nl: "EUR", pl: "PLN", br: "BRL", za: "ZAR",
  sg: "SGD", nz: "NZD", es: "EUR", at: "EUR", ch: "CHF", mx: "MXN",
};

function detectCountry(location?: string): string {
  if (!location) return DEFAULT_COUNTRY;
  const l = location.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(uk|united kingdom|england|london|scotland|wales)\b/, "gb"],
    [/\b(usa|united states|u\.s\.|remote us|new york|san francisco|seattle|austin|texas|california)\b/, "us"],
    [/\b(canada|toronto|vancouver|ontario)\b/, "ca"],
    [/\b(australia|sydney|melbourne)\b/, "au"],
    [/\b(india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune)\b/, "in"],
    [/\b(germany|berlin|munich|deutschland)\b/, "de"],
    [/\b(france|paris)\b/, "fr"],
    [/\b(singapore)\b/, "sg"],
    [/\b(netherlands|amsterdam)\b/, "nl"],
  ];
  for (const [re, code] of rules) if (re.test(l)) return code;
  return DEFAULT_COUNTRY;
}

type AdzunaSearchResponse = {
  mean?: number;
  count?: number;
  results?: Array<{ salary_min?: number; salary_max?: number }>;
};

/**
 * Look up real average / range market compensation for a role.
 * @returns SalaryMarketData or null (unconfigured, error, or no usable data).
 */
export async function fetchMarketSalary({
  title,
  location,
}: {
  title: string;
  location?: string;
}): Promise<SalaryMarketData | null> {
  if (!APP_ID || !APP_KEY) return null;
  const cleanTitle = title.trim();
  if (cleanTitle.length < 2) return null;

  const country = detectCountry(location);
  const params = new URLSearchParams({
    app_id: APP_ID,
    app_key: APP_KEY,
    results_per_page: "50",
    what: cleanTitle,
    content_type: "application/json",
    salary_include_unknown: "0",
  });
  if (location) params.set("where", location);

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as AdzunaSearchResponse;
    const results = data.results ?? [];

    const mins = results.map((r) => r.salary_min).filter((n): n is number => typeof n === "number" && n > 0);
    const maxs = results.map((r) => r.salary_max).filter((n): n is number => typeof n === "number" && n > 0);

    const average = typeof data.mean === "number" && data.mean > 0
      ? Math.round(data.mean)
      : mins.length
        ? Math.round([...mins, ...maxs].reduce((s, n) => s + n, 0) / (mins.length + maxs.length))
        : 0;

    if (!average) return null;

    const min = mins.length ? Math.round(Math.min(...mins)) : Math.round(average * 0.8);
    const max = maxs.length ? Math.round(Math.max(...maxs)) : Math.round(average * 1.2);

    return {
      source: "Adzuna",
      currency: CURRENCY_BY_COUNTRY[country] ?? "USD",
      average,
      min,
      max,
      sampleSize: typeof data.count === "number" ? data.count : results.length,
      title: cleanTitle,
      location,
      asOf: new Date().toISOString(),
    };
  } catch {
    // Timeout / network / parse — degrade to model estimate.
    return null;
  }
}

export function formatMarketRange(data: SalaryMarketData): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: data.currency,
      maximumFractionDigits: 0,
    }).format(n);
  return `${fmt(data.min)}–${fmt(data.max)} (avg ${fmt(data.average)})`;
}
