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
  already_enrolled: "This document was already validated (anti-Sybil). Cannot create another identity.",
  face_mismatch: "Face does not match the document.",
  no_liveness_motion: "No liveness detected (blink/head turn).",
  not_an_id_document: "Image is not an identity document.",
  no_face_in_document: "No face detected on the document.",
  no_face_in_selfie: "No face detected in the scan.",
  data_mismatch: "Declared data does not match the ID.",
  document_unreadable: "Could not read document (upload a sharper photo).",
};

const DATA_REASON: Record<string, string> = {
  doc_number: "document number",
  birth_year: "year of birth",
  country: "country",
  document_unreadable: "document could not be read",
  not_an_id_document: "does not look like an identity document",
  no_face_in_document: "no face on document",
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
    setMsg("Matching your details with the ID…");
    try {
      const r = await verifyDocumentData(doc, a);
      if (r.ok) return setStep("scan");
      const why = (r.mismatches.length ? r.mismatches : r.reasons).map((x) => DATA_REASON[x] ?? x).join(", ");
      setDoc(null);
      setBounce(`ID does not match your details (${why}). Upload a valid document with matching data.`);
      setStep("document");
    } catch (e) {
      fail("Could not match document: " + (e as Error).message);
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
      fail("Could not connect wallet: " + (e as Error).message);
    }
  }

  /** Enroll + prueba ZK + registro on-chain (wallet externa o Pollar custodial). */
  async function runOnChainRegistration(
    frames: Blob[],
    signerAddress: string,
  ): Promise<void> {
    if (!doc || !attrs) return fail("Missing flow data.");
    setStep("processing");

    try {
      let cred: StoredCredential | null = await loadCredentialAsync(attrs.docId);
      if (cred) {
        setMsg("Recovering credential saved on this device…");
      } else {
        setMsg("Generating your secret and identity (on device)…");
        const secret = randomSecret();
        const commitment = await computeCommitment(attrs, secret);

        setMsg("Validating document + face and enrolling with issuer…");
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
                "This document already passed biometric validation in a previous attempt, " +
                  "but on-chain registration did not finish and we could not find your credential in this browser. " +
                  "Locally: stop the issuer and run `rm identity/issuer/.issuer-state.json`, " +
                  "then restart the matcher. You can also try another tab if you did not close the previous one.",
              );
            }
            setMsg("Recovering credential from a previous attempt…");
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

      if (!cred) return fail("Could not obtain identity credential.");

      setMsg("Generating ZK proof on your device (PII stays local)…");
      const gen = await generateProof(
        cred.attributes,
        cred.secret,
        cred.pathElements,
        cred.pathIndices,
        signerAddress,
      );
      setLastProof(gen);

      setMsg("Initializing on-chain registration if needed…");
      await initIfNeeded(signerAddress, cred.issuerRoot);

      setMsg("Registering on Stellar…");
      let hash: string;
      try {
        hash = await verifyAndRegister(signerAddress, gen);
      } catch (e) {
        if (e instanceof ContractError && e.code === 3) {
          return fail("This human already has an identity (on-chain nullifier rejection).");
        }
        throw e;
      }
      setTxHash(hash);
      saveRegistrationAddress(signerAddress);

      setMsg("Confirming on-chain…");
      const onChain = await isVerified(signerAddress);
      setVerified(onChain);
      if (!onChain) {
        return fail("On-chain registration was not confirmed. Retry or contact support.");
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
        "On-chain registration requires Pollar. Connect an external wallet at /login.",
      );
    }
    if (!pollar.verified || !pollar.isAuthenticated) {
      return fail("Your Pollar session is not confirmed. Sign in again with email.");
    }
    const pollarAddr = pollar.walletAddress?.trim();
    if (!pollarAddr) {
      return fail(
        "Your Pollar wallet is not ready yet. Wait until it is created or reconnect.",
      );
    }
    if (!pollar.signTx) {
      return fail(
        "Pollar does not expose transaction signing in this version. Use “Connect my wallet” for on-chain registration.",
      );
    }
    await ensureFunded(pollarAddr).catch(() => {});
    setAddress(pollarAddr);
    await runOnChainRegistration(frames, pollarAddr);
  }

  async function process(frames: Blob[]) {
    if (mode === "credential") return processCredentialWithPollar(frames);
    if (!address) return fail("Missing flow data.");
    await runOnChainRegistration(frames, address);
  }

  async function retryRegister() {
    if (!address || !lastProof) return;
    setNullifierMsg("Resubmitting the same proof…");
    try {
      await verifyAndRegister(address, lastProof);
      setNullifierMsg("(unexpected) registered again.");
    } catch (e) {
      setNullifierMsg(
        e instanceof ContractError && e.code === 3
          ? "✅ Rejected on-chain: " + e.message
          : "Error: " + (e as Error).message,
      );
    }
  }

  if (step === "connect")
    return (
      <section className="bh-card">
        <p className="bh-eyebrow">Identity verification</p>
        <h2 className="bh-h2">Connect your wallet</h2>
        <p className="bh-sub">
          You will verify you are a real, unique person. Your identity is registered anonymously;
          we never publish your personal data.
        </p>
        {!CONTRACT_ID && (
          <p className="bh-note bh-note--err">⚠️ Verifier contract is not configured.</p>
        )}
        <div className="bh-actions">
          <Button onClick={onConnect}>Connect wallet</Button>
        </div>
      </section>
    );

  if (step === "checking")
    return (
      <section className="bh-card">
        <h2 className="bh-h2">One moment…</h2>
        <p className="bh-sub">Checking whether this wallet already has a verified identity.</p>
      </section>
    );

  if (step === "already")
    return (
      <section className="bh-card">
        <h2 className="bh-h2">✅ Already verified</h2>
        <p className="bh-sub">
          This wallet <strong>already has a verified identity</strong>. No need to validate again:
          one person, one identity.
        </p>
        <div className="bh-actions">
          {onDone ? (
            <Button onClick={onDone}>Enter the app</Button>
          ) : (
            <Button onClick={() => window.location.reload()}>Back to home</Button>
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
        <h2 className="bh-h2">Processing…</h2>
        <p className="bh-sub">{msg}</p>
        <p className="bh-note">You may need to confirm the transaction in your wallet.</p>
      </section>
    );

  if (step === "error")
    return (
      <section className="bh-card">
        <h2 className="bh-h2">We could not verify you</h2>
        <p className="bh-sub">{error}</p>
        <div className="bh-actions">
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </section>
    );

  return (
    <section className="bh-card">
      <p className="bh-eyebrow">Done</p>
      <h2 className="bh-h2">{verified ? "✅ You are a verified human" : "Registered (confirming…)"}</h2>
      <p className="bh-sub">
        Your identity was verified anonymously. You can participate without revealing who you are.
      </p>
      {txHash && (
        <p className="bh-note">
          <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="bh-back">
            View on-chain receipt
          </a>
        </p>
      )}
      <div className="bh-actions">
        {onDone && verified && <Button onClick={onDone}>Enter the app</Button>}
        {mode === "wallet" && lastProof && (
          <Button variant="ghost" onClick={retryRegister}>
            Test anti-duplicate lock
          </Button>
        )}
      </div>
      {nullifierMsg && <p className="bh-note">{nullifierMsg}</p>}
    </section>
  );
}
