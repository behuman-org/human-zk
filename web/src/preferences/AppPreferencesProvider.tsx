import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface AppPreferences {
  theme: ThemeMode;
  compactFeed: boolean;
  reducedMotion: boolean;
  showRightRail: boolean;
}

const STORAGE_KEY = "behuman_app_preferences";

const DEFAULTS: AppPreferences = {
  theme: "system",
  compactFeed: false,
  reducedMotion: false,
  showRightRail: true,
};

function readPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppPreferences>) };
  } catch {
    return DEFAULTS;
  }
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyPreferences(prefs: AppPreferences): void {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.classList.toggle("compact-feed", prefs.compactFeed);
  root.classList.toggle("reduce-motion", prefs.reducedMotion);
  root.classList.toggle("hide-right-rail", !prefs.showRightRail);
}

export { resolveTheme };

type AppPreferencesContextValue = AppPreferences & {
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  setCompactFeed: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  setShowRightRail: (value: boolean) => void;
  resetPreferences: () => void;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPreferences>(readPreferences);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const persist = useCallback((next: AppPreferences) => {
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    applyPreferences(next);
  }, []);

  useEffect(() => {
    applyPreferences(prefs);
  }, [prefs]);

  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs.theme]);

  const resolvedTheme = useMemo(
    () => (prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme),
    [prefs.theme, systemDark],
  );

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      ...prefs,
      resolvedTheme,
      setTheme: (theme) => persist({ ...prefs, theme }),
      setCompactFeed: (compactFeed) => persist({ ...prefs, compactFeed }),
      setReducedMotion: (reducedMotion) => persist({ ...prefs, reducedMotion }),
      setShowRightRail: (showRightRail) => persist({ ...prefs, showRightRail }),
      resetPreferences: () => persist(DEFAULTS),
    }),
    [persist, prefs, resolvedTheme],
  );

  return (
    <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
  );
}

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  return ctx;
}

/** Aplicar preferencias antes del primer paint (main.tsx). */
export function bootstrapAppPreferences(): void {
  applyPreferences(readPreferences());
}
