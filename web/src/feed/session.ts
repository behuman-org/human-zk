import type { UserProfile } from "./types";

const STORAGE_KEY = "behuman_platform_session";

/** Identidad de sesión — en prod viene de Capa 1 + ZK. Override: VITE_DEMO_PLATFORM_ID */
export const DEMO_PLATFORM_ID =
  import.meta.env.VITE_DEMO_PLATFORM_ID ??
  "a1b2c3d4e5f6789012345678abcdef9012345678abcdef9012345678ab12f9k";

export function handleOf(platformId: string): string {
  return platformId.slice(-5);
}

const AVATAR_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#22c55e",
] as const;

export function avatarColor(index: number): string {
  return AVATAR_COLORS[Math.max(0, Math.min(index, AVATAR_COLORS.length - 1))];
}

export function defaultProfile(): UserProfile {
  const platformId = DEMO_PLATFORM_ID;
  return {
    platformId,
    handle: handleOf(platformId),
    username: "",
    bio: "",
    avatarIndex: 0,
    verified: true,
  };
}

export function loadSession(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const base = defaultProfile();
    return {
      ...base,
      ...parsed,
      platformId: base.platformId,
      handle: base.handle,
      verified: true,
    };
  } catch {
    return defaultProfile();
  }
}

export function saveSession(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
