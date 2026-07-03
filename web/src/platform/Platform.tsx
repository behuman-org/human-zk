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
  "For me, a proper weekend means good food, honest conversation, and time offline.";

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
      setBusy("Generating membership proof (ZK) on your device…");
      const p = await generatePlatformProof(cred, "0");
      const pid = platformIdHex(p.publicSignals[1]);
      setPlatformId(pid);
      setBusy("Funding ephemeral account (NOT the KYC wallet)…");
      const kp = await ephemeral();
      setBusy("Initializing platform on-chain if needed…");
      await initIfNeeded(kp, p.publicSignals[0]);
      setBusy("Registering your anonymous identity on-chain…");
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
      setBusy("Computing contentHash and generating post ZK proof…");
      const ch = await contentHashField(tweet);
      const p = await generatePlatformProof(cred, ch);
      setBusy("Anchoring on-chain with ephemeral account…");
      const kp = await ephemeral();
      const txHash = await postTweet(kp, p);
      setLastTx(txHash);
      setBusy("Saving content off-chain…");
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
        <h2>Opinion platform</h2>
        <p>You need a verified identity (Layer 1) on this device to participate.</p>
        <p>Verify first via “Start verification”.</p>
        <button type="button" onClick={onBack}>Back</button>
      </section>
    );
  }

  const handle = platformId ? handleOf(platformId) : "";

  return (
    <section className="app__card">
      <h2>Anonymous opinion platform</h2>
      {!OPINION_BOARD_CONTRACT_ID && (
        <p style={{ color: "#c5221f" }}>⚠️ Missing <code>VITE_OPINION_BOARD_CONTRACT_ID</code>.</p>
      )}

      {!registered ? (
        <>
          <p>
            Your platform identity is <strong>anonymous</strong>: derived from your Layer 1 secret
            (<code>platformId = Poseidon(secret, scope)</code>). It does not use your wallet or KYC
            address. It cannot be linked to your real identity.
          </p>
          <button type="button" onClick={createIdentity} disabled={!!busy}>
            Create my anonymous identity
          </button>
        </>
      ) : (
        <>
          <p>
            Your pseudonym (handle): <strong>@{handle}</strong>
            <br />
            <code style={{ wordBreak: "break-all", fontSize: "0.8em" }}>{platformId}</code>
          </p>
          <label style={{ display: "block", margin: "8px 0" }}>
            Username (libre)
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. thoughtful_voice" />
          </label>
          <label style={{ display: "block", margin: "8px 0" }}>
            Your opinion
            <textarea value={tweet} onChange={(e) => setTweet(e.target.value)} rows={3} style={{ width: "100%" }} />
          </label>
          <button type="button" onClick={publish} disabled={!!busy || !tweet.trim()}>
            Publish (ZK-gated)
          </button>
        </>
      )}

      {busy && <p>⏳ {busy}</p>}
      {error && <p style={{ color: "#c5221f" }}>Error: {error}</p>}
      {lastTx && (
        <p style={{ color: "#137333" }}>
          ✅ Published and anchored on-chain.{" "}
          <a href={txUrl(lastTx)} target="_blank" rel="noreferrer">View transaction</a>
          <br />
          <span style={{ fontSize: "0.85em", opacity: 0.8 }}>
            Signed by an ephemeral account (not your KYC wallet): anonymous.
          </span>
        </p>
      )}

      <hr />
      <h3>Feed</h3>
      {feed.length === 0 && <p>No posts yet.</p>}
      {feed.map((f, i) => (
        <div key={i} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
          <strong>{f.username || "anonymous"}</strong>{" "}
          <span style={{ opacity: 0.6 }}>@{f.handle}</span>{" "}
          {f.curation?.status === "flagged" && (
            <span title={f.curation.reason} style={{ fontSize: "0.75em", color: "#b06000" }}>
              ⚠️ flagged
            </span>
          )}
          {f.curation?.status === "approved" && (
            <span style={{ fontSize: "0.75em", color: "#137333" }}>✓ curated</span>
          )}
          <p style={{ margin: "4px 0" }}>{f.content}</p>
          {f.txHash && (
            <a href={txUrl(f.txHash)} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em" }}>
              🔗 on-chain tx (anonymous)
            </a>
          )}
        </div>
      ))}

      <button type="button" onClick={onBack} style={{ marginTop: 12 }}>Back</button>
    </section>
  );
}
