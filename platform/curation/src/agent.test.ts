import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createCurator, type AnthropicLike } from "./agent.js";

// Cliente LLM mockeado: devuelve un texto fijo como respuesta del modelo.
function mockClient(text: string, spy?: (args: Record<string, unknown>) => void): AnthropicLike {
  return {
    messages: {
      create: async (args) => {
        spy?.(args);
        return { content: [{ type: "text", text }] };
      },
    },
  };
}

const input = { platformId: "0xabc12345", handle: "12345", content: "El asado es lo más." };

describe("createCurator.reviewPost (LLM mockeado)", () => {
  it("aprueba una opinión legítima", async () => {
    const c = createCurator({ client: mockClient('{"status":"approved","reason":"opinión legítima"}') });
    expect(await c.reviewPost(input)).toEqual({ status: "approved", reason: "opinión legítima" });
  });

  it("etiqueta (flagged) contenido problemático acotado", async () => {
    const c = createCurator({ client: mockClient('{"status":"flagged","reason":"toxicidad leve"}') });
    expect((await c.reviewPost(input)).status).toBe("flagged");
  });

  it("escala casos ambiguos", async () => {
    const c = createCurator({ client: mockClient('{"status":"escalated","reason":"caso sensible"}') });
    expect((await c.reviewPost(input)).status).toBe("escalated");
  });

  it("extrae JSON aunque venga con texto alrededor", async () => {
    const c = createCurator({ client: mockClient('Claro:\n{"status":"approved","reason":"ok"}\n¡Listo!') });
    expect((await c.reviewPost(input)).status).toBe("approved");
  });

  it("ante respuesta no parseable, ESCALA (fail-safe), no aprueba", async () => {
    const c = createCurator({ client: mockClient("no es json") });
    expect((await c.reviewPost(input)).status).toBe("escalated");
  });

  it("ante status inválido, ESCALA (fail-safe)", async () => {
    const c = createCurator({ client: mockClient('{"status":"banned"}') });
    expect((await c.reviewPost(input)).status).toBe("escalated");
  });

  it("NO envía address ni platformId al LLM (solo el contenido)", async () => {
    let sent = "";
    const c = createCurator({
      client: mockClient('{"status":"approved"}', (args) => {
        sent = JSON.stringify(args);
      }),
    });
    await c.reviewPost({ platformId: "0xSECRET_PID", handle: "ABCDE", content: "hola mundo" });
    expect(sent).toContain("hola mundo");
    expect(sent).not.toContain("0xSECRET_PID");
    expect(sent).not.toContain("ABCDE");
  });

  it("usa el modelo configurado", () => {
    expect(createCurator({ client: mockClient("{}"), model: "claude-haiku-4-5" }).model).toBe("claude-haiku-4-5");
  });
});

describe("cola de moderación", () => {
  const STORE = resolve(process.cwd(), ".moderation-queue.test.json");
  process.env.MODERATION_QUEUE = STORE;

  beforeEach(() => {
    if (existsSync(STORE)) rmSync(STORE);
  });

  it("encola, lista y resuelve sin guardar address/PII", async () => {
    const { escalateToModeration, getModerationQueue, resolveModeration } = await import("./queue.js");
    escalateToModeration({ id: "p1", platformId: "0xabc12345", handle: "12345", content: "dudoso", reason: "ambiguo" });
    escalateToModeration({ id: "p1", platformId: "0xabc12345", handle: "12345", content: "dudoso", reason: "ambiguo" }); // idempotente
    const q = getModerationQueue();
    expect(q).toHaveLength(1);
    expect(q[0].content).toBe("dudoso");
    expect(JSON.stringify(q[0])).not.toMatch(/address|G[A-Z0-9]{55}/);
    expect(resolveModeration("p1")).toBe(true);
    expect(getModerationQueue()).toHaveLength(0);
  });
});
