const SECRET_KEY = "jackcaster:arcade-secrets-v1";

export function getArcadeSecrets(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(SECRET_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export function recordArcadeSecret(id: string): string[] {
  const found = new Set(getArcadeSecrets());
  found.add(id);
  const value = [...found];
  try { localStorage.setItem(SECRET_KEY, JSON.stringify(value)); } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("jackcaster:arcade-secret", { detail: value.length }));
  return value;
}
