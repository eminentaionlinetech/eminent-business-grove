// Pure business rules: revenue, stock, analytics. No browser access here.
import type { CartItem, Customer, Order, OrderStatus, Product } from "./storage";

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

// ---------- Public shop ----------
export type ShopVendor = { email: string; slug: string; business: string; phone: string; open: boolean; bio: string };
type VendorUser = { email: string; business: string; phone: string; shopOpen?: boolean | undefined; shopBio?: string | undefined };

function hash4(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(-4);
}

/** Public store address for a vendor: business name + short code (never the email). */
export function vendorSlug(business: string, email: string) {
  const base = business
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "shop"}-${hash4(email.toLowerCase())}`;
}

/** Only public details of each vendor — no email shown, no password. */
export function shopVendors(users: VendorUser[]) {
  const map = new Map<string, ShopVendor>();
  users.forEach((u) =>
    map.set(u.email, {
      email: u.email,
      slug: vendorSlug(u.business, u.email),
      business: u.business || "EBH Seller",
      phone: u.phone,
      open: u.shopOpen !== false,
      bio: (u.shopBio ?? "").trim(),
    }),
  );
  return map;
}

export type ShopItem = Product & { vendor: ShopVendor };

/**
 * Products shown in the public shop: only from existing vendors whose shop is open,
 * never products the seller hid. In-stock first, newest first.
 */
export function shopListing(
  products: Product[],
  users: VendorUser[],
  filter: { q?: string | undefined; category?: string | undefined; vendorSlug?: string | undefined } = {},
): ShopItem[] {
  const vendors = shopVendors(users);
  const q = (filter.q ?? "").trim().toLowerCase();
  return products
    .map((p) => ({ p, vendor: vendors.get(p.ownerEmail) }))
    .filter((x): x is { p: Product; vendor: ShopVendor } => !!x.vendor && x.vendor.open && !x.p.hidden)
    .filter(({ p }) => !filter.category || filter.category === "All" || p.category === filter.category)
    .filter(({ vendor }) => !filter.vendorSlug || vendor.slug === filter.vendorSlug)
    .filter(({ p, vendor }) => !q || `${p.name} ${p.category} ${vendor.business}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.p.stock > 0) - Number(a.p.stock > 0) || b.p.createdAt.localeCompare(a.p.createdAt))
    .map(({ p, vendor }) => ({ ...p, vendor }));
}

// ---------- Cart ----------
export type CartLine = { productId: string; quantity: number; item: ShopItem | null; problem: string | null; subtotal: number };

/** Adds to the cart (or merges with the same product), never more than the stock left. */
export function addToCartList(cart: CartItem[], productId: string, quantity: number, stock: number): CartItem[] {
  const current = cart.find((c) => c.productId === productId)?.quantity ?? 0;
  const next = Math.min(Math.max(0, stock), current + Math.max(0, Math.floor(quantity)));
  if (next <= 0) return cart.filter((c) => c.productId !== productId);
  if (cart.some((c) => c.productId === productId)) {
    return cart.map((c) => (c.productId === productId ? { ...c, quantity: next } : c));
  }
  return [...cart, { productId, quantity: next }];
}

/** Matches cart lines to live shop products and flags anything that can no longer be bought. */
export function resolveCart(cart: CartItem[], products: Product[], users: VendorUser[]): CartLine[] {
  const listed = new Map(shopListing(products, users).map((p) => [p.id, p]));
  return cart.map((c) => {
    const item = listed.get(c.productId) ?? null;
    let problem: string | null = null;
    if (!item) problem = "No longer available";
    else if (item.stock <= 0) problem = "Sold out";
    else if (c.quantity > item.stock) problem = `Only ${item.stock} left`;
    return { productId: c.productId, quantity: c.quantity, item, problem, subtotal: item ? item.price * c.quantity : 0 };
  });
}

export function cartTotal(lines: CartLine[]) {
  return lines.filter((l) => !l.problem).reduce((s, l) => s + l.subtotal, 0);
}

export function cartCount(cart: CartItem[]) {
  return cart.reduce((s, c) => s + c.quantity, 0);
}

/** Cart lines grouped by seller, in the order they were first added. */
export function groupBySeller(lines: CartLine[]) {
  const groups = new Map<string, { vendor: ShopVendor; lines: CartLine[] }>();
  lines.forEach((l) => {
    if (!l.item) return;
    const g = groups.get(l.item.vendor.slug) ?? { vendor: l.item.vendor, lines: [] };
    g.lines.push(l);
    groups.set(l.item.vendor.slug, g);
  });
  return [...groups.values()];
}

/** Checks a shopper's order before it is sent to the vendor. Returns an error message, or null when fine. */
export function validateShopOrder(input: { stock: number; quantity: number; name: string; phone: string }) {
  if (!input.name.trim()) return "Enter your name";
  if (input.phone.replace(/\D/g, "").length < 10) return "Enter a valid phone number so the seller can reach you";
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return "Quantity must be at least 1";
  if (input.stock <= 0) return "This item is sold out";
  if (input.quantity > input.stock) return `Only ${input.stock} left in stock`;
  return null;
}

/** Nigerian numbers to WhatsApp format: 0803… → 234803… */
export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

// ---------- Paystack payments ----------
/** Paystack's smallest online payment is ₦50. */
export const MIN_ONLINE_PAYMENT = 50;

/** Naira to kobo (Paystack works in kobo). */
export function toKobo(naira: number) {
  return Math.round(naira * 100);
}

/** A payment only counts when Paystack says "success" for the exact amount in naira. */
export function paymentMatches(expectedNaira: number, paid: { status: string; amountKobo: number; currency: string }) {
  return paid.status === "success" && paid.currency === "NGN" && paid.amountKobo === toKobo(expectedNaira);
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : "Enter a valid email for your Paystack receipt";
}

// ---------- Old example products ----------
// Earlier versions offered "Load examples". These were not real items, so they are removed from every device.
const SAMPLE_PHOTOS = [
  "photo-1595777457583-95e059d581b8",
  "photo-1601049541289-9b1b7bbbfe19",
  "photo-1584917865442-de89df76afd3",
];
const SAMPLE_NAMES = ["Ankara Wrap Dress", "Shea Butter Glow Cream", "Leather Tote Bag"];

export function isSampleProduct(p: Pick<Product, "name" | "imageUrl">) {
  return SAMPLE_NAMES.includes(p.name) && SAMPLE_PHOTOS.some((id) => p.imageUrl.includes(id));
}
