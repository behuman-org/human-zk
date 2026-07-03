// Poseidon sobre BLS12-381 idéntico al circuito (mismo circomlib, mismo --prime).
//
// En vez de reimplementar Poseidon (y arriesgar no matchear las constantes que usa
// circom), usamos los circuitos auxiliares `poseidon1`/`poseidon2`/`poseidon3` compilados con
// `--prime bls12381` y leemos el output del witness (w[1]). Garantiza igualdad con
// `kyc.circom` por construcción. Validado contra las salidas reales del circuito.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Carpeta con los artefactos compilados del circuito (kyc + helpers). */
export function circuitsBuildDir(): string {
  return (
    process.env.CIRCUITS_BUILD_DIR ??
    resolve(here, "..", "..", "..", "identity", "circuits", "build")
  );
}

type WitnessCalculator = { calculateWitness(input: unknown, sanity: number): Promise<bigint[]> };

const cache = new Map<string, WitnessCalculator>();

async function loadCalc(name: string): Promise<WitnessCalculator> {
  const cached = cache.get(name);
  if (cached) return cached;
  const dir = resolve(circuitsBuildDir(), `${name}_js`);
  const mod = await import(resolve(dir, "witness_calculator.js"));
  const wasm = readFileSync(resolve(dir, `${name}.wasm`));
  const wc = (await mod.default(wasm)) as WitnessCalculator;
  cache.set(name, wc);
  return wc;
}

/** Poseidon(1) sobre BLS12-381 (nullifier global = Poseidon(secret)). */
export async function poseidon1(a: bigint | string | number): Promise<bigint> {
  const wc = await loadCalc("poseidon1");
  const w = await wc.calculateWitness({ a: String(a) }, 0);
  return w[1];
}

/** Poseidon(2) sobre BLS12-381. Entradas/salida como bigint (elementos de campo). */
export async function poseidon2(a: bigint | string | number, b: bigint | string): Promise<bigint> {
  const wc = await loadCalc("poseidon2");
  const w = await wc.calculateWitness({ a: String(a), b: String(b) }, 0);
  return w[1];
}

/** Poseidon(3) sobre BLS12-381 (commitment = Poseidon(birthYear, countryCode, secret)). */
export async function poseidon3(
  a: bigint | string | number,
  b: bigint | string | number,
  c: bigint | string | number,
): Promise<bigint> {
  const wc = await loadCalc("poseidon3");
  const w = await wc.calculateWitness({ a: String(a), b: String(b), c: String(c) }, 0);
  return w[1];
}
