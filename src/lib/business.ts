// Pure business rules: revenue, stock, analytics. No browser access here.
import type { Customer, Order, OrderStatus, Product } from "./storage";

export const LOW_STOCK_LIMIT = 5;

export function formatNaira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

/** Revenue counts Completed orders only. Pending is shown separately; Cancelled is ignored. */
export function revenueOf(orders: Order[]) {
  return orders.filter((o) => o.status === "Completed").reduce((s, o) => s + o.total, 0);
}

export function pendingValueOf(orders: Order[]) {
  return orders.filter((o) => o.status === "Pending").reduce((s, o) => s + o.total, 0);
}

export function isLowStock(p: Product) {
  return p.stock <= LOW_STOCK_LIMIT;
}

/** Stock change when an order moves between statuses. Cancelled orders give their stock back. */
export function stockDelta(from: OrderStatus | null, to: OrderStatus, quantity: number) {
  const holds = (s: OrderStatus | null) => s !== null && s !== "Cancelled";
  if (holds(from) === holds(to)) return 0;
  return holds(to) ? -quantity : quantity;
}

export function applyStock(products: Product[], productId: string, delta: number) {
  if (!delta) return products;
  return products.map((p) => (p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function salesSince(orders: Order[], since: Date) {
  return revenueOf(orders.filter((o) => new Date(o.createdAt) >= since));
}

export function salesPeriods(orders: Order[], now = new Date()) {
  const today = startOfDay(now);
  const week = new Date(today);
  week.setDate(week.getDate() - 6);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    today: salesSince(orders, today),
    week: salesSince(orders, week),
    month: salesSince(orders, month),
  };
}

export function last7Days(orders: Order[], now = new Date()) {
  const today = startOfDay(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today);
    day.setDate(day.getDate() - (6 - i));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const total = revenueOf(orders.filter((o) => {
      const t = new Date(o.createdAt);
      return t >= day && t < next;
    }));
    return { label: day.toLocaleDateString("en-NG", { weekday: "short" }), total };
  });
}

export function topProducts(orders: Order[], limit = 5) {
  const map = new Map<string, { name: string; quantity: number; revenue: number }>();
  orders
    .filter((o) => o.status !== "Cancelled")
    .forEach((o) => {
      const cur = map.get(o.productId) ?? { name: o.productName, quantity: 0, revenue: 0 };
      cur.quantity += o.quantity;
      if (o.status === "Completed") cur.revenue += o.total;
      map.set(o.productId, cur);
    });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

export type CustomerSummary = {
  key: string;
  name: string;
  phone: string;
  email: string;
  orders: number;
  spent: number;
  saved: Customer | null;
  ownerEmail: string;
};

/** Customers = saved customers + anyone who appears in orders, matched by name. */
export function summarizeCustomers(customers: Customer[], orders: Order[]): CustomerSummary[] {
  const map = new Map<string, CustomerSummary>();
  const keyOf = (owner: string, name: string) => `${owner}::${name.trim().toLowerCase()}`;
  customers.forEach((c) =>
    map.set(keyOf(c.ownerEmail, c.name), {
      key: keyOf(c.ownerEmail, c.name),
      name: c.name,
      phone: c.phone,
      email: c.email,
      orders: 0,
      spent: 0,
      saved: c,
      ownerEmail: c.ownerEmail,
    }),
  );
  orders.forEach((o) => {
    const k = keyOf(o.ownerEmail, o.customerName);
    const cur =
      map.get(k) ??
      ({ key: k, name: o.customerName, phone: o.customerPhone, email: "", orders: 0, spent: 0, saved: null, ownerEmail: o.ownerEmail } as CustomerSummary);
    if (o.status !== "Cancelled") cur.orders += 1;
    if (o.status === "Completed") cur.spent += o.total;
    if (!cur.phone && o.customerPhone) cur.phone = o.customerPhone;
    map.set(k, cur);
  });
  return [...map.values()].sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
}

export const DEFAULT_CATEGORY = "Fashion";

export const CATEGORIES: string[] = [
  "Fashion",
  "Beauty",
  "Hair",
  "Shoes & Bags",
  "Food & Drinks",
  "Electronics",
  "Home",
  "Services",
  "Other",
];
