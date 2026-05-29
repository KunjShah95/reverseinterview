// Server-only helpers for calling AI models through a pluggable provider.
// Do NOT import this file from client code.

import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { generateTextWithProvider, Output, DEFAULT_PROVIDER, DEFAULT_MODEL as PROVIDER_DEFAULT_MODEL } from "@/lib/ai-provider.server";

type Message = any;
type ToolCallResult<T> = { name: string; arguments: T };

const DEFAULT_MODEL = PROVIDER_DEFAULT_MODEL ?? groq("llama-3.3-70b-versatile");

export class AIServiceError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Call a structured output generation that returns one JSON object matching
 * the given schema.
 */
export async function callStructured<T>({
  model = DEFAULT_MODEL,
  messages,
  toolName,
  toolDescription,
  parameters,
}: {
  model?: Parameters<typeof generateText>[0]["model"];
  messages: Message[];
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
}): Promise<ToolCallResult<T>> {
  const { output } = await generateTextWithProvider({
    provider: DEFAULT_PROVIDER,
    model,
    messages,
    output: Output.object({
      name: toolName,
      description: toolDescription,
      // library expects a FlexibleSchema; cast here to satisfy typings
      schema: parameters as any,
    }),
  } as any);

  return { name: toolName, arguments: output as T };
}

/** Plain text completion (no structured output). */
export async function callText({
  model = DEFAULT_MODEL,
  messages,
}: {
  model?: Parameters<typeof generateText>[0]["model"];
  messages: Message[];
}): Promise<string> {
  const { text } = await generateTextWithProvider({ provider: DEFAULT_PROVIDER, model, messages, output: Output.text() } as any);
  return text as string;
}
