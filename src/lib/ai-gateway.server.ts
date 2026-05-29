// Server-only helpers for calling AI models through the Vercel AI SDK.
// Do NOT import this file from client code.

import { generateText, Output } from "ai";
import { groq } from "@ai-sdk/groq";

type Message = any;
type ToolCallResult<T> = { name: string; arguments: T };

const DEFAULT_MODEL = groq("llama-3.3-70b-versatile");

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
  const { output } = await generateText({
    model,
    messages,
    output: Output.object({
      name: toolName,
      description: toolDescription,
      // library expects a FlexibleSchema; cast here to satisfy typings
      schema: parameters as any,
    }),
  });

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
  const { text } = await generateText({
    model,
    messages,
    output: Output.text(),
  });
  return text;
}
