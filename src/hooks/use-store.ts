import { useMemo, useSyncExternalStore } from "react";
import { readSession, type Session } from "@/lib/auth";
import {
  KEYS,
  subscribe,
  type AppUser,
  type Customer,
  type EmailLog,
  type Order,
  type Product,
} from "@/lib/storage";

const EMPTY: never[] = [];
const cache = new Map<string, { raw: string | null; value: unknown }>();

function snapshot<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T[];
  let value: T[] = EMPTY;
  try {
    value = raw ? (JSON.parse(raw) as T[]) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache.set(key, { raw, value });
  return value;
}

export function useCollection<T>(key: string): T[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot<T>(key),
    () => EMPTY as T[],
  );
}

let sessionCache: { raw: string; value: Session | null } | null = null;
function sessionSnapshot() {
  const value = readSession();
  const raw = JSON.stringify(value);
  if (sessionCache && sessionCache.raw === raw) return sessionCache.value;
  sessionCache = { raw, value };
  return value;
}

/** undefined = still loading (server render / before hydration), null = signed out. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, sessionSnapshot, () => undefined);
}

/** Data scoped to the signed-in user. Admins see everything. */
export function useScopedData(session: Session | null | undefined) {
  const products = useCollection<Product>(KEYS.products);
  const orders = useCollection<Order>(KEYS.orders);
  const customers = useCollection<Customer>(KEYS.customers);
  const users = useCollection<AppUser>(KEYS.users);
  const emailLogs = useCollection<EmailLog>(KEYS.emailLogs);

  return useMemo(() => {
    const isAdmin = session?.role === "admin";
    const mine = <T extends { ownerEmail: string }>(list: T[]) =>
      isAdmin ? list : list.filter((x) => x.ownerEmail === session?.email);
    return {
      isAdmin,
      products: mine(products),
      orders: mine(orders),
      customers: mine(customers),
      users,
      emailLogs,
      allProducts: products,
      allOrders: orders,
      allCustomers: customers,
    };
  }, [session, products, orders, customers, users, emailLogs]);
}

/** For pages inside the signed-in area (the layout guarantees a session). */
export function useApp() {
  const session = useSession() as Session;
  const data = useScopedData(session);
  return { session, ...data };
}
