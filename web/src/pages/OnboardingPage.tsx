// Onboarding de identidad (Capa 1): corre el flujo KYC-ZK real (wallet → DNI + cotejo
// anti-fraude → cara → prueba ZK → registro on-chain). Reutiliza el componente KycFlow de
// la lógica de main; al terminar, "Ir a la app" entra al feed con la identidad ya derivada.
import { Link, useNavigate } from "react-router-dom";
import { KycFlow } from "../kyc/KycFlow";
import "../kyc/legacy.css";

export function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <main className="app">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Link to="/" style={{ color: "#38bdf8" }}>
          ← Inicio
        </Link>
        <button type="button" onClick={() => navigate("/app")}>
          Ir a la app →
        </button>
      </div>
      <KycFlow />
    </main>
  );
}
