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
import { loadSession, saveSession, setActiveIdentity } from "./session";
import { derivePlatformIdentity } from "../identity/identity";
import type { UserProfile } from "./types";

interface UserContextValue {
  user: UserProfile;
  /** ¿Tiene identidad verificada (credencial Capa 1) en este dispositivo? */
  verified: boolean;
  updateProfile: (patch: Partial<Pick<UserProfile, "username" | "bio" | "avatarIndex">>) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => loadSession());

  // Deriva la identidad REAL (platformId) desde la credencial Capa 1 (prueba ZK local).
  // Si no hay credencial → invitado (platformId vacío, verified false).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await derivePlatformIdentity();
      if (cancelled) return;
      setActiveIdentity(id?.platformId ?? null);
      const base = loadSession();
      setUser(base);
      if (id) {
        try {
          const profile = await bootstrapProfileFromApi(id.platformId);
          if (!cancelled) {
            setUser(profile);
            saveSession(profile);
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

  const value = useMemo(
    () => ({ user, verified: !!user.platformId, updateProfile }),
    [user, updateProfile],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser requires UserProvider");
  return ctx;
}
