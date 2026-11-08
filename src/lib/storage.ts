// Browser-only data layer. Everything lives in localStorage on the user's device.
// All functions must be called from effects, event handlers or store snapshots — never at module scope.

export type Role = "admin" | "user";

export type AppUser = {
  email: string;
  business: string;
  phone: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
};

export type Product = {
  id: string;
  ownerEmail: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
  createdAt: string;
};

export type OrderStatus = "Pending" | "Completed" | "Cancelled";

export type Order = {
  id: string;
  ownerEmail: string;
  customerName: string;
  customerPhone: string;
  productId: string;
  productName: string;
  quantity: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  /** Delivery address or message from a shopper (public shop orders). */
  note?: string;
  /** "shop" when a shopper placed it from the public shop. */
  source?: "shop" | "manual";
};

export type Customer = {
  id: string;
  ownerEmail: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
};

export type EmailLog = {
  id: string;
  to: string;
  kind: "welcome" | "test";
  status: "sent" | "failed" | "skipped";
  detail: string;
  createdAt: string;
};

export type EmailJsConfig = {
  publicKey: string;
  serviceId: string;
  templateId: string;
  replyTo: string;
};

export const KEYS = {
  users: "eminent_users",
  products: "ebh_products",
  orders: "ebh_orders",
  customers: "ebh_customers",
  emailLogs: "ebh_email_logs",
  emailjs: "ebh_emailjs_config",
  // session keys
  email: "ebh_email",
  business: "ebh_business",
  phone: "ebh_phone",
  password: "ebh_password",
  savedPassword: "ebh_saved_password",
  loggedIn: "ebh_is_logged_in",
  role: "ebh_role",
  remember: "ebh_remember",
  expires: "ebh_session_expires",
} as const;

export const SESSION_FLAG = "ebh_session_active";

const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function notify() {
  listeners.forEach((l) => l());
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  notify();
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- Collections ----------
export const getUsers = () => readJson<AppUser[]>(KEYS.users, []);
export const setUsers = (v: AppUser[]) => writeJson(KEYS.users, v);
export const getProducts = () => readJson<Product[]>(KEYS.products, []);
export const setProducts = (v: Product[]) => writeJson(KEYS.products, v);
export const getOrders = () => readJson<Order[]>(KEYS.orders, []);
export const setOrders = (v: Order[]) => writeJson(KEYS.orders, v);
export const getCustomers = () => readJson<Customer[]>(KEYS.customers, []);
export const setCustomers = (v: Customer[]) => writeJson(KEYS.customers, v);
export const getEmailLogs = () => readJson<EmailLog[]>(KEYS.emailLogs, []);
export const setEmailLogs = (v: EmailLog[]) => writeJson(KEYS.emailLogs, v);

export function addEmailLog(log: Omit<EmailLog, "id" | "createdAt">) {
  const logs = getEmailLogs();
  logs.unshift({ ...log, id: uid("mail"), createdAt: new Date().toISOString() });
  setEmailLogs(logs.slice(0, 200));
}

// ---------- Backup / restore ----------
const BACKUP_KEYS = [
  KEYS.users,
  KEYS.products,
  KEYS.orders,
  KEYS.customers,
  KEYS.emailLogs,
  KEYS.emailjs,
  KEYS.email,
  KEYS.business,
  KEYS.phone,
  KEYS.password,
  KEYS.remember,
];

export function exportBackup() {
  const data: Record<string, string | null> = {};
  BACKUP_KEYS.forEach((k) => (data[k] = localStorage.getItem(k)));
  return JSON.stringify({ app: "eminent-business-hub", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importBackup(json: string) {
  const parsed = JSON.parse(json) as { app?: string; data?: Record<string, string | null> };
  if (parsed.app !== "eminent-business-hub" || !parsed.data) {
    throw new Error("This file is not an Eminent Business Hub backup.");
  }
  Object.entries(parsed.data).forEach(([k, v]) => {
    if (!BACKUP_KEYS.includes(k as (typeof BACKUP_KEYS)[number])) return;
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  });
  notify();
}
