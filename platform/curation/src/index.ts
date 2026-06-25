// @behuman/curation — Curaduría en dos niveles (off-chain, aditiva).
//
// Nivel 1: agente validador (IA) evalúa veracidad/fuentes/toxicidad/plagio -> CurationVerdict.
// Nivel 2: casos dudosos/sensibles -> cola de moderación humana.
//
// Principio rector: filtrar ruido/abuso, NO censurar opiniones legítimas.
// ⚠️ Opera SOLO sobre contenido + platformId (seudónimo). NUNCA address ni PII.
// 📐 Ver en la vault: `Curaduría y Agentes Validadores`.
import type { CurationInput, CurationVerdict } from "@behuman/shared";
import { createCurator, type Curator } from "./agent.js";

export * from "./agent.js";
export * from "./queue.js";

let _curator: Curator | null = null;
function defaultCurator(): Curator {
  if (!_curator) _curator = createCurator();
  return _curator;
}

/** Conveniencia: revisa un post con el curador por defecto (modelo de env/CURATION_MODEL). */
export function reviewPost(input: CurationInput): Promise<CurationVerdict> {
  return defaultCurator().reviewPost(input);
}
