// Informed consent screen — must appear BEFORE capturing ID/biometry.
import { Button } from "../components/ui/Button";

export function Consent({ onAccept }: { onAccept: () => void }) {
  return (
    <section className="bh-card">
      <p className="bh-eyebrow">Privacy first</p>
      <h2 className="bh-h2">Before you start</h2>
      <p className="bh-p">
        To verify you are a real, unique person we will ask for a{" "}
        <strong>photo of your ID</strong> and a <strong>live face scan</strong> with your camera.
      </p>
      <ul className="bh-list">
        <li>Images are processed <strong>in the moment</strong> and are not stored.</li>
        <li>
          <strong>None of your data</strong> (face, document, name) goes on-chain — only an
          anonymous cryptographic proof is registered.
        </li>
        <li>You may exercise access and deletion rights under applicable privacy law.</li>
      </ul>
      <p className="bh-note bh-note--warn">
        ⚠️ Testnet demo: biometric verification uses a test matcher (not regulated KYC).
      </p>
      <div className="bh-actions">
        <Button onClick={onAccept}>I agree and continue</Button>
      </div>
    </section>
  );
}
