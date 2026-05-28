import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getApiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

/** Extract text from a base64-encoded PDF using unpdf (edge-safe). */
export const extractFromPdf = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(20).max(15_000_000),
      filename: z.string().max(300).optional(),
    })
  )
  .handler(async ({ data }) => {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buf = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n") : String(text);
    return { text: merged.slice(0, 40_000) };
  });

/** OCR / interpret a screenshot of a JD / chat / offer via Gemini vision. */
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

/** Look up a company by URL or name. URLs are fetched + stripped; names go through AI summary. */
export const lookupCompany = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      query: z.string().min(2).max(500),
    })
  )
  .handler(async ({ data }) => {
    const q = data.query.trim();
    const looksLikeUrl = /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+/.test(q);

    if (looksLikeUrl) {
      const url = /^https?:\/\//i.test(q) ? q : `https://${q}`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; ReverseHireBot/1.0; +https://lovable.dev)",
            Accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const html = await res.text();
        const text = stripHtml(html).slice(0, 12_000);
        if (text.length < 100) {
          throw new Error("Page returned too little readable content");
        }
        return { text, source: url };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "fetch failed";
        throw new Error(
          `Couldn't fetch ${url}: ${msg}. Try pasting the job description directly.`
        );
      }
    }

    // Fallback: company name → AI-generated public-knowledge brief
    const apiKey = getApiKey();
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
              "You generate a factual one-page brief about a company based on widely-known public information. Include: what they do, size estimate, known culture signals (good and bad), Glassdoor-style reputation themes, recent news. Be balanced. If you don't know the company, say so plainly. Output plain text only.",
          },
          {
            role: "user",
            content: `Write a candid public-knowledge brief on this company so a candidate can evaluate it: "${q}"`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Company lookup failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (json.choices?.[0]?.message?.content ?? "").trim();
    if (text.length < 50) {
      throw new Error("Couldn't generate a useful brief for that company name.");
    }
    return { text: text.slice(0, 12_000), source: q };
  });
