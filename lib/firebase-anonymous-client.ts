"use client";

type FirebaseWebConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };

function firebaseConfig(): FirebaseWebConfig | null {
  const packed = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (packed) {
    try {
      const parsed = JSON.parse(packed) as Partial<FirebaseWebConfig>;
      if (parsed.apiKey && parsed.authDomain && parsed.projectId && parsed.appId) return { apiKey: parsed.apiKey, authDomain: parsed.authDomain, projectId: parsed.projectId, appId: parsed.appId };
    } catch { /* Check the individual fields below. */ }
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}

export async function firebaseAnonymousIdToken(): Promise<string> {
  const config = firebaseConfig();
  if (!config) throw new Error("Shared GIF search is not configured yet.");
  const [{ initializeApp, getApps }, { getAuth, signInAnonymously }] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app = getApps().find((entry) => entry.name === "jackcaster-giphy") ?? initializeApp(config, "jackcaster-giphy");
  const auth = getAuth(app);
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  return user.getIdToken();
}
