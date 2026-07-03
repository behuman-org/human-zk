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

// Cotejo datos↔OCR: por defecto ESTRICTO (STRICT_DATA_CHECK !== "false"). Cualquier mismatch
// detectado bloquea. Modo blando legacy: STRICT_DATA_CHECK=false — solo bloquea contradicción
// fuerte de país. El gate biométrico (cara + liveness) sigue siendo la prueba de persona.
const STRICT_DATA_CHECK = process.env.STRICT_DATA_CHECK !== "false";

// El nº del DNI es texto chico: el OCR necesita más resolución que la detección de caras.
// En instancias con RAM (HF Spaces 16GB) subimos la pasada de OCR; bajable por env si hiciera falta.
const OCR_MAX_DIM = Number(process.env.OCR_MAX_DIM) > 0 ? Number(process.env.OCR_MAX_DIM) : 2000;

let workerP: Promise<Worker> | null = null;
async function getWorker(): Promise<Worker> {
  if (!workerP) workerP = createWorker("spa");
  return workerP;
}

function normalize(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ─── Tolerancia a ruido de OCR ─────────────────────────────────────────────────
// Confusiones típicas letra↔dígito del OCR (sobre texto YA en mayúsculas).
const LETTER_TO_DIGIT: Record<string, string> = {
  O: "0", Q: "0", D: "0", I: "1", L: "1", "|": "1", Z: "2", S: "5", B: "8", G: "6",
};

/** Convierte un token "casi numérico" a solo dígitos, mapeando confusiones del OCR. */
function tokenToDigits(token: string): string {
  return token
    .toUpperCase()
    .split("")
    .map((ch) => LETTER_TO_DIGIT[ch] ?? ch)
    .join("")
    .replace(/\D/g, "");
}

/** Distancia de edición (Levenshtein) entre dos strings cortos. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Un "token numérico" es solo dígitos + confusiones conocidas + separadores (puntos/barras).
const NUMERIC_TOKEN = /^[0-9OISBZGQDL.|]+$/i;

/**
 * Extrae candidatos de nº de documento (7-8 dígitos) del texto OCR, tolerando confusiones
 * letra↔dígito y nº partidos por espacios (12 345 678). Trabaja por palabras y solo une tokens
 * 100% "numéricos" (no fusiona letras de etiquetas como DOCUMENTO/DNI con el número).
 */
export function extractDocNumbers(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    let joined = "";
    for (let span = 0; span < 3 && i + span < words.length; span++) {
      const w = words[i + span];
      if (!NUMERIC_TOKEN.test(w)) break; // corta ante la primera palabra no-numérica
      joined += w;
      const digits = tokenToDigits(joined);
      if (digits.length >= 7 && digits.length <= 8) out.add(digits);
    }
  }
  return [...out];
}

/** Extrae años (19xx/20xx) del texto OCR, tolerando confusiones letra↔dígito. */
export function extractYears(text: string): number[] {
  const digitText = text.replace(/[OISBZGQDL|]/gi, (c) => LETTER_TO_DIGIT[c.toUpperCase()] ?? c);
  return [...new Set((digitText.match(/(?:19|20)\d{2}/g) ?? []).map(Number))];
}

/** ¿El nº declarado coincide (fuzzy) con algún candidato del OCR? Levenshtein ≤1 + inclusión. */
function docNumberMatches(declared: string, candidates: string[]): boolean {
  return candidates.some(
    (n) => n === declared || n.includes(declared) || declared.includes(n) || levenshtein(n, declared) <= 1,
  );
}

/** ¿El año declarado coincide (fuzzy) con algún año del OCR? Tolera 1 dígito mal leído. */
function yearMatches(declared: number, years: number[]): boolean {
  const ds = String(declared);
  return years.some((y) => y === declared || levenshtein(String(y), ds) <= 1);
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

/** OCR + detección de cara + extracción de candidatos. */
async function analyze(image: Buffer): Promise<DocAnalysis> {
  await loadModels(modelsPath());
  // La detección de caras no necesita alta resolución (y limita memoria).
  const faceImg = await fitImage(image);
  const hasFace = !!(await detectFace(faceImg));

  // Sin OCR devolvemos solo la señal de cara (el resto neutro); los validadores lo contemplan.
  if (!OCR_ENABLED) {
    return { hasFace, text: "", tokens: 0, keywordsFound: 0, hasDocNumber: false, docNumbers: [], years: [] };
  }

  // El OCR del nº usa MÁS resolución (texto chico). Pasada aparte (tenemos RAM en HF).
  const ocrImg = await fitImage(image, OCR_MAX_DIM);
  const worker = await getWorker();
  const { data } = await worker.recognize(ocrImg);
  const text = normalize(data.text ?? "");

  const tokens = text.split(/\s+/).filter((t) => t.replace(/[^A-Z0-9]/g, "").length >= 3).length;
  const keywordsFound = ID_KEYWORDS.filter((k) => text.includes(k)).length;
  // Extracción tolerante a ruido (recupera nº/años que el OCR leyó "sucios").
  const docNumbers = extractDocNumbers(text);
  const years = extractYears(text);

  return {
    hasFace,
    text,
    tokens,
    keywordsFound,
    hasDocNumber: docNumbers.length > 0,
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
  docNumbersFound: number; // cuántos nº recuperó el OCR (PII-free: solo el conteo)
  yearsFound: number; // cuántos años detectó el OCR (PII-free)
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
    docNumbersFound: a.docNumbers.length,
    yearsFound: a.years.length,
  };
}

// ─── Anti-fraude: cotejo de datos declarados vs. DNI ───────────────────────────

export interface DeclaredData {
  birthYear: number;
  docId: string;
  countryCode: number;
}

export interface DataCrossCheck {
  ok: boolean; // true si no hay NINGUNA discrepancia blanda (informativo)
  mismatches: string[]; // "doc_number" | "birth_year" | "country" (nombres, NO valores)
  contradiction: boolean; // contradicción FUERTE y clara (solo bloquea con STRICT_DATA_CHECK)
}

/**
 * Coteja los datos declarados contra el OCR del documento. PURA (testeable sin OCR).
 * Filosofía: señal anti-fraude BLANDA, tolerante al ruido del OCR. NO penaliza cuando el OCR
 * no pudo leer un campo (campo vacío ≠ contradicción); usa matching fuzzy (confusiones de
 * dígitos, Levenshtein ≤1). Solo marca `contradiction` ante evidencia FUERTE (el OCR leyó con
 * claridad OTRO país conocido distinto al declarado).
 * - doc_number: si el OCR recuperó algún nº y NINGUNO matchea (fuzzy) el declarado → mismatch blando.
 * - birth_year: si el OCR detectó años y NINGUNO matchea (fuzzy) el declarado → mismatch blando.
 * - country: si el declarado no aparece pero SÍ aparece otro país conocido → mismatch + contradicción.
 */
export function crossCheckData(a: DocAnalysis, d: DeclaredData): DataCrossCheck {
  const mismatches: string[] = [];
  let contradiction = false;

  // doc_number (blando): solo si el OCR recuperó al menos un nº candidato (si no, no comparamos).
  const declaredDoc = String(d.docId ?? "").replace(/\D/g, "");
  const candidates = [...new Set([...a.docNumbers.map((n) => n.replace(/\D/g, "")), ...extractDocNumbers(a.text)])]
    .filter((n) => n.length >= 7 && n.length <= 8);
  if (declaredDoc.length >= 7 && candidates.length > 0 && !docNumberMatches(declaredDoc, candidates)) {
    mismatches.push("doc_number");
  }

  // birth_year (blando): solo si el OCR detectó algún año.
  const years = a.years.length ? a.years : extractYears(a.text);
  if (Number.isFinite(d.birthYear) && years.length > 0 && !yearMatches(Number(d.birthYear), years)) {
    mismatches.push("birth_year");
  }

  // country: única señal potencialmente FUERTE (el OCR leyó claramente otro país conocido).
  const kw = COUNTRY_KEYWORDS[d.countryCode] ?? [];
  if (kw.length && !kw.some((k) => a.text.includes(k))) {
    const otherPresent = Object.entries(COUNTRY_KEYWORDS).some(
      ([code, ks]) => Number(code) !== d.countryCode && ks.some((k) => a.text.includes(k)),
    );
    if (otherPresent) {
      mismatches.push("country");
      contradiction = true;
    }
  }

  return { ok: mismatches.length === 0, mismatches, contradiction };
}

export interface DataCheck extends DocumentCheck {
  dataOk: boolean; // ¿coincidieron los datos? (informativo; ver `ok` para si rebota)
  mismatches: string[];
  contradiction: boolean; // contradicción fuerte detectada (bloquea solo en modo STRICT)
}

/**
 * Valida que sea un DNI y coteja los datos declarados. Por defecto (STRICT_DATA_CHECK) cualquier
 * mismatch bloquea. Con STRICT_DATA_CHECK=false solo bloquea contradicción fuerte de país.
 * `dataOk`/`mismatches` se devuelven como información (para flag/moderación y diagnóstico).
 */
export async function validateDocumentData(image: Buffer, declared: DeclaredData): Promise<DataCheck> {
  const a = await analyze(image);
  const reasons: string[] = [];
  if (!a.hasFace) reasons.push("no_face_in_document");
  const docLike = OCR_ENABLED ? looksLikeDocument(a) : true;
  if (!docLike) reasons.push("not_an_id_document");
  const docValid = a.hasFace && docLike;

  const cross = OCR_ENABLED
    ? crossCheckData(a, declared)
    : { ok: true, mismatches: [] as string[], contradiction: false };

  const blockedByData = STRICT_DATA_CHECK ? !cross.ok : cross.contradiction;
  if (blockedByData) {
    reasons.push(cross.contradiction ? "data_contradiction" : "data_mismatch");
  }

  return {
    ok: docValid && !blockedByData,
    reasons,
    hasFace: a.hasFace,
    keywordsFound: a.keywordsFound,
    tokens: a.tokens,
    hasDocNumber: a.hasDocNumber,
    docNumbersFound: a.docNumbers.length,
    yearsFound: a.years.length,
    dataOk: cross.ok,
    mismatches: cross.mismatches,
    contradiction: cross.contradiction,
  };
}
