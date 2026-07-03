// Nivel 1 — agente validador (IA) con la API de Groq (groq-sdk).
// Configurable por modelo; testeable inyectando un cliente mock.
import Groq from "groq-sdk";
import type { CurationInput, CurationVerdict } from "@behuman/shared";
import { SYSTEM_RUBRIC, parseVerdict } from "./rubric.js";

// Interfaz mínima del cliente que usamos (permite mockear el LLM en tests).
// Compatible con la forma chat.completions de Groq (OpenAI-like).
export interface LLMLike {
  chat: {
    completions: {
      create(args: Record<string, unknown>): Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
}

export interface CuratorOptions {
  client?: LLMLike;
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
  const client: LLMLike = opts.client ?? (new Groq() as unknown as LLMLike);
  const model = opts.model ?? process.env.CURATION_MODEL ?? "openai/gpt-oss-20b";

  async function reviewPost(input: CurationInput): Promise<CurationVerdict> {
    const res = await client.chat.completions.create({
      model,
      max_tokens: 512,
      messages: [
        { role: "system", content: SYSTEM_RUBRIC },
        { role: "user", content: postPrompt(input) },
      ],
    });
    const text = res.choices?.[0]?.message?.content ?? "";
    return parseVerdict(text);
  }

  return { model, reviewPost };
}
