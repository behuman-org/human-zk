import { useState } from "react";
import "./App.css";
import { KycFlow } from "./kyc/KycFlow";
import { Status } from "./kyc/Status";
import { Platform } from "./platform/Platform";

// beHuman — Frontend. Capa 1: validar identidad (DNI + cara → ZK → on-chain) y ver el
// estado por wallet. 📐 `Flujo de KYC` · `Spec — Matcher DNI + Selfie` en la vault.

type Mode = "home" | "validate" | "status" | "platform";

function App() {
  const [mode, setMode] = useState<Mode>("home");

  return (
    <main className="app">
      <header className="app__header">
        <h1>beHuman</h1>
        <p className="app__tagline">
          Probá que sos una persona <strong>real y única</strong> sin revelar quién sos
        </p>
      </header>

      {mode === "home" && (
        <section className="app__card">
          <p>Verificá tu identidad una vez; después entrás con tu wallet.</p>
          <button type="button" onClick={() => setMode("validate")}>
            Validar mi identidad
          </button>
          <button type="button" onClick={() => setMode("status")} style={{ marginTop: 8 }}>
            Ya me validé · ver mi estado (con mi wallet)
          </button>
          <button type="button" onClick={() => setMode("platform")} style={{ marginTop: 8 }}>
            Plataforma de opinión (anónima)
          </button>
        </section>
      )}

      {mode === "validate" && <KycFlow />}
      {mode === "status" && <Status onBack={() => setMode("home")} />}
      {mode === "platform" && <Platform onBack={() => setMode("home")} />}

      <footer className="app__footer">
        demo testnet · el matcher es de prueba (no RENAPER) · cero PII on-chain
      </footer>
    </main>
  );
}

export default App;
