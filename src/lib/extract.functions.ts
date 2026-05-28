import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getApiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
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
      return {
        text: slice.join("\n\n").slice(0, 80_000),
        pagesExtracted: slice.length,
      };
    } catch (err) {
      throw new Error(classifyPdfError(err));
    }
  });

/** OCR / interpret a screenshot via Gemini vision. */
export const extractFromImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(20).max(15_000_000),
      mimeType: z.string().min(3).max(100),
    })
  )
  .handler(async ({ data }) => {
    const apiKey = getApiKey();
    const dataUrl = `data:${data.mimeType};base64,${data.base64}`;
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an OCR + transcription system. Extract ALL readable text from the image verbatim. If it's a job description, offer letter, or HR chat, preserve structure (headings, bullets, salary numbers). Return ONLY the extracted text — no commentary.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe everything readable in this image." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Vision extract failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return { text: text.slice(0, 40_000) };
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
        "User-Agent":
          "Mozilla/5.0 (compatible; ReverseHireBot/1.0; +https://lovable.dev)",
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
    const apiKey = getApiKey();

    const buckets: { url: string; html: string }[] = [];

    if (looksLikeUrl) {
      const base = (/^https?:\/\//i.test(q) ? q : `https://${q}`).replace(/\/+$/, "");
      let origin: string;
      try {
        origin = new URL(base).origin;
      } catch {
        throw new Error(`"${q}" is not a valid URL.`);
      }

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
      const tried = new Set<string>();
      const fetches = await Promise.all(
        candidatePaths.map(async (p) => {
          const url = origin + p;
          if (tried.has(url)) return null;
          tried.add(url);
          const html = await fetchPage(url);
          return html ? { url, html } : null;
        })
      );
      for (const f of fetches) if (f) buckets.push(f);

      if (buckets.length === 0) {
        throw new Error(
          `Couldn't reach ${origin}. The site may block bots — try pasting the JD directly.`
        );
      }
    }

    // Strip each fetched page and tag it so the AI can attribute content.
    const labelled = buckets
      .map(({ url, html }) => {
        const text = stripHtml(html).slice(0, 4000);
        if (text.length < 80) return null;
        return `--- PAGE: ${url} ---\n${text}`;
      })
      .filter((x): x is string => Boolean(x))
      .join("\n\n")
      .slice(0, 24_000);

    const userPrompt = labelled
      ? `Source pages scraped from the company website. Extract verbatim snippets (1-2 sentences) for each bucket. Mark "sourcesUsed" with the URLs you actually relied on. Be candid about red flags (vague values, generic culture talk, unpaid-equity language).\n\n${labelled}`
      : `Write a candid public-knowledge brief on "${q}" so a candidate can evaluate it. Include what they do, size estimate, known culture themes (good and bad), reputation cues. If unknown, say so plainly. Leave aboutSnippets/valuesSnippets/benefitsSnippets empty if not from a source.`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a candidate-side research analyst. Summarize a company crisply from supplied web pages or public knowledge. Quote verbatim where possible. Never invent benefits or values that aren't supported.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "company_brief",
              description: "Structured brief about the company.",
              parameters: lookupSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "company_brief" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Company lookup failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments: string } }> };
      }>;
    };
    const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      throw new Error("Company lookup returned no structured brief.");
    }
    let parsed: {
      companyName: string;
      summary: string;
      aboutSnippets?: string[];
      valuesSnippets?: string[];
      benefitsSnippets?: string[];
      cultureSignals?: string[];
      openRoleHints?: string[];
      reputationThemes?: string[];
      sourcesUsed?: string[];
    };
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      throw new Error("Company lookup returned malformed JSON.");
    }

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
    const apiKey = getApiKey();
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
        tools: [
          {
            type: "function",
            function: {
              name: "classify_document",
              description: "Tag the document type.",
              parameters: docTypeSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_document" } },
      }),
    });
    if (!res.ok) {
      return {
        docType: "unknown",
        confidence: "low",
        reason: "Classifier unavailable; proceeding without type detection.",
      };
    }
    const json = (await res.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments: string } }> };
      }>;
    };
    const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      return { docType: "unknown", confidence: "low", reason: "No classification returned." };
    }
    try {
      return JSON.parse(argsStr) as DocTypeResult;
    } catch {
      return { docType: "unknown", confidence: "low", reason: "Malformed classifier output." };
    }
  });
