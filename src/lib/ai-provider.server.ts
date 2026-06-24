// Server-only provider abstraction for AI model calls.
// Supports multiple model providers through the Vercel AI SDK.

import { generateText as vercelGenerateText, Output as VercelOutput } from "ai";
import { groq } from "@ai-sdk/groq";
import { mistral } from "@ai-sdk/mistral";
import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

export type ProviderName = "groq" | "mistral" | "gemini" | "openrouter" | "nvidia" | "vercel" | string;

export const DEFAULT_PROVIDER: ProviderName = (process.env.DEFAULT_AI_PROVIDER as ProviderName) || "groq";

// NVIDIA NIM — OpenAI-compatible inference endpoint.
// Get a free API key at: https://build.nvidia.com
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1";

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";

function defaultModelForProvider(provider: ProviderName): string {
  switch (provider) {
    case "mistral":
      return "mistral-large-latest";
    case "gemini":
      return "gemini-2.0-flash";
    case "openrouter":
      return "openrouter/free";
    case "nvidia":
      // Best general-purpose model on NVIDIA NIM free tier.
      // Full list: https://build.nvidia.com/explore/discover
      return "nvidia/llama-3.3-nemotron-super-49b-v1";
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
    case "nvidia": {
      const apiKey = process.env.NVIDIA_API_KEY?.trim() || "";
      const nvidia = createOpenAI({
        apiKey,
        baseURL: NVIDIA_BASE_URL,
        compatibility: "compatible", // NVIDIA NIM uses /chat/completions, not /responses
      });
      return nvidia(modelName);
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

const DEFAULT_MODEL_NAME = (process.env.DEFAULT_AI_MODEL as string)?.trim() || defaultModelForProvider(DEFAULT_PROVIDER);

export const DEFAULT_MODEL = createModel(DEFAULT_PROVIDER, DEFAULT_MODEL_NAME);

const BACKUP_MODELS = [
  // Order: fastest/cheapest working provider first.
  // Each provider is skipped if it is the current primary or if its key is missing.
  { provider: "nvidia",  modelName: "meta/llama-3.1-70b-instruct" },         // fast NVIDIA NIM fallback model
  { provider: "openrouter", modelName: "openrouter/free" },                 // OpenRouter fallback model
  { provider: "mistral", modelName: "mistral-small-latest" },                 // cheaper Mistral tier
  { provider: "mistral", modelName: "mistral-large-latest" },                 // full Mistral tier
  { provider: "groq",    modelName: "llama-3.3-70b-versatile" },              // fast, needs fresh key
  { provider: "gemini",  modelName: "gemini-2.0-flash" },                     // resets daily at midnight PST
];

function hasKeyForProvider(provider: ProviderName): boolean {
  switch (provider) {
    case "groq":
    case "vercel":
      return !!process.env.GROQ_API_KEY?.trim();
    case "mistral":
      return !!process.env.MISTRAL_API_KEY?.trim();
    case "gemini":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY?.trim();
    case "nvidia":
      return !!process.env.NVIDIA_API_KEY?.trim();
    default:
      return false;
  }
}

export async function generateTextWithProvider<
  T extends Parameters<typeof vercelGenerateText>[0]["output"]
>({
  provider = DEFAULT_PROVIDER,
  model = DEFAULT_MODEL,
  messages,
  output,
}: {
  provider?: ProviderName;
  model?: Parameters<typeof vercelGenerateText>[0]["model"];
  messages: Required<Parameters<typeof vercelGenerateText>[0]>["messages"];
  output: T;
}) {
  try {
    return await vercelGenerateText({ model, messages, output });
  } catch (error) {
    console.error(`Primary model call failed (Provider: ${provider}):`, error);

    // Attempt fallback to other configured models
    for (const backup of BACKUP_MODELS) {
      if (backup.provider === provider) continue; // Don't retry the same failing provider
      if (!hasKeyForProvider(backup.provider)) continue; // Skip if API key is missing

      try {
        console.warn(`Attempting fallback LLM call with provider: ${backup.provider}, model: ${backup.modelName}`);
        const fallbackModel = createModel(backup.provider, backup.modelName);
        return await vercelGenerateText({
          model: fallbackModel,
          messages,
          output,
        });
      } catch (fallbackError) {
        console.error(`Fallback model call failed (Provider: ${backup.provider}):`, fallbackError);
      }
    }

    // Re-throw the original error if all fallbacks failed
    throw error;
  }
}

export { VercelOutput as Output };
