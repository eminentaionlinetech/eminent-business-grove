// Client-side demo auth. Accounts and passwords live only in this browser's localStorage.
// Real production use needs server-side auth (e.g. Lovable Cloud) for secure admin access.
import { KEYS, SESSION_FLAG, getUsers, notify, setUsers, type AppUser, type Role } from "./storage";

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_ADMIN_EMAIL = "admin@eminentbusinesshub.com";

export type Session = {
  email: string;
  business: string;
  phone: string;
  role: Role;
};

export function isAdminEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().includes("admin");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const data = new TextEncoder().encode(`ebh::${password}`);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for very old browsers: simple non-cryptographic hash (demo only).
  let h = 0;
  for (const byte of data) h = (h * 31 + byte) | 0;
  return `weak_${h}`;
}

// Saved password for auto-fill when "Remember me" is on. Obfuscated, not encrypted — demo only.
const encode = (s: string) => btoa(unescape(encodeURIComponent(s)));
const decode = (s: string) => {
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return "";
  }
};

export type RememberedDetails = {
  email: string;
  business: string;
  phone: string;
  password: string;
  remember: boolean;
};

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

/** Reads the current session. Returns null when signed out or the session expired. */
export function readSession(now = Date.now()): Session | null {
  if (localStorage.getItem(KEYS.loggedIn) !== "true") return null;
  const email = localStorage.getItem(KEYS.email);
  if (!email) return null;

  const remember = localStorage.getItem(KEYS.remember) === "true";
  if (remember) {
    const expires = Number(localStorage.getItem(KEYS.expires) ?? 0);
    if (expires && expires < now) return null;
  } else if (sessionStorage.getItem(SESSION_FLAG) !== "1") {
    // "Remember me" was off and the browser was closed since sign-in.
    return null;
  }

  const role: Role = isAdminEmail(email) ? "admin" : "user";
  return {
    email,
    business: localStorage.getItem(KEYS.business) ?? "",
    phone: localStorage.getItem(KEYS.phone) ?? "",
    role,
  };
}

function startSession(user: AppUser, password: string, remember: boolean) {
  localStorage.setItem(KEYS.email, user.email);
  localStorage.setItem(KEYS.business, user.business);
  localStorage.setItem(KEYS.phone, user.phone);
  localStorage.setItem(KEYS.password, user.passwordHash);
  localStorage.setItem(KEYS.remember, remember ? "true" : "false");
  if (remember) {
    localStorage.setItem(KEYS.savedPassword, encode(password));
    localStorage.setItem(KEYS.expires, String(Date.now() + THIRTY_DAYS_MS));
  } else {
    localStorage.removeItem(KEYS.savedPassword);
    localStorage.removeItem(KEYS.expires);
  }
  sessionStorage.setItem(SESSION_FLAG, "1");
  localStorage.setItem(KEYS.loggedIn, "true");
  // Detect if admin
  const isAdmin = isAdminEmail(user.email);
  localStorage.setItem(KEYS.role, isAdmin ? "admin" : "user");
  notify();
}

export type AuthResult = { ok: true; user: AppUser; isNew: boolean } | { ok: false; error: string };

export async function signUp(input: {
  email: string;
  business: string;
  phone: string;
  password: string;
  remember: boolean;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!input.business.trim()) return { ok: false, error: "Enter your business name." };
  if (input.phone.replace(/\D/g, "").length < 7) return { ok: false, error: "Enter a valid phone number." };
  if (input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const users = getUsers();
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: "An account with this email already exists. Please sign in." };
  }
  const user: AppUser = {
    email,
    business: input.business.trim(),
    phone: input.phone.trim(),
    passwordHash: await hashPassword(input.password),
    role: isAdminEmail(email) ? "admin" : "user",
    createdAt: new Date().toISOString(),
  };
  setUsers([...users, user]);
  startSession(user, input.password, input.remember);
  return { ok: true, user, isNew: true };
}

export async function signIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) return { ok: false, error: "Enter your email and password." };
  const users = getUsers();
  const hash = await hashPassword(input.password);
  const existing = users.find((u) => u.email === email);

  if (!existing) {
    if (isAdminEmail(email)) {
      // First admin sign-in on this device creates the admin account.
      const admin: AppUser = {
        email,
        business: localStorage.getItem(KEYS.business) || "Eminent Business Hub",
        phone: localStorage.getItem(KEYS.phone) || "",
        passwordHash: hash,
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      setUsers([...users, admin]);
      startSession(admin, input.password, input.remember);
      return { ok: true, user: admin, isNew: false };
    }
    return { ok: false, error: "No account found for this email on this device. Create an account first." };
  }

  if (existing.passwordHash !== hash) return { ok: false, error: "Wrong password. Please try again." };
  startSession(existing, input.password, input.remember);
  return { ok: true, user: existing, isNew: false };
}

/** Signs out but KEEPS email, business, phone and password so the next sign-in is remembered. */
export function logout() {
  localStorage.removeItem(KEYS.loggedIn);
  localStorage.removeItem(KEYS.role);
  sessionStorage.removeItem(SESSION_FLAG);
  notify();
}

export async function changePassword(email: string, current: string, next: string) {
  const users = getUsers();
  const user = users.find((u) => u.email === email);
  if (!user) return { ok: false as const, error: "Account not found." };
  if (user.passwordHash !== (await hashPassword(current))) return { ok: false as const, error: "Current password is wrong." };
  if (next.length < 6) return { ok: false as const, error: "New password must be at least 6 characters." };
  user.passwordHash = await hashPassword(next);
  setUsers(users);
  localStorage.setItem(KEYS.password, user.passwordHash);
  if (localStorage.getItem(KEYS.savedPassword)) localStorage.setItem(KEYS.savedPassword, encode(next));
  notify();
  return { ok: true as const };
}

export const ADMIN_RECOVERY_SNIPPET = `localStorage.setItem('ebh_email','${DEFAULT_ADMIN_EMAIL}'); localStorage.setItem('ebh_is_logged_in','true'); localStorage.setItem('ebh_role','admin'); localStorage.setItem('ebh_remember','true'); location.reload();`;
