// Layer 1 identity onboarding: full KYC-ZK flow (wallet → ID + anti-fraud check → face → ZK proof → on-chain).
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { brand } from "../content/brand";
import { clearLoggedOut } from "../feed/session";
import { KycFlow } from "../kyc/KycFlow";
import "../styles/tokens.css";
import "../styles/global.css";
import "../styles/behuman-ui.css";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("via") === "email" ? "credential" : "wallet";
  return (
    <main className="bh">
      <div className="bh-shell">
        <div className="bh-topbar">
          <Link to="/" className="bh-back">← Home</Link>
          <img src={brand.logoHorizontal} alt={brand.wordmark} style={{ height: 40 }} />
        </div>
        {mode === "credential" && (
          <p className="bh-note" style={{ marginBottom: "0.75rem" }}>
            Your email created a Pollar wallet. After identity validation we register the ZK proof
            on-chain with that wallet (your anonymous identity is never linked to the email).
          </p>
        )}
        <KycFlow
          mode={mode}
          onDone={() => {
            clearLoggedOut();
            navigate("/app");
          }}
        />
      </div>
    </main>
  );
}
