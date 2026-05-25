// Server-only helpers for calling the Lovable AI Gateway.
// Do NOT import this file from client code.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Message = { role: "system" | "user" | "assistant"; content: string };

type ToolCallResult<T> = { name: string; arguments: T };

export class AIGatewayError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getApiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

/**
 * Call a tool-calling completion that forces the model to return one
 * structured JSON object matching the given parameters schema.
 */
export async function callStructured<T>({
  model = "google/gemini-3-flash-preview",
  messages,
  toolName,
  toolDescription,
  parameters,
}: {
  model?: string;
  messages: Message[];
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
}): Promise<ToolCallResult<T>> {
  const apiKey = getApiKey();

  const body = {
    model,
    messages,
    tools: [
      {
        type: "function",
        function: {
          name: toolName,
          description: toolDescription,
          parameters,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: toolName } },
  };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AIGatewayError(
      `AI Gateway ${res.status}: ${text.slice(0, 300)}`,
      res.status
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          function?: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call?.arguments) {
    throw new AIGatewayError("AI Gateway returned no tool call", 500);
  }

  let parsed: T;
  try {
    parsed = JSON.parse(call.arguments) as T;
  } catch {
    throw new AIGatewayError("AI Gateway returned malformed JSON", 500);
  }

  return { name: call.name, arguments: parsed };
}

/** Plain text completion (no tools). */
export async function callText({
  model = "google/gemini-3-flash-preview",
  messages,
}: {
  model?: string;
  messages: Message[];
}): Promise<string> {
  const apiKey = getApiKey();
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AIGatewayError(
      `AI Gateway ${res.status}: ${text.slice(0, 300)}`,
      res.status
    );
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}
