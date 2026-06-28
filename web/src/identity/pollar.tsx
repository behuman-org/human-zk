// Integración de Pollar SOLO como onboarding amigable: crear una wallet Stellar con email.
//
// ⚠️ Pollar (login email) es CUSTODIAL: genera/guarda la clave en su server. Por eso NUNCA
// firma nada de beHuman ni participa del anonimato. Acá lo usamos exclusivamente para que un
// usuario sin wallet cree una cuenta de forma fácil. El anonimato ZK no depende de Pollar:
//   - el `secret` (raíz del anonimato) se genera/guarda SOLO client-side (credentialStore),
//   - `platformId = Poseidon(secret, scope)` se deriva en el navegador,
//   - las acciones anónimas usan wallets EFÍMERAS (friendbot), nunca la wallet de Pollar,
//   - el email vive solo en Pollar; beHuman no lo guarda ni lo mapea a platformId.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PollarProvider, usePollar } from "@pollar/react";
import "@pollar/react/styles.css";
import { Button } from "../components/ui/Button";

const POLLAR_KEY = import.meta.env.VITE_POLLAR_PUBLISHABLE_KEY ?? "";
/** Pollar disponible solo si hay key configurada (testnet por prefijo de la key). */
export const POLLAR_ENABLED = POLLAR_KEY.length > 0;

/** Monta el PollarProvider solo si está configurado; si no, no envuelve nada. */
export function PollarRoot({ children }: { children: ReactNode }) {
  if (!POLLAR_ENABLED) return <>{children}</>;
  // O2: sin override de appConfig → el modal refleja los métodos REALES habilitados en el
  // dashboard de Pollar (email/Google/…) y usa los estilos/logo reales de la app.
  return (
    <PollarProvider client={{ apiKey: POLLAR_KEY, stellarNetwork: "testnet" }}>
      {children}
    </PollarProvider>
  );
}

/** Segundos a esperar el provisioning de la wallet antes de ofrecer "continuar igual". */
const WALLET_TIMEOUT_MS = 25_000;

/**
 * Botón "Crear cuenta con email/Google": abre el modal de Pollar (email + código). El usuario
 * quiere que Pollar GENERE la wallet, así que esperamos a que `walletAddress` exista (wallet
 * realmente provisionada) y recién ahí avanzamos al KYC con onReady().
 *
 * Si el provisioning se cuelga (típicamente porque en el dashboard de Pollar falta fondear el
 * funding/gas wallet o no hay assets/trustlines), tras WALLET_TIMEOUT_MS ofrecemos continuar
 * al KYC igual: la identidad anónima NO depende de la wallet de Pollar.
 *
 * Solo se renderiza dentro de <PollarRoot> (cuando POLLAR_ENABLED).
 */
export function PollarEmailLogin({ onReady }: { onReady: () => void }) {
  const { openLoginModal, isAuthenticated, verified, walletAddress } = usePollar();
  // `started`: el usuario apretó el botón en ESTA sesión de pantalla (no auto-navegamos a quien
  // ya tenía sesión Pollar al aterrizar en /login). `phase`: solo UI mientras se crea la wallet.
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<"idle" | "provisioning" | "timeout">("idle");
  const fired = useRef(false);

  const sessionReady = isAuthenticated || verified;
  const walletReady = typeof walletAddress === "string" && walletAddress.length > 0;

  // Sesión confirmada + wallet creada → avanzar al KYC (una sola vez).
  useEffect(() => {
    if (started && sessionReady && walletReady && !fired.current) {
      fired.current = true;
      onReady();
    }
  }, [started, sessionReady, walletReady, onReady]);

  // Sesión lista pero wallet todavía provisionándose: mostramos estado y armamos un timeout
  // de seguridad para no dejar al usuario atascado si el dashboard de Pollar no está fondeado.
  useEffect(() => {
    if (!started || !sessionReady || walletReady) return;
    setPhase("provisioning");
    const t = setTimeout(
      () => setPhase((p) => (p === "provisioning" ? "timeout" : p)),
      WALLET_TIMEOUT_MS,
    );
    return () => clearTimeout(t);
  }, [started, sessionReady, walletReady]);

  function start() {
    fired.current = false;
    setPhase("idle");
    setStarted(true);
    openLoginModal();
  }

  function continueAnyway() {
    if (fired.current) return;
    fired.current = true;
    onReady();
  }

  if (phase === "provisioning") {
    return <p className="auth-page__hint">Creando tu wallet con Pollar…</p>;
  }

  if (phase === "timeout") {
    return (
      <>
        <p className="auth-page__hint auth-page__hint--warn">
          La wallet está tardando más de lo normal en crearse. Podés continuar al KYC igual: tu
          identidad anónima no depende de esa wallet.
        </p>
        <Button variant="secondary" onClick={continueAnyway}>
          Continuar al KYC
        </Button>
      </>
    );
  }

  return (
    <Button variant="secondary" onClick={start}>
      Crear cuenta con Google o email
    </Button>
  );
}
