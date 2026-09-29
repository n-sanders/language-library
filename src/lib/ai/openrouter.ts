import { getApiKey } from "@/lib/settings";

const BASE_URL = "https://openrouter.ai/api/v1";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiNotConfiguredError extends Error {
  constructor() {
    super("The AI isn't set up yet. Ask a grown-up to add the OpenRouter API key in Admin > AI settings.");
  }
}

export class OpenRouterError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/language-library",
    "X-Title": "Language Library",
  };
}

function requireKey(): string {
  const key = getApiKey();
  if (!key) throw new AiNotConfiguredError();
  return key;
}

async function errorFrom(res: Response): Promise<OpenRouterError> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    detail = body?.error?.message ?? JSON.stringify(body);
  } catch {
    // keep statusText
  }
  return new OpenRouterError(res.status, `OpenRouter error (${res.status}): ${detail}`);
}

export type JsonSchemaFormat = { name: string; schema: Record<string, unknown> };

export async function complete(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  jsonSchema?: JsonSchemaFormat;
}): Promise<string> {
  const apiKey = requireKey();
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema },
    };
  }

  let res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  // Some models reject structured outputs; fall back to plain JSON-in-text.
  if (!res.ok && opts.jsonSchema && (res.status === 400 || res.status === 422)) {
    delete body.response_format;
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) throw await errorFrom(res);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new OpenRouterError(502, "OpenRouter returned an empty response.");
  return content;
}

/** Streams assistant text deltas as they arrive. */
export async function* stream(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const apiKey = requireKey();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.5,
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        if (json.error) throw new OpenRouterError(502, json.error.message ?? "Stream error");
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch (err) {
        if (err instanceof OpenRouterError) throw err;
      }
    }
  }
}

export type ModelInfo = { id: string; name: string; promptPrice: number | null };

export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE_URL}/models`, { next: { revalidate: 3600 } });
  if (!res.ok) throw await errorFrom(res);
  const data = await res.json();
  const models: ModelInfo[] = (data?.data ?? []).map((m: { id: string; name?: string; pricing?: { prompt?: string } }) => ({
    id: m.id,
    name: m.name ?? m.id,
    promptPrice: m.pricing?.prompt ? Number(m.pricing.prompt) : null,
  }));
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/** Checks the stored key against OpenRouter and makes a tiny request with the given model. */
export async function testConnection(model: string): Promise<string> {
  const apiKey = requireKey();
  const keyRes = await fetch(`${BASE_URL}/key`, { headers: headers(apiKey) });
  if (!keyRes.ok) throw await errorFrom(keyRes);

  const reply = await complete({
    model,
    temperature: 0,
    messages: [{ role: "user", content: "Reply with the single word: ready" }],
  });
  return reply.trim().slice(0, 80);
}
