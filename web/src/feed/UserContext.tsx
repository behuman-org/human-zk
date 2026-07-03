import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { bootstrapProfileFromApi, syncProfileToApi } from "./feedApi";
import {
  markLoggedOut,
  isLoggedOut,
  loadSession,
  saveSession,
  setActiveIdentity,
  setOnChainVerified,
  getOnChainVerified,
  type VerificationState,
} from "./session";
import { derivePlatformIdentity } from "../identity/identity";
import { isVerified } from "../kyc/chain";
import { warmCredentialCache, loadAnyCredentialAsync } from "../kyc/credentialStore";
import { loadRegistrationAddress } from "../kyc/registrationStore";
import { ensurePlatformAuth, clearPlatformAuth } from "./platformAuth";
import type { UserProfile } from "./types";

interface UserContextValue {
  user: UserProfile;
  /** Humano verificado on-chain (is_verified) + credencial local. */
  verified: boolean;
  verificationState: VerificationState;
  updateProfile: (patch: Partial<Pick<UserProfile, "username" | "bio" | "avatarIndex">>) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => loadSession());
  const [verificationState, setVerificationState] = useState<VerificationState>("checking");
  const [onChainOk, setOnChainOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isLoggedOut()) {
        setActiveIdentity(null);
        setOnChainVerified(false);
        setVerificationState("idle");
        setOnChainOk(false);
        setUser(loadSession());
        return;
      }

      setVerificationState("checking");
      await warmCredentialCache();

      let id: Awaited<ReturnType<typeof derivePlatformIdentity>> = null;
      try {
        id = await derivePlatformIdentity();
      } catch (err) {
        console.error("[UserContext] derivePlatformIdentity falló:", err);
      }
      if (cancelled) return;

      const cred = await loadAnyCredentialAsync();
      const regAddr = loadRegistrationAddress();

      let chainVerified = false;
      if (cred && regAddr) {
        try {
          chainVerified = await isVerified(regAddr);
        } catch (err) {
          console.error("[UserContext] isVerified RPC falló:", err);
          if (!cancelled) {
            setVerificationState("rpc_error");
            setOnChainOk(false);
            setOnChainVerified(false);
          }
          return;
        }
      }

      if (cancelled) return;
      setOnChainOk(chainVerified);
      setOnChainVerified(chainVerified);
      setVerificationState(chainVerified && cred ? "verified" : "unverified");

      setActiveIdentity(id?.platformId ?? null);
      const base = loadSession();
      setUser({ ...base, verified: chainVerified && !!id?.platformId });

      if (id && cred && chainVerified) {
        try {
          await ensurePlatformAuth(cred);
        } catch (err) {
          console.error("[UserContext] platform auth falló:", err);
        }
        try {
          const profile = await bootstrapProfileFromApi(id.platformId);
          if (!cancelled) {
            setUser({ ...profile, verified: true });
            saveSession({ ...profile, verified: true });
          }
        } catch {
          /* perfil off-chain best-effort */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<Pick<UserProfile, "username" | "bio" | "avatarIndex">>) => {
      setUser((prev) => {
        const next = { ...prev, ...patch };
        saveSession(next);
        void syncProfileToApi(next);
        return next;
      });
    },
    [],
  );

  const logout = useCallback(() => {
    clearPlatformAuth();
    markLoggedOut();
    setOnChainOk(false);
    setVerificationState("idle");
    setUser(loadSession());
  }, []);

  const verified = onChainOk && getOnChainVerified() && !!user.platformId;

  const value = useMemo(
    () => ({ user, verified, verificationState, updateProfile, logout }),
    [user, verified, verificationState, updateProfile, logout],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser requires UserProvider");
  return ctx;
}
