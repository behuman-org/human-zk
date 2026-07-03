import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { poseidon3, MERKLE_DEPTH } from "@behuman/sdk";

// Estado de test aislado + provider DEV (sin biometría real; el gate real se prueba
// en matcher/__tests__). Setear ISSUER_STATE antes de importar el issuer.
const STATE = resolve(process.cwd(), ".issuer-state.test.json");
process.env.IDENTITY_PROVIDER = "dev";
process.env.ISSUER_STATE = STATE;
process.env.DEDUP_PEPPER = "test-pepper";

const { enrollVerifiedHuman } = await import("./index.js");
const { resetIssuerStateForTests } = await import("./store.js");

const dummy = Buffer.from([1, 2, 3]); // el DevProvider ignora las imágenes

describe("enrollVerifiedHuman (gate dev + de-dup anti-Sybil)", () => {
  beforeEach(() => {
    if (existsSync(STATE)) rmSync(STATE);
    resetIssuerStateForTests();
  });

  it("enrola un humano verificado y devuelve issuerRoot + camino Merkle", async () => {
    const commitment = (await poseidon3(1995, 32, "111111111111111111")).toString();
    const r = await enrollVerifiedHuman({
      document: dummy,
      selfieFrames: [dummy, dummy, dummy],
      commitment,
      docId: "DNI-AAA",
    });
    expect(r.ok).toBe(true);
    expect(r.issuerRoot).toBeTruthy();
    expect(r.pathElements).toHaveLength(MERKLE_DEPTH);
    expect(r.pathIndices).toHaveLength(MERKLE_DEPTH);
  });

  it("rechaza un segundo enrolamiento del mismo documento (anti-Sybil)", async () => {
    const c1 = (await poseidon3(1995, 32, "222")).toString();
    const c2 = (await poseidon3(1980, 32, "333")).toString();
    const first = await enrollVerifiedHuman({ document: dummy, selfieFrames: [dummy], commitment: c1, docId: "DNI-BBB" });
    expect(first.ok).toBe(true);

    const second = await enrollVerifiedHuman({ document: dummy, selfieFrames: [dummy], commitment: c2, docId: "DNI-BBB" });
    expect(second.ok).toBe(false);
    expect(second.reasons).toContain("already_enrolled");
  });

  it("permite enrolar a una persona distinta (otro documento)", async () => {
    const c1 = (await poseidon3(1995, 32, "444")).toString();
    const c2 = (await poseidon3(1992, 76, "555")).toString();
    await enrollVerifiedHuman({ document: dummy, selfieFrames: [dummy], commitment: c1, docId: "DNI-CCC" });
    const r = await enrollVerifiedHuman({ document: dummy, selfieFrames: [dummy], commitment: c2, docId: "DNI-DDD" });
    expect(r.ok).toBe(true);
  });
});
