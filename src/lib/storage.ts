// App data types, the in-memory copy of the online data, and the few things kept on the phone
// (shopping cart, unfinished payment, remembered sign-in details).

export type Role = "admin" | "user";

export type AppUser = {
  id: string;
  /** Only known for yourself, or for everyone when you are an admin. Never shown in the shop. */
  email: string;
  business: string;
  phone: string;
  role: Role;
  createdAt: string;
  /** false = seller paused their public shop. */
  shopOpen?: boolean | undefined;
  /** Short "about my shop" text shown on the seller's store page. */
  shopBio?: string | undefined;
};

export type Product = {
  id: string;
  ownerId: string;
  name: string;
  price: number;
  stock: number;
  /** A photo link, or `photo:<productId>` for a photo uploaded from the phone. */
  imageUrl: string;
  category: string;
  createdAt: string;
  description?: string | undefined;
  /** true = seller hid it from the public shop. */
  hidden?: boolean | undefined;
};

/** A shopper's cart line, saved on the shopper's phone. */
export type CartItem = { productId: string; quantity: number };

export type OrderStatus = "Pending" | "Completed" | "Cancelled";

export type Order = {
  id: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  productId: string;
  productName: string;
  quantity: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  note?: string | undefined;
  source?: "shop" | "manual" | undefined;
  paymentStatus?: "paid" | "unpaid" | undefined;
  paymentRef?: string | undefined;
};

/** A Paystack payment the shopper started on this phone, waiting to be checked. */
export type PendingPayment = {
  /** Checkout code saved on the orders. Paystack attempts use it, plus "-r…" for retries. */
  reference: string;
  /** The Paystack reference of the latest attempt. */
  attempt: string;
  orderIds: string[];
  amount: number;
  email: string;
  name: string;
  phone: string;
  items: string;
  createdAt: string;
};

export type Customer = {
  id: string;
  ownerId: string;
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

/** Online collections (kept in memory) and phone-only keys (localStorage). */
export const KEYS = {
  users: "cloud:users",
  products: "cloud:products",
  orders: "cloud:orders",
  customers: "cloud:customers",
  emailLogs: "cloud:emailLogs",
  cart: "ebh_cart",
  pendingPayment: "ebh_pending_payment",
  // remembered sign-in details
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

/** Where older versions kept everything on the phone. Read once to move it online. */
export const LEGACY = {
  users: "eminent_users",
  products: "ebh_products",
  orders: "ebh_orders",
  customers: "ebh_customers",
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

// ---------- Online data, in memory ----------
type CloudData = {
  users: AppUser[];
  products: Product[];
  orders: Order[];
  customers: Customer[];
  emailLogs: EmailLog[];
  emailConfig: Partial<EmailJsConfig>;
  /** Shop products + sellers have arrived at least once. */
  shopLoaded: boolean;
  /** The signed-in seller's orders/customers have arrived at least once. */
  privateLoaded: boolean;
};

export const db: CloudData = {
  users: [],
  products: [],
  orders: [],
  customers: [],
  emailLogs: [],
  emailConfig: {},
  shopLoaded: false,
  privateLoaded: false,
};

export function setDb(patch: Partial<CloudData>) {
  Object.assign(db, patch);
  notify();
}

export const getUsers = () => db.users;
export const getProducts = () => db.products;
export const getOrders = () => db.orders;
export const getCustomers = () => db.customers;
export const getEmailLogs = () => db.emailLogs;

// ---------- Phone-only ----------
export const getCart = () => readJson<CartItem[]>(KEYS.cart, []);
export const setCart = (v: CartItem[]) => writeJson(KEYS.cart, v);
export const getPendingPayment = () => {
  const p = readJson<PendingPayment | null>(KEYS.pendingPayment, null);
  return p && !p.attempt ? { ...p, attempt: p.reference } : p;
};
export function setPendingPayment(v: PendingPayment | null) {
  if (v) writeJson(KEYS.pendingPayment, v);
  else {
    localStorage.removeItem(KEYS.pendingPayment);
    notify();
  }
}
