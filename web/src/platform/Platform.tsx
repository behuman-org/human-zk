// CAPA 2 — Plataforma de opinión (anónima por ZK).
// Identidad = platformId (derivado del secret de Capa 1). NUNCA usa la wallet/address del KYC.
// El fee on-chain lo paga una cuenta efímera fondeada por friendbot.
import { useEffect, useState } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { loadAnyCredential, type StoredCredential } from "../kyc/credentialStore";
import { contentHashField, generatePlatformProof, handleOf, platformIdHex } from "./zk2";
import { createFundedEphemeral } from "./ephemeral";
import { ContractError, initIfNeeded, postTweet, registerIdentity } from "./chain2";
import { getFeed, postContent, setProfile, type FeedItem } from "./api2";
import { OPINION_BOARD_CONTRACT_ID } from "./stellar2";

const DEFAULT_TWEET =
  "Para mí el asado argentino es lo máximo: bife de chorizo, achuras y un buen Malbec. 🇦🇷🥩";

const txUrl = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

export function Platform({ onBack }: { onBack: () => void }) {
  const [cred] = useState<StoredCredential | null>(() => loadAnyCredential());
  const [platformId, setPlatformId] = useState<string | null>(null); // hex
  const [registered, setRegistered] = useState(false);
  const [username, setUsername] = useState("");
  const [tweet, setTweet] = useState(DEFAULT_TWEET);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [eph, setEph] = useState<StellarSdk.Keypair | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  useEffect(() => {
    getFeed().then(setFeed).catch(() => {});
  }, []);

  async function ephemeral(): Promise<StellarSdk.Keypair> {
    if (eph) return eph;
    const kp = await createFundedEphemeral();
    setEph(kp);
    return kp;
  }

  async function createIdentity() {
    if (!cred) return;
    setError(null);
    try {
      setBusy("Generando prueba de pertenencia (ZK) en tu dispositivo…");
      const p = await generatePlatformProof(cred, "0");
      const pid = platformIdHex(p.publicSignals[1]);
      setPlatformId(pid);
      setBusy("Fondeando cuenta efímera (NO es la wallet del KYC)…");
      const kp = await ephemeral();
      setBusy("Inicializando la plataforma on-chain si hace falta…");
      await initIfNeeded(kp, p.publicSignals[0]);
      setBusy("Registrando tu identidad anónima on-chain…");
      try {
        await registerIdentity(kp, p);
      } catch (e) {
        if (!(e instanceof ContractError && e.code === 3)) throw e; // 3 = ya registrada
      }
      setRegistered(true);
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function publish() {
    if (!cred || !platformId) return;
    setError(null);
    try {
      setBusy("Calculando contentHash y generando prueba ZK del post…");
      const ch = await contentHashField(tweet);
      const p = await generatePlatformProof(cred, ch);
      setBusy("Anclando on-chain con la cuenta efímera…");
      const kp = await ephemeral();
      const txHash = await postTweet(kp, p);
      setLastTx(txHash);
      setBusy("Guardando contenido off-chain…");
      if (username) await setProfile(platformId, username);
      await postContent(platformId, tweet, ch, txHash);
      setFeed(await getFeed());
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  if (!cred) {
    return (
      <section className="app__card">
        <h2>Plataforma de opinión</h2>
        <p>Para participar necesitás una identidad verificada (Capa 1) en este dispositivo.</p>
        <p>Validate primero en “Validar mi identidad”.</p>
        <button type="button" onClick={onBack}>Volver</button>
      </section>
    );
  }

  const handle = platformId ? handleOf(platformId) : "";

  return (
    <section className="app__card">
      <h2>Plataforma de opinión (anónima)</h2>
      {!OPINION_BOARD_CONTRACT_ID && (
        <p style={{ color: "#c5221f" }}>⚠️ Falta <code>VITE_OPINION_BOARD_CONTRACT_ID</code>.</p>
      )}

      {!registered ? (
        <>
          <p>
            Tu identidad de plataforma es <strong>anónima</strong>: se deriva de tu secreto de
            Capa 1 (<code>platformId = Poseidon(secret, scope)</code>). No usa tu wallet ni tu
            address del KYC. Es imposible linkearla a tu identidad real.
          </p>
          <button type="button" onClick={createIdentity} disabled={!!busy}>
            Crear mi identidad anónima
          </button>
        </>
      ) : (
        <>
          <p>
            Tu seudónimo (handle): <strong>@{handle}</strong>
            <br />
            <code style={{ wordBreak: "break-all", fontSize: "0.8em" }}>{platformId}</code>
          </p>
          <label style={{ display: "block", margin: "8px 0" }}>
            Username (libre)
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ej. che_opinador" />
          </label>
          <label style={{ display: "block", margin: "8px 0" }}>
            Tu opinión
            <textarea value={tweet} onChange={(e) => setTweet(e.target.value)} rows={3} style={{ width: "100%" }} />
          </label>
          <button type="button" onClick={publish} disabled={!!busy || !tweet.trim()}>
            Publicar (gateado por prueba ZK)
          </button>
        </>
      )}

      {busy && <p>⏳ {busy}</p>}
      {error && <p style={{ color: "#c5221f" }}>Error: {error}</p>}
      {lastTx && (
        <p style={{ color: "#137333" }}>
          ✅ Publicado y anclado on-chain.{" "}
          <a href={txUrl(lastTx)} target="_blank" rel="noreferrer">Ver la transacción</a>
          <br />
          <span style={{ fontSize: "0.85em", opacity: 0.8 }}>
            Firmada por una cuenta efímera (no tu wallet del KYC): es anónima.
          </span>
        </p>
      )}

      <hr />
      <h3>Feed</h3>
      {feed.length === 0 && <p>Todavía no hay posts.</p>}
      {feed.map((f, i) => (
        <div key={i} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
          <strong>{f.username || "anónimo"}</strong>{" "}
          <span style={{ opacity: 0.6 }}>@{f.handle}</span>{" "}
          {f.curation?.status === "flagged" && (
            <span title={f.curation.reason} style={{ fontSize: "0.75em", color: "#b06000" }}>
              ⚠️ etiquetado
            </span>
          )}
          {f.curation?.status === "approved" && (
            <span style={{ fontSize: "0.75em", color: "#137333" }}>✓ curado</span>
          )}
          <p style={{ margin: "4px 0" }}>{f.content}</p>
          {f.txHash && (
            <a href={txUrl(f.txHash)} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em" }}>
              🔗 tx on-chain (anónima)
            </a>
          )}
        </div>
      ))}

      <button type="button" onClick={onBack} style={{ marginTop: 12 }}>Volver</button>
    </section>
  );
}
