// Server-only provider abstraction for AI model calls.
// Supports multiple model providers through the Vercel AI SDK.

import { generateText as vercelGenerateText, Output as VercelOutput } from "ai";
import { groq } from "@ai-sdk/groq";
import { mistral } from "@ai-sdk/mistral";
import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

export type ProviderName = "groq" | "mistral" | "gemini" | "openrouter" | "vercel" | string;

export const DEFAULT_PROVIDER: ProviderName = (process.env.DEFAULT_AI_PROVIDER as ProviderName) || "groq";

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";

function defaultModelForProvider(provider: ProviderName): string {
  switch (provider) {
    case "mistral":
      return "mistral-large-latest";
    case "gemini":
      return "gemini-2.0-flash";
    case "openrouter":
      return "openai/gpt-4o-mini";
    case "groq":
    case "vercel":
    default:
      return "llama-3.3-70b-versatile";
  }
}

function createModel(provider: ProviderName, modelName: string) {
  switch (provider) {
    case "groq":
    case "vercel":
      return groq(modelName);
    case "mistral":
      return mistral(modelName);
    case "gemini":
      return google(modelName);
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY?.trim() || "";
      const openrouter = createOpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
      return openrouter(modelName);
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

const DEFAULT_MODEL_NAME = (process.env.DEFAULT_AI_MODEL as string)?.trim() || defaultModelForProvider(DEFAULT_PROVIDER);

export const DEFAULT_MODEL = createModel(DEFAULT_PROVIDER, DEFAULT_MODEL_NAME);

export async function generateTextWithProvider({
  provider = DEFAULT_PROVIDER,
  model = DEFAULT_MODEL,
  messages,
  output,
}: {
  provider?: ProviderName;
  model?: any;
  messages: any[];
  output: any;
}) {
  if (provider === "vercel") {
    return vercelGenerateText({ model, messages, output });
  }

  return vercelGenerateText({ model, messages, output });
}

export { VercelOutput as Output };
