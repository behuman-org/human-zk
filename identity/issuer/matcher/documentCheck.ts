// Validación de documento (testnet): confirma que la imagen subida es una
// IDENTIFICACIÓN (DNI) y no una foto cualquiera, y —anti-fraude— que los DATOS declarados
// por la persona COINCIDEN con los del documento (nº de documento + año de nacimiento + país).
//
// Señales: TEXTO (OCR) propio de un documento + una cara presente + cotejo de los campos
// declarados contra el OCR. Si los datos no coinciden, el DNI se RECHAZA ("se rebota") y la
// persona debe subir uno válido.
//
// ⚠️ Testnet/heurístico: NO valida autenticidad del documento (eso es RENAPER en prod).
// Privacidad: el OCR es efímero; los logs son PII-free (solo nombres de campos, nunca valores).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker, type Worker } from "tesseract.js";
import { detectFace, fitImage, loadModels } from "./faceEngine.js";

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

// Palabras de país por código ISO numérico (coincide con Attributes/circuito).
const COUNTRY_KEYWORDS: Record<number, string[]> = {
  32: ["ARGENTINA"],
  76: ["BRASIL", "BRAZIL"],
  152: ["CHILE"],
  858: ["URUGUAY", "ORIENTAL"],
};

function minKeywords(): number {
  const v = Number(process.env.DOC_MIN_KEYWORDS);
  return Number.isFinite(v) && v > 0 ? v : 2;
}
function minTokens(): number {
  const v = Number(process.env.DOC_MIN_TOKENS);
  return Number.isFinite(v) && v > 0 ? v : 15;
}

// OCR (tesseract) es opcional: solo aporta el chequeo heurístico de "es un documento" y el
// cotejo anti-fraude de datos declarados (testnet, no valida autenticidad). Cargarlo junto a
// tfjs no entra en instancias de 512MB (OOM). Con OCR_ENABLED=false el KYC sigue funcionando
// por el match facial DNI↔selfie + liveness (el núcleo de prueba de persona).
const OCR_ENABLED = process.env.OCR_ENABLED !== "false";

let workerP: Promise<Worker> | null = null;
async function getWorker(): Promise<Worker> {
  if (!workerP) workerP = createWorker("spa");
  return workerP;
}

function normalize(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Resultado del análisis OCR + cara de una imagen de documento. */
export interface DocAnalysis {
  hasFace: boolean;
  text: string; // normalizado (mayúsculas, sin acentos)
  tokens: number;
  keywordsFound: number;
  hasDocNumber: boolean;
  docNumbers: string[]; // candidatos de nº de documento, solo dígitos (7-8)
  years: number[]; // años de 4 dígitos detectados (19xx/20xx)
}

/** OCR + detección de cara + extracción de candidatos (una sola pasada). */
async function analyze(image: Buffer): Promise<DocAnalysis> {
  await loadModels(modelsPath());
  // Reescalar una sola vez y reusar para cara + OCR (evita decodificar la imagen full-res
  // dos veces; clave para no quedarnos sin memoria en instancias chicas).
  const small = await fitImage(image);
  const hasFace = !!(await detectFace(small));

  // Sin OCR devolvemos solo la señal de cara (el resto neutro); los validadores lo contemplan.
  if (!OCR_ENABLED) {
    return { hasFace, text: "", tokens: 0, keywordsFound: 0, hasDocNumber: false, docNumbers: [], years: [] };
  }

  const worker = await getWorker();
  const { data } = await worker.recognize(small);
  const text = normalize(data.text ?? "");

  const tokens = text.split(/\s+/).filter((t) => t.replace(/[^A-Z0-9]/g, "").length >= 3).length;
  const keywordsFound = ID_KEYWORDS.filter((k) => text.includes(k)).length;
  const docMatches = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}\b/g) ?? [];
  const docNumbers = docMatches.map((s) => s.replace(/\D/g, "")).filter((n) => n.length >= 7 && n.length <= 8);
  const years = (text.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number);

  return {
    hasFace,
    text,
    tokens,
    keywordsFound,
    hasDocNumber: docMatches.length > 0,
    docNumbers,
    years,
  };
}

function looksLikeDocument(a: DocAnalysis): boolean {
  return a.keywordsFound >= minKeywords() || a.hasDocNumber || a.tokens >= minTokens();
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
  const a = await analyze(image);
  const reasons: string[] = [];
  if (!a.hasFace) reasons.push("no_face_in_document");
  // Sin OCR no podemos validar el "tipo de documento": basta con que haya una cara.
  const docLike = OCR_ENABLED ? looksLikeDocument(a) : true;
  if (!docLike) reasons.push("not_an_id_document");
  return {
    ok: a.hasFace && docLike,
    reasons,
    hasFace: a.hasFace,
    keywordsFound: a.keywordsFound,
    tokens: a.tokens,
    hasDocNumber: a.hasDocNumber,
  };
}

// ─── Anti-fraude: cotejo de datos declarados vs. DNI ───────────────────────────

export interface DeclaredData {
  birthYear: number;
  docId: string;
  countryCode: number;
}

export interface DataCrossCheck {
  ok: boolean;
  mismatches: string[]; // "doc_number" | "birth_year" | "country" (nombres, NO valores)
}

/**
 * Coteja los datos declarados contra el OCR del documento. PURA (testeable sin OCR).
 * - doc_number: el nº declarado debe aparecer entre los nº detectados en el DNI.
 * - birth_year: el año declarado debe aparecer entre los años detectados.
 * - country: si el país declarado no aparece pero SÍ aparece otro país conocido → mismatch.
 *   (si no se detecta ningún país, no se penaliza para no rebotar por ruido de OCR).
 */
export function crossCheckData(a: DocAnalysis, d: DeclaredData): DataCrossCheck {
  const mismatches: string[] = [];

  const declaredDoc = String(d.docId ?? "").replace(/\D/g, "");
  const docOk =
    declaredDoc.length >= 7 &&
    a.docNumbers.some((n) => n === declaredDoc || n.includes(declaredDoc) || declaredDoc.includes(n));
  if (!docOk) mismatches.push("doc_number");

  if (!a.years.includes(Number(d.birthYear))) mismatches.push("birth_year");

  const kw = COUNTRY_KEYWORDS[d.countryCode] ?? [];
  if (kw.length && !kw.some((k) => a.text.includes(k))) {
    const otherPresent = Object.entries(COUNTRY_KEYWORDS).some(
      ([code, ks]) => Number(code) !== d.countryCode && ks.some((k) => a.text.includes(k)),
    );
    if (otherPresent) mismatches.push("country");
  }

  return { ok: mismatches.length === 0, mismatches };
}

export interface DataCheck extends DocumentCheck {
  dataOk: boolean;
  mismatches: string[];
}

/**
 * Valida que sea un DNI Y que los datos declarados coincidan. Una sola pasada de OCR.
 * `ok` es true solo si es un documento válido (cara + texto) Y los datos coinciden.
 */
export async function validateDocumentData(image: Buffer, declared: DeclaredData): Promise<DataCheck> {
  const a = await analyze(image);
  const reasons: string[] = [];
  if (!a.hasFace) reasons.push("no_face_in_document");
  const docLike = OCR_ENABLED ? looksLikeDocument(a) : true;
  if (!docLike) reasons.push("not_an_id_document");
  const docValid = a.hasFace && docLike;

  // Sin OCR no hay cotejo anti-fraude: aceptamos los datos declarados (solo importa la cara).
  if (!OCR_ENABLED) {
    return {
      ok: docValid,
      reasons,
      hasFace: a.hasFace,
      keywordsFound: a.keywordsFound,
      tokens: a.tokens,
      hasDocNumber: a.hasDocNumber,
      dataOk: true,
      mismatches: [],
    };
  }

  const cross = crossCheckData(a, declared);
  // Si ni siquiera pudimos leer nº de documento ni años, no se puede cotejar → DNI ilegible.
  if (docValid && a.docNumbers.length === 0 && a.years.length === 0) {
    reasons.push("document_unreadable");
  }

  return {
    ok: docValid && cross.ok && !reasons.includes("document_unreadable"),
    reasons,
    hasFace: a.hasFace,
    keywordsFound: a.keywordsFound,
    tokens: a.tokens,
    hasDocNumber: a.hasDocNumber,
    dataOk: cross.ok,
    mismatches: cross.mismatches,
  };
}
