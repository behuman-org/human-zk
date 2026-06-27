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
import { loadSession, saveSession } from "./session";
import type { UserProfile } from "./types";

interface UserContextValue {
  user: UserProfile;
  updateProfile: (patch: Partial<Pick<UserProfile, "username" | "bio" | "avatarIndex">>) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => loadSession());

  useEffect(() => {
    void bootstrapProfileFromApi(user.platformId).then((profile) => {
      setUser(profile);
      saveSession(profile);
    });
  }, [user.platformId]);

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

  const value = useMemo(() => ({ user, updateProfile }), [user, updateProfile]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser requires UserProvider");
  return ctx;
}
