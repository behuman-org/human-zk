// Backend del gate de Capa 1 (matcher DNI + selfie).
//
// Endpoints:
//   GET  /health   -> estado + provider activo
//   POST /verify   -> gate puro: { document, selfie[] } -> MatchResult  (no crea identidad)
//   POST /enroll   -> gate + emisión de identidad Capa 1 (se agrega en la Fase 3)
//
// Privacidad (Ley 25.326): imágenes en memoria (nunca a disco), nunca se loguean,
// y la respuesta es PII-free (solo ok/score/razones). Ver Cumplimiento-Argentina.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import type { EnrollmentResult, MatchResult } from "@behuman/shared";
import { getProvider } from "./provider.js";
import { validateDocument, validateDocumentData } from "./documentCheck.js";
import { enrollVerifiedHuman } from "../src/index.js";

// Cargar .env desde la raíz del repo (matcher/ está en identity/issuer/matcher).
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "..", "..", "..", ".env") });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 25 }, // PII efímera; sin disco
});

const app = express();
app.use(express.json());

// CORS: el frontend (Vite, :5173) hace requests cross-origin al gate (:8787).
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, provider: getProvider().kind, threshold: Number(process.env.MATCH_THRESHOLD ?? 0.6) });
});

type MulterFiles = Record<string, Express.Multer.File[]>;

// Valida que la imagen subida sea un documento de identidad (DNI), no una foto cualquiera.
// El frontend habilita el escaneo de cara solo si esto da ok.
app.post("/document", upload.single("document"), async (req, res) => {
  const document = req.file?.buffer;
  if (!document) return res.status(400).json({ error: "missing_document" });
  try {
    const check = await validateDocument(document);
    console.log(
      `[document] ok=${check.ok} keywords=${check.keywordsFound} tokens=${check.tokens} docNumber=${check.hasDocNumber} reasons=${check.reasons.join(",")}`,
    );
    res.json({ ok: check.ok, reasons: check.reasons });
  } catch (err) {
    console.error("[document] error:", (err as Error).message);
    res.status(500).json({ error: "document_check_failed" });
  }
});

// Anti-fraude: coteja los datos declarados (año de nacimiento + nº de documento + país)
// contra el OCR del DNI. Si no coinciden, el frontend "rebota" el DNI para subir uno válido.
// Respuesta PII-free: solo ok + nombres de campos que no coinciden (nunca los valores).
app.post("/verify-data", upload.single("document"), async (req, res) => {
  const document = req.file?.buffer;
  if (!document) return res.status(400).json({ error: "missing_document" });
  const birthYear = Number(req.body?.birthYear);
  const docId = String(req.body?.docId ?? "");
  const countryCode = Number(req.body?.countryCode);
  if (!birthYear || !docId || !countryCode) return res.status(400).json({ error: "missing_fields" });
  try {
    const check = await validateDocumentData(document, { birthYear, docId, countryCode });
    console.log(
      `[verify-data] ok=${check.ok} dataOk=${check.dataOk} mismatches=${check.mismatches.join(",")} reasons=${check.reasons.join(",")}`,
    );
    res.json({ ok: check.ok, reasons: check.reasons, mismatches: check.mismatches });
  } catch (err) {
    console.error("[verify-data] error:", (err as Error).message);
    res.status(500).json({ error: "data_check_failed" });
  }
});

app.post(
  "/verify",
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "selfie", maxCount: 20 },
  ]),
  async (req, res) => {
    const files = req.files as MulterFiles | undefined;
    const document = files?.document?.[0]?.buffer;
    const selfieFrames = (files?.selfie ?? []).map((f) => f.buffer);

    if (!document) return res.status(400).json({ error: "missing_document" });
    if (selfieFrames.length === 0) return res.status(400).json({ error: "missing_selfie" });

    try {
      // Gate de documento: debe ser una identificación, no una foto cualquiera.
      const docCheck = await validateDocument(document);
      if (!docCheck.ok) {
        const rejected: MatchResult = {
          ok: false,
          matchScore: 0,
          matchDistance: 1,
          livenessOk: false,
          reasons: docCheck.reasons,
        };
        console.log(`[verify] documento inválido reasons=${docCheck.reasons.join(",")}`);
        return res.json(rejected);
      }
      const result: MatchResult = await getProvider().verifyIdentity({ document, selfieFrames });
      // Log PII-free: solo metadatos del resultado.
      console.log(
        `[verify] frames=${selfieFrames.length} ok=${result.ok} score=${result.matchScore} dist=${result.matchDistance} liveness=${result.livenessOk} reasons=${result.reasons.join(",")}`,
      );
      res.json(result);
    } catch (err) {
      console.error("[verify] error:", (err as Error).message);
      res.status(500).json({ error: "gate_failed" });
    }
  },
);

app.post(
  "/enroll",
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "selfie", maxCount: 20 },
  ]),
  async (req, res) => {
    const files = req.files as MulterFiles | undefined;
    const document = files?.document?.[0]?.buffer;
    const selfieFrames = (files?.selfie ?? []).map((f) => f.buffer);
    const commitment = String(req.body?.commitment ?? "");
    const docId = String(req.body?.docId ?? "");
    // Datos declarados para el cotejo anti-fraude (efímeros; nunca se persisten ni loguean).
    const birthYear = Number(req.body?.birthYear);
    const countryCode = Number(req.body?.countryCode);

    if (!document) return res.status(400).json({ error: "missing_document" });
    if (selfieFrames.length === 0) return res.status(400).json({ error: "missing_selfie" });
    if (!commitment) return res.status(400).json({ error: "missing_commitment" });
    if (!docId) return res.status(400).json({ error: "missing_docId" });
    if (!birthYear || !countryCode) return res.status(400).json({ error: "missing_declared_data" });

    try {
      // Anti-fraude AUTORITATIVO: el DNI debe ser válido Y los datos declarados deben
      // coincidir con el OCR. No se puede evadir desde un cliente manipulado.
      const docCheck = await validateDocumentData(document, { birthYear, docId, countryCode });
      if (!docCheck.ok) {
        const reasons = docCheck.mismatches.length ? ["data_mismatch", ...docCheck.reasons] : docCheck.reasons;
        console.log(`[enroll] rechazo reasons=${reasons.join(",")} mismatches=${docCheck.mismatches.join(",")}`);
        return res.json({ ok: false, reasons } satisfies EnrollmentResult);
      }
      const result: EnrollmentResult = await enrollVerifiedHuman({
        document,
        selfieFrames,
        commitment,
        docId,
      });
      // Log PII-free: sin docId ni imágenes.
      console.log(`[enroll] frames=${selfieFrames.length} ok=${result.ok} reasons=${result.reasons.join(",")}`);
      res.json(result);
    } catch (err) {
      console.error("[enroll] error:", (err as Error).message);
      res.status(500).json({ error: "enroll_failed" });
    }
  },
);

// Render (y otros PaaS) asignan el puerto vía $PORT; en local usamos MATCHER_PORT.
const port = Number(process.env.PORT ?? process.env.MATCHER_PORT ?? 8787);
// Solo levantar el server si se ejecuta directamente (no al importarlo en tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, () => {
    console.log(`beHuman matcher escuchando en :${port} (provider=${getProvider().kind})`);
  });
}

export { app };
