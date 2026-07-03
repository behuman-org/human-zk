// Onboarding de identidad (Capa 1): corre el flujo KYC-ZK real (wallet → DNI + cotejo
// anti-fraude → cara → prueba ZK → registro on-chain) con el diseño del producto.
// Al terminar, "Entrar a la app" entra al feed con la identidad ya derivada.
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
  // ?via=email → llega desde Pollar (wallet ya creada por email): solo crea la credencial ZK,
  // sin conectar wallet ni registrar on-chain. La identidad anónima no depende de Pollar.
  const mode = params.get("via") === "email" ? "credential" : "wallet";
  return (
    <main className="bh">
      <div className="bh-shell">
        <div className="bh-topbar">
          <Link to="/" className="bh-back">← Inicio</Link>
          <img src={brand.logoHorizontal} alt={brand.wordmark} style={{ height: 40 }} />
        </div>
        {mode === "credential" && (
          <p className="bh-note" style={{ marginBottom: "0.75rem" }}>
            Tu email creó tu wallet con Pollar. Tras validar tu identidad, registramos la prueba ZK
            on-chain con esa wallet (sin vincular tu identidad anónima al email).
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
