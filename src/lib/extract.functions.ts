import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callStructured, callText } from "./ai-gateway.server";
import type { OcrSummary } from "./ocr-types";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const OCR_MAX_DIMENSION = 1800;
const OCR_LOW_CONFIDENCE = 55;

type TesseractWorkerResult = {
  data: {
    text?: string;
    confidence?: number;
    words?: Array<unknown>;
  };
};

type TesseractWorker = {
  recognize(input: string): Promise<TesseractWorkerResult>;
};

let tesseractWorkerPromise: Promise<TesseractWorker> | null = null;

type SearchHit = {
  url: string;
  title?: string;
  text: string;
  source: "exa" | "tavily";
};

function getEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeDomain(input: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function collectSearchText(value: {
  text?: string | null;
  summary?: string | null;
  content?: string | null;
  raw_content?: string | null;
  highlights?: string[] | null;
}): string {
  return [value.summary, value.text, value.content, value.raw_content, (value.highlights ?? []).join("\n")]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n")
    .trim();
}

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const mod = await import("tesseract.js");
      const createWorker = mod.createWorker as unknown as (lang: string) => Promise<TesseractWorker>;
      const worker = await createWorker("eng");
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

async function ocrImageDataUrl(dataUrl: string): Promise<{ text: string; confidence: number; wordCount: number }> {
  const worker = await getTesseractWorker();
  const result = await worker.recognize(dataUrl);
  const text = String(result?.data?.text ?? "").trim();
  const confidence = Number(result?.data?.confidence ?? 0);
  const wordCount = Array.isArray(result?.data?.words) ? result.data.words.length : text.split(/\s+/).filter(Boolean).length;
  return { text, confidence: Number.isFinite(confidence) ? confidence : 0, wordCount };
}


async function searchExa(query: string, includeDomains?: string[]): Promise<SearchHit[]> {
  const apiKey = getEnv("EXA_API_KEY");
  if (!apiKey) return [];

  const res = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      type: "auto",
      category: "company",
      numResults: 6,
      includeDomains: includeDomains?.length ? includeDomains : undefined,
      contents: {
        text: true,
        highlights: true,
        summary: true,
      },
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    results?: Array<{
      url?: string;
      title?: string;
      text?: string;
      summary?: string;
      highlights?: string[];
    }>;
  };

  return (json.results ?? [])
    .map((result) => {
      if (!result.url) return null;
      const text = collectSearchText(result);
      if (!text) return null;
      return {
        url: result.url,
        title: result.title,
        text,
        source: "exa" as const,
      };
    })
    .filter((hit): hit is SearchHit => Boolean(hit));
}

async function searchTavily(query: string, includeDomains?: string[]): Promise<SearchHit[]> {
  const apiKey = getEnv("TAVILY_API_KEY");
  if (!apiKey) return [];

  const res = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 6,
      include_answer: false,
      include_raw_content: true,
      include_domains: includeDomains?.length ? includeDomains : undefined,
      include_favicon: false,
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    results?: Array<{
      url?: string;
      title?: string;
      content?: string;
      raw_content?: string;
    }>;
  };

  return (json.results ?? [])
    .map((result) => {
      if (!result.url) return null;
      const text = collectSearchText(result);
      if (!text) return null;
      return {
        url: result.url,
        title: result.title,
        text,
        source: "tavily" as const,
      };
    })
    .filter((hit): hit is SearchHit => Boolean(hit));
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function classifyPdfError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("password") || msg.includes("encrypted")) {
    return "This PDF is password-protected. Remove the password and re-upload, or paste the text directly.";
  }
  if (msg.includes("invalid pdf") || msg.includes("missing pdf header") || msg.includes("not a pdf")) {
    return "That file doesn't look like a valid PDF.";
  }
  if (msg.includes("xref")) {
    return "The PDF is malformed or corrupted. Try re-exporting it from the source.";
  }
  return `Couldn't read the PDF: ${err instanceof Error ? err.message : "unknown error"}.`;
}

/** Get total page count + a quick first-page sample (used for early failure detection). */
export const getPdfInfo = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(20).max(20_000_000),
    })
  )
  .handler(async ({ data }) => {
    try {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const bytes = base64ToBytes(data.base64);
      const pdf = await getDocumentProxy(bytes);
      const numPages = pdf.numPages;

      // Sample first page to fail fast on image-only PDFs.
      let sample = "";
      try {
        const { text } = await extractText(pdf, { mergePages: false });
        sample = Array.isArray(text) ? (text[0] ?? "") : String(text).slice(0, 500);
      } catch {
        // ignore — sampling is best effort
      }

      const hasText = sample.trim().length >= 10;
      return {
        numPages,
        hasText,
        warning: !hasText
          ? "This PDF looks image-only (no embedded text). OCR via the Screenshot tab will work better."
          : null,
      };
    } catch (err) {
      throw new Error(classifyPdfError(err));
    }
  });

/** Extract text from a range of pages (1-indexed, inclusive). */
export const extractPdfPages = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(20).max(20_000_000),
      fromPage: z.number().int().min(1).max(2000),
      toPage: z.number().int().min(1).max(2000),
    })
  )
  .handler(async ({ data }) => {
    try {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const bytes = base64ToBytes(data.base64);
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: false });
      const allPages = Array.isArray(text) ? text : [String(text)];
      const slice = allPages.slice(data.fromPage - 1, data.toPage);

      const extracted = slice.join("\n\n").trim();
      if (extracted.length >= 40) {
        return {
          text: extracted.slice(0, 80_000),
          pagesExtracted: slice.length,
          method: "text-extract" as const,
          confidence: 100,
          warnings: [] as string[],
        };
      }

      return {
        text: "",
        pagesExtracted: slice.length,
        method: "text-extract" as const,
        confidence: 0,
        warnings: [
          "This PDF appears image-only, and binary OCR rendering is disabled in this environment. Try pasting the text or using a screenshot instead.",
        ],
      };
    } catch (err) {
      throw new Error(classifyPdfError(err));
    }
  });

/** OCR / interpret a screenshot via open-source OCR only (no Groq/vision fallback). */
export const extractFromImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(20).max(15_000_000),
      mimeType: z.string().min(3).max(100),
    })
  )
  .handler(async ({ data }) => {
    const dataUrl = `data:${data.mimeType};base64,${data.base64}`;
    const result = await ocrImageDataUrl(dataUrl);
    const warnings: string[] = [];

    if (result.confidence < OCR_LOW_CONFIDENCE || result.text.length < 20) {
      warnings.push(
        "Open-source OCR confidence is low; the extracted text may be incomplete or inaccurate. Please review and edit before analysis."
      );
    }

    return {
      text: result.text.slice(0, 40_000),
      method: "tesseract" as const,
      confidence: Math.round(result.confidence),
      warnings,
      averageWordCount: result.wordCount,
    };
  });

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string, timeoutMs = 8000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OfferGuardAI/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const lookupSchema = {
  type: "object",
  properties: {
    companyName: { type: "string" },
    summary: { type: "string", description: "One paragraph of what they do." },
    aboutSnippets: { type: "array", items: { type: "string" } },
    valuesSnippets: { type: "array", items: { type: "string" } },
    benefitsSnippets: { type: "array", items: { type: "string" } },
    cultureSignals: {
      type: "array",
      items: { type: "string" },
      description: "Concrete culture cues (positive or concerning).",
    },
    openRoleHints: {
      type: "array",
      items: { type: "string" },
      description: "Recurring phrasing in their hiring language.",
    },
    reputationThemes: {
      type: "array",
      items: { type: "string" },
      description: "What candidates or employees commonly say.",
    },
    sourcesUsed: { type: "array", items: { type: "string" } },
  },
  required: ["companyName", "summary"],
};

/** Look up a company by URL or name; pull About/Values/Benefits/Careers pages when possible. */
export const lookupCompany = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      query: z.string().min(2).max(500),
    })
  )
  .handler(async ({ data }) => {
    const q = data.query.trim();
    const looksLikeUrl = /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+/i.test(q);
    const base = looksLikeUrl ? (/^https?:\/\//i.test(q) ? q : `https://${q}`).replace(/\/+$/, "") : null;
    const origin = base ? new URL(base).origin : null;
    const hostname = origin ? normalizeDomain(origin) : null;
    const includeDomains = hostname ? [hostname] : undefined;

    const sourceMap = new Map<string, { url: string; text: string }>();
    const addSource = (url: string, text: string) => {
      const cleaned = text.trim();
      if (!cleaned || cleaned.length < 40 || sourceMap.has(url)) return;
      sourceMap.set(url, { url, text: cleaned.slice(0, 4000) });
    };

    if (looksLikeUrl && origin) {
      const candidatePaths = [
        "",
        "/about",
        "/about-us",
        "/company",
        "/values",
        "/culture",
        "/careers",
        "/jobs",
        "/benefits",
        "/life",
        "/team",
      ];

      for (const p of candidatePaths) {
        const url = origin + p;
        const html = await fetchPage(url);
        if (html) addSource(url, stripHtml(html));
      }
    }

    const searchQueries = looksLikeUrl
      ? [q, `${hostname ?? q} about`, `${hostname ?? q} careers`]
      : [q, `${q} company`, `${q} about`, `${q} careers`, `${q} values`, `${q} culture`];

    const searchHits = (
      await Promise.all(
        searchQueries.flatMap((query) => [
          searchExa(query, includeDomains),
          searchTavily(query, includeDomains),
        ])
      )
    ).flat();

    for (const hit of searchHits) {
      addSource(hit.url, [hit.title, hit.text].filter(Boolean).join("\n"));
    }

    if (looksLikeUrl && origin && sourceMap.size === 0) {
      throw new Error(
        `Couldn't reach ${origin}. The site may block bots — try pasting the JD directly.`
      );
    }

    const labelled = [...sourceMap.values()]
      .map(({ url, text }) => `--- SOURCE: ${url} ---\n${text}`)
      .join("\n\n")
      .slice(0, 24_000);

    const userPrompt = labelled
      ? `Source pages and search results for the company. Extract verbatim snippets (1-2 sentences) for each bucket. Mark "sourcesUsed" with the URLs you actually relied on. Be candid about red flags (vague values, generic culture talk, unpaid-equity language).\n\n${labelled}`
      : `Write a candid public-knowledge brief on "${q}" so a candidate can evaluate it. Include what they do, size estimate, known culture themes (good and bad), reputation cues. If unknown, say so plainly. Leave aboutSnippets/valuesSnippets/benefitsSnippets empty if not from a source.`;

    const { arguments: parsed } = await callStructured<{
      companyName: string;
      summary: string;
      aboutSnippets?: string[];
      valuesSnippets?: string[];
      benefitsSnippets?: string[];
      cultureSignals?: string[];
      openRoleHints?: string[];
      reputationThemes?: string[];
      sourcesUsed?: string[];
    }>({
      messages: [
        {
          role: "system",
          content:
            "You are a candidate-side research analyst. Summarize a company crisply from supplied web pages or public knowledge. Quote verbatim where possible. Never invent benefits or values that aren't supported.",
        },
        { role: "user", content: userPrompt },
      ],
      toolName: "company_brief",
      toolDescription: "Structured brief about the company.",
      parameters: lookupSchema,
    });

    // Re-flatten into the source text the analysis agents will consume.
    const sections: string[] = [];
    sections.push(`COMPANY: ${parsed.companyName}`);
    sections.push(`\nSUMMARY\n${parsed.summary}`);
    const add = (title: string, items?: string[]) => {
      if (items && items.length) {
        sections.push(`\n${title}\n- ${items.join("\n- ")}`);
      }
    };
    add("ABOUT", parsed.aboutSnippets);
    add("VALUES", parsed.valuesSnippets);
    add("BENEFITS", parsed.benefitsSnippets);
    add("CULTURE SIGNALS", parsed.cultureSignals);
    add("HIRING LANGUAGE PATTERNS", parsed.openRoleHints);
    add("REPUTATION THEMES", parsed.reputationThemes);
    if (parsed.sourcesUsed?.length) {
      sections.push(`\nSOURCES\n- ${parsed.sourcesUsed.join("\n- ")}`);
    }

    return {
      text: sections.join("\n").slice(0, 18_000),
      source: looksLikeUrl ? q : parsed.companyName,
      brief: parsed,
    };
  });

const docTypeSchema = {
  type: "object",
  properties: {
    docType: {
      type: "string",
      enum: [
        "job_description",
        "offer_letter",
        "recruiter_chat",
        "company_brief",
        "unknown",
      ],
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reason: { type: "string" },
    suggestedCompany: { type: "string" },
    suggestedRole: { type: "string" },
  },
  required: ["docType", "confidence", "reason"],
};

export type DocTypeResult = {
  docType:
    | "job_description"
    | "offer_letter"
    | "recruiter_chat"
    | "company_brief"
    | "unknown";
  confidence: "low" | "medium" | "high";
  reason: string;
  suggestedCompany?: string;
  suggestedRole?: string;
};

/** Quick AI classifier that tags what kind of document the user submitted. */
export const detectDocType = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string().min(20).max(20_000) }))
  .handler(async ({ data }): Promise<DocTypeResult> => {
    const { arguments: parsed } = await callStructured<DocTypeResult>({
      messages: [
        {
          role: "system",
          content:
            "Classify the document type. Job description = public posting describing a role. Offer letter = personalized offer with salary, start date, equity terms addressed to a candidate. Recruiter chat = informal back-and-forth messages. Company brief = general company info, not a specific role.",
        },
        {
          role: "user",
          content: `Classify this:\n\n"""\n${data.text.slice(0, 6000)}\n"""`,
        },
      ],
      toolName: "classify_document",
      toolDescription: "Tag the document type.",
      parameters: docTypeSchema,
    });
    try {
      return parsed;
    } catch {
      return { docType: "unknown", confidence: "low", reason: "Malformed classifier output." };
    }
  });
