// Validación de documento (testnet): confirma que la imagen subida es una
// IDENTIFICACIÓN (DNI) y no una foto cualquiera. Señal principal: TEXTO (OCR) propio de
// un documento + una cara presente. Una selfie común no tiene texto -> se rechaza.
//
// ⚠️ Testnet/heurístico: NO valida autenticidad del documento (eso es RENAPER en prod).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker, type Worker } from "tesseract.js";
import { detectFace, loadModels } from "./faceEngine.js";

const here = dirname(fileURLToPath(import.meta.url));
function modelsPath(): string {
  return process.env.FACE_MODELS_PATH ?? resolve(here, "models");
}

// Palabras típicas del frente de un DNI (Argentina / Mercosur). Sin acentos/mayúsculas.
const ID_KEYWORDS = [
  "REPUBLICA", "ARGENTINA", "DOCUMENTO", "IDENTIDAD", "APELLIDO", "NOMBRE",
  "NACIONALIDAD", "SEXO", "EJEMPLAR", "NACIMIENTO", "MINISTERIO", "INTERIOR",
  "MERCOSUR", "TRAMITE", "DNI", "IDENT", "PASSPORT", "PASAPORTE", "LICENCIA",
];

function minKeywords(): number {
  const v = Number(process.env.DOC_MIN_KEYWORDS);
  return Number.isFinite(v) && v > 0 ? v : 2;
}
function minTokens(): number {
  const v = Number(process.env.DOC_MIN_TOKENS);
  return Number.isFinite(v) && v > 0 ? v : 15;
}

let workerP: Promise<Worker> | null = null;
async function getWorker(): Promise<Worker> {
  if (!workerP) workerP = createWorker("spa");
  return workerP;
}

function normalize(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface DocumentCheck {
  ok: boolean;
  reasons: string[];
  hasFace: boolean;
  keywordsFound: number;
  tokens: number;
  hasDocNumber: boolean;
}

/** Valida que `image` sea un documento de identidad (texto OCR + cara). */
export async function validateDocument(image: Buffer): Promise<DocumentCheck> {
  const reasons: string[] = [];

  await loadModels(modelsPath());
  const face = await detectFace(image);
  const hasFace = !!face;
  if (!hasFace) reasons.push("no_face_in_document");

  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  const text = normalize(data.text ?? "");

  const tokens = text.split(/\s+/).filter((t) => t.replace(/[^A-Z0-9]/g, "").length >= 3).length;
  const keywordsFound = ID_KEYWORDS.filter((k) => text.includes(k)).length;
  // Nº de documento (ej. 12.345.678 o 12345678).
  const hasDocNumber = /\b\d{1,2}\.?\d{3}\.?\d{3}\b/.test(text);

  const looksLikeDocument =
    keywordsFound >= minKeywords() || hasDocNumber || tokens >= minTokens();
  if (!looksLikeDocument) reasons.push("not_an_id_document");

  return {
    ok: hasFace && looksLikeDocument,
    reasons,
    hasFace,
    keywordsFound,
    tokens,
    hasDocNumber,
  };
}
