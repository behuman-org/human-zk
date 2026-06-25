// Nivel 1 — agente validador (IA) con la API de Claude (@anthropic-ai/sdk).
// Configurable por modelo; testeable inyectando un cliente mock.
import Anthropic from "@anthropic-ai/sdk";
import type { CurationInput, CurationVerdict } from "@behuman/shared";
import { SYSTEM_RUBRIC, parseVerdict } from "./rubric.js";

// Interfaz mínima del cliente que usamos (permite mockear el LLM en tests).
export interface AnthropicLike {
  messages: {
    create(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export interface CuratorOptions {
  client?: AnthropicLike;
  model?: string;
}

export interface Curator {
  readonly model: string;
  reviewPost(input: CurationInput): Promise<CurationVerdict>;
}

function postPrompt(input: CurationInput): string {
  // Solo el contenido a evaluar. No se envía address ni PII (no existe en la entrada).
  return `Revisá esta opinión publicada en la plataforma:\n\n"""${input.content}"""`;
}

export function createCurator(opts: CuratorOptions = {}): Curator {
  const client: AnthropicLike = opts.client ?? (new Anthropic() as unknown as AnthropicLike);
  const model = opts.model ?? process.env.CURATION_MODEL ?? "claude-opus-4-8";

  async function reviewPost(input: CurationInput): Promise<CurationVerdict> {
    const res = await client.messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_RUBRIC,
      messages: [{ role: "user", content: postPrompt(input) }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return parseVerdict(text);
  }

  return { model, reviewPost };
}
