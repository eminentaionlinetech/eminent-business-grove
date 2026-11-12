// Loads the online data into memory and keeps it fresh (live updates + when the app comes back to the screen).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { db, notify, setDb, type AppUser, type Customer, type EmailLog, type Order, type Product } from "./storage";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export const toProduct = (r: Row<"products">): Product => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  price: Number(r.price),
  stock: r.stock,
  imageUrl: r.image_url,
  category: r.category,
  createdAt: r.created_at,
  description: r.description || undefined,
  hidden: r.hidden,
});

export const toOrder = (r: Row<"orders">): Order => ({
  id: r.id,
  ownerId: r.owner_id,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  productId: r.product_id,
  productName: r.product_name,
  quantity: r.quantity,
  total: Number(r.total),
  status: r.status as Order["status"],
  createdAt: r.created_at,
  note: r.note ?? undefined,
  source: r.source as Order["source"],
  paymentStatus: (r.payment_status as Order["paymentStatus"]) ?? undefined,
  paymentRef: r.payment_ref ?? undefined,
});

const toCustomer = (r: Row<"customers">): Customer => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  createdAt: r.created_at,
});

const toLog = (r: Row<"email_logs">): EmailLog => ({
  id: r.id,
  to: r.to_email,
  kind: r.kind as EmailLog["kind"],
  status: r.status as EmailLog["status"],
  detail: r.detail,
  createdAt: r.created_at,
});

/** Reads every row (the server sends at most 1000 at a time). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Who is signed in, as far as the data loader needs to know. */
let viewer: { id: string; email: string; isAdmin: boolean } | null = null;
export function setViewer(v: typeof viewer) {
  viewer = v;
}

export async function loadShop() {
  const [products, profiles, settings] = await Promise.all([
    fetchAll((a, b) => supabase.from("products").select("*").order("created_at", { ascending: false }).range(a, b)),
    fetchAll((a, b) => supabase.from("profiles").select("*").order("created_at", { ascending: true }).range(a, b)),
    supabase.from("email_settings").select("*").maybeSingle(),
  ]);
  const emails = new Map(db.users.map((u) => [u.id, u.email]));
  const roles = new Map(db.users.map((u) => [u.id, u.role]));
  if (viewer) {
    emails.set(viewer.id, viewer.email);
    roles.set(viewer.id, viewer.isAdmin ? "admin" : "user");
  }
  const users: AppUser[] = profiles.map((p) => ({
    id: p.id,
    email: emails.get(p.id) ?? "",
    business: p.business,
    phone: p.phone,
    role: roles.get(p.id) ?? "user",
    createdAt: p.created_at,
    shopOpen: p.shop_open,
    shopBio: p.shop_bio,
  }));
  const s = settings.data;
  setDb({
    products: products.map(toProduct),
    users,
    emailConfig: s ? { publicKey: s.public_key, serviceId: s.service_id, templateId: s.template_id, replyTo: s.reply_to } : {},
    shopLoaded: true,
  });
}

export async function loadPrivate() {
  if (!viewer) {
    setDb({ orders: [], customers: [], emailLogs: [], privateLoaded: false });
    return;
  }
  const [orders, customers] = await Promise.all([
    fetchAll((a, b) => supabase.from("orders").select("*").order("created_at", { ascending: false }).range(a, b)),
    fetchAll((a, b) => supabase.from("customers").select("*").order("created_at", { ascending: false }).range(a, b)),
  ]);
  let emailLogs: EmailLog[] = [];
  if (viewer.isAdmin) {
    const [logs, accounts] = await Promise.all([
      supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.rpc("admin_list_users"),
    ]);
    emailLogs = (logs.data ?? []).map(toLog);
    const emails = new Map((accounts.data ?? []).map((a) => [a.id, a.email]));
    const admins = new Set<string>([viewer.id]);
    db.users = db.users.map((u) => ({ ...u, email: emails.get(u.id) ?? u.email, role: admins.has(u.id) || u.role === "admin" ? "admin" : "user" }));
  }
  setDb({ orders: orders.map(toOrder), customers: customers.map(toCustomer), emailLogs, privateLoaded: true });
}

export async function refreshAll() {
  try {
    await loadShop();
    await loadPrivate();
  } catch (e) {
    console.error("Could not load data", e);
  }
}

// ---------- Live updates ----------
let channel: ReturnType<typeof supabase.channel> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
function soon(fn: () => Promise<unknown>) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    fn().catch((e) => console.error(e));
  }, 400);
}

export function startLiveUpdates() {
  if (channel || typeof window === "undefined") return;
  channel = supabase
    .channel(`ebh-live-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => soon(refreshAll))
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => soon(refreshAll))
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => soon(refreshAll))
    .subscribe();
  const onVisible = () => {
    if (document.visibilityState === "visible") soon(refreshAll);
  };
  document.addEventListener("visibilitychange", onVisible);
}

// ---------- Product photos (loaded only when shown, many at once) ----------
const photos = new Map<string, string | null>();
const waiting = new Set<string>();
let batch: ReturnType<typeof setTimeout> | null = null;

export function photoIdOf(src: string) {
  return src.startsWith("photo:") ? src.slice(6) : null;
}

export function getPhoto(productId: string) {
  return photos.get(productId);
}

export function setPhoto(productId: string, data: string | null) {
  photos.set(productId, data);
  notify();
}

export function requestPhoto(productId: string) {
  if (photos.has(productId) || waiting.has(productId)) return;
  waiting.add(productId);
  scheduleBatch();
}

function scheduleBatch() {
  if (batch) return;
  batch = setTimeout(async () => {
    batch = null;
    const ids = [...waiting].slice(0, 100);
    ids.forEach((id) => waiting.delete(id));
    const { data } = await supabase.from("product_photos").select("product_id, data").in("product_id", ids);
    const found = new Map((data ?? []).map((r) => [r.product_id, r.data]));
    ids.forEach((id) => photos.set(id, found.get(id) ?? null));
    notify();
    if (waiting.size) scheduleBatch();
  }, 30);
}
