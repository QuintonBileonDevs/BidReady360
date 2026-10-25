import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";

export type Profile = { displayName: string; firstName: string; tenantType: "supplier" | "organization" | "platform"; tenantId: string; role: string; orgName: string; verificationStatus: string };
export type Session = { user: { id: string; email: string }; profile: Profile };
type Status = "booting" | "signed-out" | "signing-in" | "ready" | "error" | "signing-out";
type Ctx = { status: Status; session: Session | null; signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string; code?: string }>; signOut: () => Promise<void>; retry: () => void };

const AuthCtx = createContext<Ctx | null>(null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const valid = (b: any): b is Session => !!b?.user?.id && !!b?.profile?.displayName && !!b?.profile?.tenantId;

async function api(path: string, init?: RequestInit) {
  const r = await fetch(path, { credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, ...init });
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
}

async function loadSession(): Promise<Session | null | "fail"> {
  const waits = [0, 500, 1200];
  for (let i = 0; i < 3; i++) {
    if (waits[i]) await sleep(waits[i]);
    try {
      const r = await api("/api/auth/session");
      if (r.status === 200 && valid(r.body)) return r.body;
      if (r.status === 401) return null;
    } catch { }
  }
  return "fail";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("booting");
  const [session, setSession] = useState<Session | null>(null);
  const started = useRef(0);

  const minTime = async () => { const left = 700 - (Date.now() - started.current); if (left > 0) await sleep(left); };

  const boot = useCallback(async () => {
    started.current = Date.now(); setStatus("booting");
    const s = await loadSession();
    await minTime();
    if (s === "fail") return setStatus("error");
    if (s === null) { setSession(null); return setStatus("signed-out"); }
    setSession(s); setStatus("ready");
  }, []);

  useEffect(() => { console.log("BidReady360 build auth-v3"); boot(); }, [boot]);

  const signIn: Ctx["signIn"] = async (email, password) => {
    started.current = Date.now(); setStatus("signing-in");
    try {
      const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (r.status === 200 && valid(r.body)) { await minTime(); setSession(r.body); setStatus("ready"); return { ok: true }; }
      setStatus("signed-out");
      if (r.status === 429) return { ok: false, code: "rate", message: "Too many attempts. Try again in 15 minutes." };
      if (r.status === 403) return { ok: false, code: "verify", message: "Verify your email first." };
      if (r.status === 401) return { ok: false, code: "bad", message: "Email or password is incorrect." };
      return { ok: false, message: "We could not sign you in. Try again." };
    } catch {
      setStatus("signed-out");
      return { ok: false, message: "We could not reach the server. Check your connection and try again." };
    }
  };

  const signOut = async () => {
    started.current = Date.now(); setStatus("signing-out"); setSession(null);
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    await minTime();
    window.location.replace("/login");
  };

  return <AuthCtx.Provider value={{ status, session, signIn, signOut, retry: boot }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => { const c = useContext(AuthCtx); if (!c) throw new Error("useAuth outside AuthProvider"); return c; };
export const useSession = (): Session => { const { session, status } = useAuth(); if (status !== "ready" || !session) throw new Error("useSession before ready"); return session; };
