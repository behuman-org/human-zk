// Guard de rutas /app/* — exige sesión activa + credencial + verificación on-chain.
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { hasCredential } from "../identity/identity";
import { isLoggedOut } from "./session";
import { useUser } from "./UserContext";

export function AppGuard({ children }: { children: ReactNode }) {
  const { verified, verificationState } = useUser();
  const location = useLocation();

  if (isLoggedOut()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!hasCredential()) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  if (verificationState === "checking") {
    return (
      <div className="feed-state feed-state--loading" role="status">
        <p className="feed-state__message">Verificando identidad on-chain…</p>
      </div>
    );
  }

  if (verificationState === "rpc_error") {
    return (
      <div className="feed-state feed-state--error">
        <p className="feed-state__message feed-state__message--err">
          No pudimos confirmar tu verificación on-chain (error de red). Reintentá en unos segundos.
        </p>
      </div>
    );
  }

  if (!verified) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
