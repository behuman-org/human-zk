// Flujo completo de Capa 1 desde el frontend:
//   wallet -> consentimiento -> DNI -> datos -> cara -> [enroll + prueba ZK + on-chain]
//   -> is_verified == true.
//
// Privacidad: la PII (imágenes) va al gate y no se persiste; el `secret` se genera y queda
// en el device; on-chain sólo van commitment/proof/nullifier/issuerRoot.
//
// Anti-Sybil (dos candados, ambos visibles):
//   1) de-dup por documento en el issuer  -> "este documento ya fue validado".
//   2) nullifier on-chain en verify_and_register -> "este humano ya tiene identidad".
import { useState } from "react";
import { Consent } from "./Consent";
import { DocumentUpload } from "./DocumentUpload";
import { Attributes, type AttributesInput } from "./Attributes";
import { FaceScan } from "./FaceScan";
import { connectWallet } from "./wallet";
import { enroll } from "./api";
import { computeCommitment, generateProof, randomSecret, type GeneratedProof } from "./zk";
import { initIfNeeded, isVerified, verifyAndRegister, ContractError } from "./chain";
import { CONTRACT_ID } from "./stellar";
import { loadCredential, saveCredential, type StoredCredential } from "./credentialStore";

type Step = "connect" | "consent" | "document" | "attributes" | "scan" | "processing" | "done" | "error";

const REASON: Record<string, string> = {
  already_enrolled: "Este documento ya fue validado (anti-Sybil). No puede crear otra identidad.",
  face_mismatch: "La cara no coincide con la del documento.",
  no_liveness_motion: "No se detectó vivacidad (parpadeo/giro).",
  not_an_id_document: "La imagen no es un documento de identidad.",
  no_face_in_document: "No se detecta cara en el documento.",
  no_face_in_selfie: "No se detecta tu cara en el escaneo.",
};

export function KycFlow() {
  const [step, setStep] = useState<Step>("connect");
  const [address, setAddress] = useState<string | null>(null);
  const [doc, setDoc] = useState<Blob | null>(null);
  const [attrs, setAttrs] = useState<AttributesInput | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [lastProof, setLastProof] = useState<GeneratedProof | null>(null);
  const [nullifierMsg, setNullifierMsg] = useState<string | null>(null);

  function fail(m: string) {
    setError(m);
    setStep("error");
  }

  async function onConnect() {
    try {
      setAddress(await connectWallet());
      setStep("consent");
    } catch (e) {
      fail("No se pudo conectar la wallet: " + (e as Error).message);
    }
  }

  async function process(frames: Blob[]) {
    if (!doc || !attrs || !address) return fail("Faltan datos del flujo.");
    setStep("processing");
    try {
      // Reanudar desde una credencial guardada (evita re-enrolar y el de-dup).
      let cred: StoredCredential | null = loadCredential(attrs.docId);
      if (cred) {
        setMsg("Recuperando tu credencial guardada en este dispositivo…");
      } else {
        setMsg("Generando tu secreto e identidad (en el dispositivo)…");
        const secret = randomSecret();
        const commitment = await computeCommitment(attrs, secret);

        setMsg("Validando documento + cara y registrando en el issuer…");
        const en = await enroll(doc, frames, commitment, attrs.docId);
        if (!en.ok) {
          if (en.reasons.includes("already_enrolled")) {
            return fail(
              "Este documento ya fue validado en otra sesión/dispositivo y no tenemos tu credencial acá. " +
                "Usá “Ver mi estado” con tu wallet; si necesitás re-validar, pedí un reset del issuer.",
            );
          }
          return fail(en.reasons.map((r) => REASON[r] ?? r).join(" "));
        }
        cred = {
          attributes: attrs,
          secret,
          issuerRoot: en.issuerRoot!,
          pathElements: en.pathElements!,
          pathIndices: en.pathIndices!,
        };
        saveCredential(attrs.docId, cred); // resumible si falla el on-chain
      }

      setMsg("Generando la prueba ZK en tu dispositivo (la PII no sale)…");
      const gen = await generateProof(
        cred.attributes,
        cred.secret,
        cred.pathElements,
        cred.pathIndices,
        address,
      );
      setLastProof(gen);

      setMsg("Inicializando el registro on-chain si hace falta (firmá en la wallet)…");
      await initIfNeeded(address, cred.issuerRoot);

      setMsg("Registrando en Stellar — firmá en tu wallet…");
      let hash: string;
      try {
        hash = await verifyAndRegister(address, gen);
      } catch (e) {
        if (e instanceof ContractError && e.code === 3) {
          return fail("Este humano ya tiene identidad (rechazo on-chain por nullifier).");
        }
        throw e;
      }
      setTxHash(hash);

      setMsg("Confirmando on-chain…");
      setVerified(await isVerified(address));
      setStep("done");
    } catch (e) {
      fail((e as Error).message);
    }
  }

  // Demuestra el segundo candado: reenviar la misma prueba -> nullifier ya usado.
  async function retryRegister() {
    if (!address || !lastProof) return;
    setNullifierMsg("Reenviando la misma prueba…");
    try {
      await verifyAndRegister(address, lastProof);
      setNullifierMsg("(inesperado) se registró de nuevo.");
    } catch (e) {
      setNullifierMsg(
        e instanceof ContractError && e.code === 3
          ? "✅ Rechazado on-chain: " + e.message
          : "Error: " + (e as Error).message,
      );
    }
  }

  if (step === "connect")
    return (
      <section className="app__card">
        <h2>Conectá tu wallet</h2>
        <p>Tu identidad verificada quedará registrada en Stellar (testnet) bajo esta dirección.</p>
        {!CONTRACT_ID && (
          <p style={{ color: "#c5221f" }}>
            ⚠️ Falta <code>VITE_KYC_VERIFIER_CONTRACT_ID</code> en el entorno del frontend.
          </p>
        )}
        <button type="button" onClick={onConnect}>Conectar wallet</button>
      </section>
    );

  if (step === "consent") return <Consent onAccept={() => setStep("document")} />;
  if (step === "document") return <DocumentUpload onNext={(d) => { setDoc(d); setStep("attributes"); }} />;
  if (step === "attributes") return <Attributes onNext={(a) => { setAttrs(a); setStep("scan"); }} />;
  if (step === "scan") return <FaceScan onCaptured={process} />;

  if (step === "processing")
    return (
      <section className="app__card">
        <h2>Procesando…</h2>
        <p>{msg}</p>
        <p style={{ fontSize: "0.85em", opacity: 0.7 }}>Puede pedirte firmar en la wallet.</p>
      </section>
    );

  if (step === "error")
    return (
      <section className="app__card">
        <h2>❌ No verificado</h2>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
      </section>
    );

  // done
  return (
    <section className="app__card">
      <h2>{verified ? "✅ Identidad verificada on-chain" : "Registrado (verificando…)"}</h2>
      <p>
        <code>is_verified({address?.slice(0, 4)}…{address?.slice(-4)})</code> ={" "}
        <strong>{String(verified)}</strong>
      </p>
      {txHash && (
        <p>
          tx:{" "}
          <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer">
            {txHash.slice(0, 10)}…
          </a>
        </p>
      )}
      <hr />
      <p style={{ fontSize: "0.9em" }}>
        Anti-Sybil: el mismo documento es rechazado por el issuer (de-dup), y la misma persona
        es rechazada on-chain por el nullifier.
      </p>
      <button type="button" onClick={retryRegister}>Probar candado de nullifier (reenviar prueba)</button>
      {nullifierMsg && <p>{nullifierMsg}</p>}
    </section>
  );
}
