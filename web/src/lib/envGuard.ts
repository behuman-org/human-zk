/** Falla en build de producción si falta una env var crítica; en dev usa el default. */
export function requireEnv(name: string, devDefault: string): string {
  const val = (import.meta.env as Record<string, string | undefined>)[name];
  if (val && val.length > 0) return val;
  if (import.meta.env.PROD) {
    const msg = `[beHuman] Falta ${name} en producción. Configurá la variable de entorno antes del deploy.`;
    console.error(msg);
    throw new Error(msg);
  }
  return devDefault;
}
