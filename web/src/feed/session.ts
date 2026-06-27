import type { UserProfile } from "./types";

// Preferencias locales (username/bio/avatar). El platformId NO se guarda acá: se deriva de la
// credencial Capa 1 (prueba ZK) y vive en memoria como identidad activa de la sesión.
const PREFS_KEY = "behuman_platform_prefs";

// Identidad anónima activa (platformId hex). null = invitado (sin credencial en el device).
let activePlatformId: string | null = null;
export function setActiveIdentity(platformId: string | null): void {
  activePlatformId = platformId;
}
export function getActivePlatformId(): string | null {
  return activePlatformId;
}

// Override de desarrollo opcional (vacío por defecto → identidad real desde la credencial).
export const DEMO_PLATFORM_ID = import.meta.env.VITE_DEMO_PLATFORM_ID ?? "";

export function handleOf(platformId: string): string {
  return platformId ? platformId.slice(-5) : "—";
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

interface Prefs {
  username: string;
  bio: string;
  avatarIndex: number;
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { username: "", bio: "", avatarIndex: 0, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* ignore */
  }
  return { username: "", bio: "", avatarIndex: 0 };
}

export function defaultProfile(): UserProfile {
  const platformId = activePlatformId ?? DEMO_PLATFORM_ID ?? "";
  const prefs = loadPrefs();
  return {
    platformId,
    handle: handleOf(platformId),
    username: prefs.username,
    bio: prefs.bio,
    avatarIndex: prefs.avatarIndex,
    verified: !!platformId, // tiene credencial Capa 1 → humano verificado
  };
}

/** Perfil actual (identidad real si hay credencial; invitado si no). */
export function loadSession(): UserProfile {
  return defaultProfile();
}

/** Persiste SOLO las preferencias locales (nunca el platformId ni PII). */
export function saveSession(profile: UserProfile): void {
  const prefs: Prefs = {
    username: profile.username,
    bio: profile.bio,
    avatarIndex: profile.avatarIndex,
  };
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
