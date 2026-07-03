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
import { useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import { Button } from "../components/ui/Button";
import { Consent } from "./Consent";
import { DocumentUpload } from "./DocumentUpload";
import { Attributes, type AttributesInput } from "./Attributes";
import { FaceScan } from "./FaceScan";
import { connectWallet, ensureFunded } from "./wallet";
import { enroll, verifyDocumentData } from "./api";
import { computeCommitment, generateProof, randomSecret, type GeneratedProof } from "./zk";
import { initIfNeeded, isVerified, verifyAndRegister, ContractError, setTransactionSigner } from "./chain";
import { CONTRACT_ID } from "./stellar";
import { loadCredentialAsync, saveCredential, type StoredCredential } from "./credentialStore";
import { createPollarSigner } from "./pollarSigner";
import { saveRegistrationAddress } from "./registrationStore";
import { POLLAR_ENABLED } from "../identity/pollar";

type Step = "connect" | "checking" | "already" | "consent" | "document" | "attributes" | "scan" | "processing" | "done" | "error";

const REASON: Record<string, string> = {
  already_enrolled: "Este documento ya fue validado (anti-Sybil). No puede crear otra identidad.",
  face_mismatch: "La cara no coincide con la del documento.",
  no_liveness_motion: "No se detectó vivacidad (parpadeo/giro).",
  not_an_id_document: "La imagen no es un documento de identidad.",
  no_face_in_document: "No se detecta cara en el documento.",
  no_face_in_selfie: "No se detecta tu cara en el escaneo.",
  data_mismatch: "Los datos declarados no coinciden con el DNI.",
  document_unreadable: "No se pudo leer el documento (subí una foto más nítida).",
};

const DATA_REASON: Record<string, string> = {
  doc_number: "el número de documento",
  birth_year: "el año de nacimiento",
  country: "el país",
  document_unreadable: "no se pudo leer el documento",
  not_an_id_document: "no parece un documento de identidad",
  no_face_in_document: "no se detecta la cara en el documento",
};

export function KycFlow(props: { onDone?: () => void; mode?: "wallet" | "credential" } = {}) {
  if (props.mode === "credential" && POLLAR_ENABLED) {
    return <KycFlowPollar {...props} mode="credential" />;
  }
  return <KycFlowWallet {...props} mode={props.mode ?? "wallet"} />;
}

function KycFlowPollar(props: { onDone?: () => void; mode: "credential" }) {
  const pollar = usePollar();
  return <KycFlowCore {...props} pollar={pollar} />;
}

function KycFlowWallet(props: { onDone?: () => void; mode: "wallet" | "credential" }) {
  return <KycFlowCore {...props} pollar={null} />;
}

function KycFlowCore({
  onDone,
  mode,
  pollar,
}: {
  onDone?: () => void;
  mode: "wallet" | "credential";
  pollar: ReturnType<typeof usePollar> | null;
}) {
  const [step, setStep] = useState<Step>(mode === "credential" ? "consent" : "connect");
  const [address, setAddress] = useState<string | null>(null);
  const [doc, setDoc] = useState<Blob | null>(null);
  const [attrs, setAttrs] = useState<AttributesInput | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [lastProof, setLastProof] = useState<GeneratedProof | null>(null);
  const [nullifierMsg, setNullifierMsg] = useState<string | null>(null);
  const [bounce, setBounce] = useState<string | null>(null);

  // SECURITY: modo Pollar usa signTx de la wallet custodial para verify_and_register on-chain.
  useEffect(() => {
    if (!pollar?.signTx) return;
    setTransactionSigner(createPollarSigner(pollar.signTx));
    return () => setTransactionSigner(null);
  }, [pollar?.signTx]);

  function fail(m: string) {
    setError(m);
    setStep("error");
  }

  async function onAttributes(a: AttributesInput) {
    setAttrs(a);
    if (!doc) return setStep("document");
    setStep("processing");
    setMsg("Cotejando tus datos con el DNI…");
    try {
      const r = await verifyDocumentData(doc, a);
      if (r.ok) return setStep("scan");
      const why = (r.mismatches.length ? r.mismatches : r.reasons).map((x) => DATA_REASON[x] ?? x).join(", ");
      setDoc(null);
      setBounce(`El DNI no coincide con tus datos (${why}). Subí un documento válido cuyos datos coincidan.`);
      setStep("document");
    } catch (e) {
      fail("No se pudo cotejar el documento: " + (e as Error).message);
    }
  }

  async function onConnect() {
    try {
      const addr = await connectWallet();
      setAddress(addr);
      saveRegistrationAddress(addr);
      setStep("checking");
      await ensureFunded(addr).catch(() => {});
      let already = false;
      try {
        already = await isVerified(addr);
      } catch {
        already = false;
      }
      setStep(already ? "already" : "consent");
    } catch (e) {
      fail("No se pudo conectar la wallet: " + (e as Error).message);
    }
  }

  /** Enroll + prueba ZK + registro on-chain (wallet externa o Pollar custodial). */
  async function runOnChainRegistration(
    frames: Blob[],
    signerAddress: string,
  ): Promise<void> {
    if (!doc || !attrs) return fail("Faltan datos del flujo.");
    setStep("processing");

    try {
      let cred: StoredCredential | null = await loadCredentialAsync(attrs.docId);
      if (cred) {
        setMsg("Recuperando tu credencial guardada en este dispositivo…");
      } else {
        setMsg("Generando tu secreto e identidad (en el dispositivo)…");
        const secret = randomSecret();
        const commitment = await computeCommitment(attrs, secret);

        setMsg("Validando documento + cara y registrando en el issuer…");
        const en = await enroll(doc, frames, commitment, {
          docId: attrs.docId,
          birthYear: attrs.birthYear,
          countryCode: attrs.countryCode,
        });
        if (!en.ok) {
          if (en.reasons.includes("already_enrolled")) {
            // El issuer recuerda el doc (enroll previo pasó el gate) pero la credencial local
            // puede estar cifrada o en otra pestaña — reintentar lectura async antes de fallar.
            cred = await loadCredentialAsync(attrs.docId);
            if (!cred) {
              return fail(
                "Este documento ya pasó la validación biométrica en un intento anterior, " +
                  "pero el registro on-chain no terminó y no encontramos tu credencial en este navegador. " +
                  "En local: pará el issuer y ejecutá `rm identity/issuer/.issuer-state.json`, " +
                  "luego reiniciá el matcher. También podés probar otra pestaña si no cerraste la anterior.",
              );
            }
            setMsg("Recuperando credencial de un intento anterior…");
          } else {
            return fail(en.reasons.map((r) => REASON[r] ?? r).join(" "));
          }
        } else {
          cred = {
            attributes: attrs,
            secret,
            issuerRoot: en.issuerRoot!,
            pathElements: en.pathElements!,
            pathIndices: en.pathIndices!,
          };
          saveCredential(attrs.docId, cred);
        }
      }

      if (!cred) return fail("No se pudo obtener la credencial de identidad.");

      setMsg("Generando la prueba ZK en tu dispositivo (la PII no sale)…");
      const gen = await generateProof(
        cred.attributes,
        cred.secret,
        cred.pathElements,
        cred.pathIndices,
        signerAddress,
      );
      setLastProof(gen);

      setMsg("Inicializando el registro on-chain si hace falta…");
      await initIfNeeded(signerAddress, cred.issuerRoot);

      setMsg("Registrando en Stellar…");
      let hash: string;
      try {
        hash = await verifyAndRegister(signerAddress, gen);
      } catch (e) {
        if (e instanceof ContractError && e.code === 3) {
          return fail("Este humano ya tiene identidad (rechazo on-chain por nullifier).");
        }
        throw e;
      }
      setTxHash(hash);
      saveRegistrationAddress(signerAddress);

      setMsg("Confirmando on-chain…");
      const onChain = await isVerified(signerAddress);
      setVerified(onChain);
      if (!onChain) {
        return fail("El registro on-chain no se confirmó. Reintentá o contactá soporte.");
      }
      setStep("done");
    } catch (e) {
      fail((e as Error).message);
    }
  }

  async function processCredentialWithPollar(frames: Blob[]) {
    // SECURITY: Pollar expone walletAddress + signTx (custodial server-side). Sin esto,
    // bloqueamos Capa 2 — no marcamos verified=true solo con credencial local.
    if (!POLLAR_ENABLED || !pollar) {
      return fail(
        "El registro on-chain requiere Pollar configurado. Conectá una wallet externa en /login.",
      );
    }
    if (!pollar.verified || !pollar.isAuthenticated) {
      return fail("Tu sesión de Pollar no está confirmada. Volvé a iniciar sesión con email.");
    }
    const pollarAddr = pollar.walletAddress?.trim();
    if (!pollarAddr) {
      return fail(
        "Tu wallet de Pollar aún no está lista. Esperá a que termine de crearse o reconectá.",
      );
    }
    if (!pollar.signTx) {
      return fail(
        "Pollar no expone firma de transacciones en esta versión. Usá “Conectar mi wallet” para registrarte on-chain.",
      );
    }
    await ensureFunded(pollarAddr).catch(() => {});
    setAddress(pollarAddr);
    await runOnChainRegistration(frames, pollarAddr);
  }

  async function process(frames: Blob[]) {
    if (mode === "credential") return processCredentialWithPollar(frames);
    if (!address) return fail("Faltan datos del flujo.");
    await runOnChainRegistration(frames, address);
  }

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
      <section className="bh-card">
        <p className="bh-eyebrow">Verificación de identidad</p>
        <h2 className="bh-h2">Conectá tu wallet</h2>
        <p className="bh-sub">
          Vas a verificar que sos una persona real y única. Tu identidad queda registrada de
          forma anónima; nunca publicamos tus datos.
        </p>
        {!CONTRACT_ID && (
          <p className="bh-note bh-note--err">⚠️ Falta configurar el contrato verificador.</p>
        )}
        <div className="bh-actions">
          <Button onClick={onConnect}>Conectar wallet</Button>
        </div>
      </section>
    );

  if (step === "checking")
    return (
      <section className="bh-card">
        <h2 className="bh-h2">Un segundo…</h2>
        <p className="bh-sub">Comprobando si esta wallet ya tiene una identidad verificada.</p>
      </section>
    );

  if (step === "already")
    return (
      <section className="bh-card">
        <h2 className="bh-h2">✅ Ya estás verificado</h2>
        <p className="bh-sub">
          Esta wallet <strong>ya tiene una identidad verificada</strong>. No hace falta validar
          de nuevo: cada persona tiene una sola identidad.
        </p>
        <div className="bh-actions">
          {onDone ? (
            <Button onClick={onDone}>Entrar a la app</Button>
          ) : (
            <Button onClick={() => window.location.reload()}>Volver al inicio</Button>
          )}
        </div>
      </section>
    );

  if (step === "consent") return <Consent onAccept={() => setStep("document")} />;
  if (step === "document")
    return (
      <DocumentUpload
        notice={bounce}
        onNext={(d) => { setDoc(d); setBounce(null); setStep("attributes"); }}
      />
    );
  if (step === "attributes") return <Attributes onNext={onAttributes} />;
  if (step === "scan") return <FaceScan onCaptured={process} />;

  if (step === "processing")
    return (
      <section className="bh-card">
        <h2 className="bh-h2">Procesando…</h2>
        <p className="bh-sub">{msg}</p>
        <p className="bh-note">Puede pedirte confirmar la transacción en tu wallet.</p>
      </section>
    );

  if (step === "error")
    return (
      <section className="bh-card">
        <h2 className="bh-h2">No pudimos verificarte</h2>
        <p className="bh-sub">{error}</p>
        <div className="bh-actions">
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
        </div>
      </section>
    );

  return (
    <section className="bh-card">
      <p className="bh-eyebrow">Listo</p>
      <h2 className="bh-h2">{verified ? "✅ Sos un humano verificado" : "Registrado (confirmando…)"}</h2>
      <p className="bh-sub">
        Tu identidad quedó verificada de forma anónima. Ya podés participar sin revelar quién sos.
      </p>
      {txHash && (
        <p className="bh-note">
          <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="bh-back">
            Ver el comprobante on-chain
          </a>
        </p>
      )}
      <div className="bh-actions">
        {onDone && verified && <Button onClick={onDone}>Entrar a la app</Button>}
        {mode === "wallet" && lastProof && (
          <Button variant="ghost" onClick={retryRegister}>
            Probar el candado anti-duplicados
          </Button>
        )}
      </div>
      {nullifierMsg && <p className="bh-note">{nullifierMsg}</p>}
    </section>
  );
}
