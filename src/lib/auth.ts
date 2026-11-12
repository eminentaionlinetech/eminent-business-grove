// Online accounts (Lovable Cloud). The phone only remembers details for quick sign-in.
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { KEYS, LEGACY, SESSION_FLAG, notify, readJson, type Role } from "./storage";
import { THIRTY_DAYS_MS, isAdminEmail, rememberStillValid } from "./business";
import { refreshAll, setViewer, startLiveUpdates } from "./cloud";
import { moveLocalDataOnline } from "./migrate";

export { THIRTY_DAYS_MS, isAdminEmail };
export const DEFAULT_ADMIN_EMAIL = "admin@eminentbusinesshub.com";
/** The business owner's email: admin, and the Reply-To for welcome emails. */
export const OWNER_EMAIL = "eminentbusinesshubhotmail@gmail.com";

export type Session = { id: string; email: string; business: string; phone: string; role: Role };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Captured before the sign-in client reads the link, so links from emails count as a fresh sign-in.
const ARRIVED_FROM_LINK =
  typeof window !== "undefined" && /access_token=|token_hash=|[?&]code=/.test(window.location.hash + window.location.search);

let state: { ready: boolean; session: Session | null } = { ready: false, session: null };

/** undefined = still checking, null = signed out. */
export function readSession(): Session | null | undefined {
  return state.ready ? state.session : undefined;
}

// ---------- Remembered details ----------
const encode = (s: string) => btoa(unescape(encodeURIComponent(s)));
const decode = (s: string) => {
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return "";
  }
};

export type RememberedDetails = { email: string; business: string; phone: string; password: string; remember: boolean };

export function getRememberedDetails(): RememberedDetails {
  const saved = localStorage.getItem(KEYS.savedPassword);
  return {
    email: localStorage.getItem(KEYS.email) ?? "",
    business: localStorage.getItem(KEYS.business) ?? "",
    phone: localStorage.getItem(KEYS.phone) ?? "",
    password: saved ? decode(saved) : "",
    remember: localStorage.getItem(KEYS.remember) !== "false",
  };
}

function rememberDetails(d: { email?: string; business?: string; phone?: string; password?: string; remember?: boolean }) {
  if (d.email) localStorage.setItem(KEYS.email, d.email);
  if (d.business) localStorage.setItem(KEYS.business, d.business);
  if (d.phone) localStorage.setItem(KEYS.phone, d.phone);
  if (d.remember !== undefined) localStorage.setItem(KEYS.remember, d.remember ? "true" : "false");
  if (d.password !== undefined) {
    if (d.remember === false) localStorage.removeItem(KEYS.savedPassword);
    else localStorage.setItem(KEYS.savedPassword, encode(d.password));
    localStorage.setItem(KEYS.password, "saved-online");
  }
}

/** Starts the remember-me clock: 30 days when on, until the browser closes when off. */
function markSession(remember: boolean) {
  localStorage.setItem(KEYS.remember, remember ? "true" : "false");
  if (remember) localStorage.setItem(KEYS.expires, String(Date.now() + THIRTY_DAYS_MS));
  else localStorage.removeItem(KEYS.expires);
  sessionStorage.setItem(SESSION_FLAG, "1");
}

function savedSignInStillValid() {
  return rememberStillValid({
    remember: localStorage.getItem(KEYS.remember) !== "false",
    expires: Number(localStorage.getItem(KEYS.expires) ?? 0),
    tabFlag: sessionStorage.getItem(SESSION_FLAG) === "1",
    now: Date.now(),
  });
}

// ---------- Session from the online account ----------
async function buildSession(user: User): Promise<Session> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("business, phone").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const meta = (user.user_metadata ?? {}) as { business?: string; phone?: string };
  return {
    id: user.id,
    email: user.email ?? "",
    business: profile?.business || meta.business || "",
    phone: profile?.phone || meta.phone || "",
    role: roles?.some((r) => r.role === "admin") ? "admin" : "user",
  };
}

let applying: { id: string | null; promise: Promise<void> } | null = null;

function applyUser(user: User | null, force = false): Promise<void> {
  const id = user?.id ?? null;
  if (!force && applying && applying.id === id) return applying.promise;
  const promise = (async () => {
    if (!user) {
      setViewer(null);
      state = { ready: true, session: null };
      notify();
      await refreshAll();
      return;
    }
    const session = await buildSession(user);
    setViewer({ id: session.id, email: session.email, isAdmin: session.role === "admin" });
    rememberDetails({ email: session.email, business: session.business, phone: session.phone });
    localStorage.setItem(KEYS.loggedIn, "true");
    localStorage.setItem(KEYS.role, session.role);
    try {
      await moveLocalDataOnline(session);
    } catch (e) {
      console.error("Could not move old phone data online", e);
    }
    await refreshAll();
    state = { ready: true, session };
    notify();
  })();
  applying = { id, promise };
  return promise;
}

let started = false;
/** Called once when the app opens in the browser. */
export function initAuth() {
  if (started || typeof window === "undefined") return;
  started = true;
  startLiveUpdates();
  supabase.auth.onAuthStateChange((event, s) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "PASSWORD_RECOVERY") return;
    // Never wait on the sign-in client inside its own callback.
    setTimeout(() => void applyUser(s?.user ?? null, event === "USER_UPDATED"), 0);
  });
  void (async () => {
    const { data } = await supabase.auth.getSession();
    let user = data.session?.user ?? null;
    if (user && (ARRIVED_FROM_LINK || window.location.pathname.startsWith("/reset-password"))) {
      markSession(true);
    } else if (user && !savedSignInStillValid()) {
      await supabase.auth.signOut();
      user = null;
    }
    await applyUser(user);
  })();
}

/** Re-reads business name/phone after a profile change. */
export async function reloadSession() {
  const { data } = await supabase.auth.getUser();
  await applyUser(data.user, true);
}

// ---------- Sign up / sign in ----------
export type AuthResult =
  | { ok: true; session: Session; needsConfirm?: false }
  | { ok: true; needsConfirm: true; email: string }
  | { ok: false; error: string };

function friendly(message: string) {
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists. Please sign in.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Please wait a few minutes and try again.";
  if (/password/i.test(message) && /(weak|short|least|pwned|leaked)/i.test(message))
    return "Choose a stronger password (at least 6 characters, not a common one).";
  if (/network|fetch/i.test(message)) return "No internet connection. Check your data and try again.";
  return message;
}

async function signedInResult(user: User): Promise<AuthResult> {
  await applyUser(user);
  return state.session ? { ok: true, session: state.session } : { ok: false, error: "Could not open your account. Try again." };
}

export async function signUp(input: { email: string; business: string; phone: string; password: string; remember: boolean }): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!input.business.trim()) return { ok: false, error: "Enter your business name." };
  if (input.phone.replace(/\D/g, "").length < 7) return { ok: false, error: "Enter a valid phone number." };
  if (input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { business: input.business.trim().slice(0, 120), phone: input.phone.trim().slice(0, 40) },
    },
  });
  if (error) return { ok: false, error: friendly(error.message) };
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, error: "An account with this email already exists. Please sign in." };
  }
  rememberDetails({ email, business: input.business.trim(), phone: input.phone.trim(), password: input.password, remember: input.remember });
  if (data.session && data.user) {
    markSession(input.remember);
    return signedInResult(data.user);
  }
  return { ok: true, needsConfirm: true, email };
}

export async function signIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) return { ok: false, error: "Enter your email and password." };
  markSession(input.remember);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (/not confirmed/i.test(msg)) {
      return { ok: false, error: `Please confirm your email first: open the link we sent to ${email} (check spam too), then sign in.` };
    }
    if (/network|fetch/i.test(msg)) return { ok: false, error: friendly(msg) };
    const moved = await moveOldPhoneAccountOnline(email, input.password);
    if (moved) return moved;
    return { ok: false, error: "Wrong email or password. If you forgot your password, tap \"Forgot password?\"." };
  }
  rememberDetails({ email, password: input.password, remember: input.remember });
  return signedInResult(data.user);
}

/** Signs out but KEEPS email, business, phone and password so the next sign-in is remembered. */
export async function logout() {
  localStorage.removeItem(KEYS.loggedIn);
  localStorage.removeItem(KEYS.role);
  sessionStorage.removeItem(SESSION_FLAG);
  state = { ready: true, session: null };
  notify();
  await supabase.auth.signOut();
}

export async function changePassword(email: string, current: string, next: string) {
  if (next.length < 6) return { ok: false as const, error: "New password must be at least 6 characters." };
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) return { ok: false as const, error: "Current password is wrong." };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false as const, error: friendly(error.message) };
  if (localStorage.getItem(KEYS.savedPassword)) localStorage.setItem(KEYS.savedPassword, encode(next));
  return { ok: true as const };
}

// ---------- Password recovery (reset link by email) ----------
export async function requestPasswordReset(email: string) {
  const e = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false as const, error: "Enter the email you used to create your account." };
  const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: `${window.location.origin}/reset-password` });
  if (error) return { ok: false as const, error: friendly(error.message) };
  return { ok: true as const };
}

/** On the reset page, after opening the email link: set the new password and stay signed in. */
export async function finishPasswordReset(newPassword: string): Promise<AuthResult> {
  if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters." };
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error || !data.user) {
    return { ok: false, error: /session/i.test(error?.message ?? "") ? "This reset link has expired. Ask for a new one." : friendly(error?.message ?? "Try again.") };
  }
  markSession(true);
  rememberDetails({ email: data.user.email ?? "", password: newPassword, remember: true });
  await applyUser(data.user, true);
  return state.session ? { ok: true, session: state.session } : { ok: false, error: "Try again." };
}

// ---------- Accounts from the older on-phone version ----------
type LegacyUser = { email: string; business: string; phone: string; passwordHash: string };

async function legacyHash(password: string) {
  const data = new TextEncoder().encode(`ebh::${password}`);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** An account made on this phone before accounts went online: create it online with the same details. */
async function moveOldPhoneAccountOnline(email: string, password: string): Promise<AuthResult | null> {
  const old = readJson<LegacyUser[]>(LEGACY.users, []).find((u) => u.email === email);
  if (!old || old.passwordHash !== (await legacyHash(password))) return null;
  const res = await signUp({ email, business: old.business || "My business", phone: old.phone || "0000000", password, remember: true });
  if (!res.ok) return null;
  if (res.needsConfirm) {
    return {
      ok: false,
      error: `Your account is moving online. We sent a confirmation link to ${email} — open it (check spam too), then sign in. Your products come with you.`,
    };
  }
  return res;
}
