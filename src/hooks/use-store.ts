import { useMemo, useSyncExternalStore } from "react";
import { readSession, type Session } from "@/lib/auth";
import { db, subscribe, type AppUser, type Customer, type EmailLog, type Order, type Product } from "@/lib/storage";

const EMPTY: never[] = [];
const cache = new Map<string, { raw: string | null; value: unknown }>();
const CLOUD: Record<string, keyof typeof db> = {
  "cloud:users": "users",
  "cloud:products": "products",
  "cloud:orders": "orders",
  "cloud:customers": "customers",
  "cloud:emailLogs": "emailLogs",
};

function snapshot<T>(key: string): T[] {
  const cloud = CLOUD[key];
  if (cloud) return db[cloud] as unknown as T[];
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
  return useSyncExternalStore(subscribe, () => snapshot<T>(key), () => EMPTY as T[]);
}

/** true once shop products have arrived from online storage. */
export function useShopLoaded() {
  return useSyncExternalStore(subscribe, () => db.shopLoaded, () => false);
}

/** undefined = still loading, null = signed out. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, readSession, () => undefined);
}

/** Data scoped to the signed-in user. Admins see everything. */
export function useScopedData(session: Session | null | undefined) {
  const products = useCollection<Product>("cloud:products");
  const orders = useCollection<Order>("cloud:orders");
  const customers = useCollection<Customer>("cloud:customers");
  const users = useCollection<AppUser>("cloud:users");
  const emailLogs = useCollection<EmailLog>("cloud:emailLogs");

  return useMemo(() => {
    const isAdmin = session?.role === "admin";
    const mine = <T extends { ownerId: string }>(list: T[]) => (isAdmin ? list : list.filter((x) => x.ownerId === session?.id));
    const names = new Map(users.map((u) => [u.id, u.business || u.email || "Seller"]));
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
      ownerName: (id: string) => names.get(id) ?? "Seller",
    };
  }, [session, products, orders, customers, users, emailLogs]);
}

/** For pages inside the signed-in area (the layout guarantees a session). */
export function useApp() {
  const session = useSession() as Session;
  const data = useScopedData(session);
  return { session, ...data };
}
