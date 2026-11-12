// Everything that changes data. Online data goes to Lovable Cloud, then the in-memory copy is refreshed.
import { supabase } from "@/integrations/supabase/client";
import {
  MIN_ONLINE_PAYMENT,
  addToCartList,
  cartTotal,
  formatNaira,
  resolveCart,
  retryReference,
  shopListing,
  stockDelta,
  validateEmail,
  validateShopOrder,
} from "./business";
import { loadPrivate, loadShop, refreshAll, setPhoto, toOrder } from "./cloud";
import {
  getCart,
  getCustomers,
  getOrders,
  getProducts,
  getUsers,
  setCart,
  setPendingPayment,
  uid,
  type Order,
  type OrderStatus,
  type PendingPayment,
  type Product,
} from "./storage";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown, fallback = "Something went wrong. Check your internet and try again."): { ok: false; error: string } {
  const msg = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/network|fetch/i.test(msg)) return { ok: false, error: "No internet connection. Check your data and try again." };
  // Database messages raised on purpose are already written for shoppers.
  if (msg && !/violates|permission|policy|syntax|relation|column|uuid/i.test(msg)) return { ok: false, error: msg };
  return { ok: false, error: fallback };
}

// ---------- Products ----------
export async function saveProduct(input: Omit<Product, "id" | "createdAt"> & { id?: string | undefined }): Promise<Result> {
  const id = input.id ?? crypto.randomUUID();
  const upload = input.imageUrl.startsWith("data:image/") ? input.imageUrl : null;
  const row = {
    name: input.name.slice(0, 120),
    price: input.price,
    stock: input.stock,
    image_url: upload ? `photo:${id}` : input.imageUrl.slice(0, 2048),
    category: input.category,
    description: (input.description ?? "").slice(0, 2000),
    hidden: !!input.hidden,
  };
  const res = input.id
    ? await supabase.from("products").update(row).eq("id", id)
    : await supabase.from("products").insert({ ...row, id, owner_id: input.ownerId });
  if (res.error) return fail(res.error, "Could not save this product. Try again.");
  if (upload) {
    const photo = await supabase.from("product_photos").upsert({ product_id: id, data: upload, updated_at: new Date().toISOString() });
    if (photo.error) return fail(photo.error, "The product was saved but the photo could not be uploaded. Try a smaller photo.");
    setPhoto(id, upload);
  } else if (input.id) {
    await supabase.from("product_photos").delete().eq("product_id", id);
  }
  await loadShop();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<Result> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return fail(error);
  await loadShop();
  return { ok: true };
}

export async function setProductHidden(id: string, hidden: boolean): Promise<Result> {
  const { error } = await supabase.from("products").update({ hidden }).eq("id", id);
  if (error) return fail(error);
  await loadShop();
  return { ok: true };
}

async function changeStock(productId: string, delta: number) {
  if (!delta) return;
  const p = getProducts().find((x) => x.id === productId);
  if (!p) return;
  await supabase.from("products").update({ stock: Math.max(0, p.stock + delta) }).eq("id", productId);
}

// ---------- Orders (recorded by the seller) ----------
export async function createOrder(input: {
  ownerId: string;
  customerName: string;
  customerPhone: string;
  productId: string;
  quantity: number;
  total: number;
  status: OrderStatus;
}): Promise<Result<{ order: Order }>> {
  const product = getProducts().find((p) => p.id === input.productId);
  const { data, error } = await supabase
    .from("orders")
    .insert({
      owner_id: input.ownerId,
      customer_name: input.customerName.trim().slice(0, 120),
      customer_phone: input.customerPhone.trim().slice(0, 40),
      product_id: input.productId,
      product_name: (product?.name ?? "Product").slice(0, 120),
      quantity: input.quantity,
      total: input.total,
      status: input.status,
      source: "manual",
    })
    .select()
    .single();
  if (error || !data) return fail(error, "Could not save this order. Try again.");
  await changeStock(input.productId, stockDelta(null, input.status, input.quantity));
  // Remember the customer for next time.
  const name = input.customerName.trim();
  const exists = getCustomers().some((c) => c.ownerId === input.ownerId && c.name.trim().toLowerCase() === name.toLowerCase());
  if (!exists && name) {
    await supabase.from("customers").insert({ owner_id: input.ownerId, name: name.slice(0, 120), phone: input.customerPhone.trim().slice(0, 40) });
  }
  await refreshAll();
  return { ok: true, order: toOrder(data) };
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Result> {
  const order = getOrders().find((o) => o.id === id);
  if (!order || order.status === status) return { ok: true };
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) return fail(error);
  await changeStock(order.productId, stockDelta(order.status, status, order.quantity));
  await refreshAll();
  return { ok: true };
}

export async function deleteOrder(id: string): Promise<Result> {
  const order = getOrders().find((o) => o.id === id);
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return fail(error);
  if (order) await changeStock(order.productId, stockDelta(order.status, "Cancelled", order.quantity));
  await refreshAll();
  return { ok: true };
}

// ---------- Customers ----------
export async function saveCustomer(input: { ownerId: string; name: string; phone: string; email: string }): Promise<Result> {
  const { error } = await supabase.from("customers").insert({
    owner_id: input.ownerId,
    name: input.name.slice(0, 120),
    phone: input.phone.slice(0, 40),
    email: input.email.slice(0, 200),
  });
  if (error) return fail(error);
  await loadPrivate();
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<Result> {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return fail(error);
  await loadPrivate();
  return { ok: true };
}

// ---------- Profile & shop settings ----------
export async function updateProfile(
  userId: string,
  currentEmail: string,
  next: { business: string; phone: string; email: string },
): Promise<Result<{ emailPending: boolean }>> {
  const { error } = await supabase
    .from("profiles")
    .update({ business: next.business.slice(0, 120), phone: next.phone.slice(0, 40) })
    .eq("id", userId);
  if (error) return fail(error);
  localStorage.setItem("ebh_business", next.business);
  localStorage.setItem("ebh_phone", next.phone);
  const email = next.email.trim().toLowerCase();
  let emailPending = false;
  if (email && email !== currentEmail) {
    const res = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/` });
    if (res.error) return fail(res.error, "Could not change your email.");
    emailPending = true;
  }
  const { reloadSession } = await import("./auth");
  await reloadSession();
  return { ok: true, emailPending };
}

export async function updateShopSettings(userId: string, next: { shopOpen?: boolean; shopBio?: string }): Promise<Result> {
  const patch: { shop_open?: boolean; shop_bio?: string } = {};
  if (next.shopOpen !== undefined) patch.shop_open = next.shopOpen;
  if (next.shopBio !== undefined) patch.shop_bio = next.shopBio.slice(0, 300);
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) return fail(error);
  await loadShop();
  return { ok: true };
}

// ---------- Cart (shopper's phone) ----------
export function addToCart(productId: string, quantity: number) {
  const product = shopListing(getProducts(), getUsers()).find((p) => p.id === productId);
  if (!product) return { ok: false as const, error: "This product is no longer available" };
  if (product.stock <= 0) return { ok: false as const, error: "This item is sold out" };
  const before = getCart().find((c) => c.productId === productId)?.quantity ?? 0;
  const next = addToCartList(getCart(), productId, quantity, product.stock);
  setCart(next);
  const now = next.find((c) => c.productId === productId)?.quantity ?? 0;
  return { ok: true as const, quantity: now, capped: now < before + quantity };
}

export function setCartQuantity(productId: string, quantity: number) {
  const cart = getCart();
  if (quantity <= 0) setCart(cart.filter((c) => c.productId !== productId));
  else setCart(cart.map((c) => (c.productId === productId ? { ...c, quantity: Math.floor(quantity) } : c)));
}

export function removeFromCart(productId: string) {
  setCart(getCart().filter((c) => c.productId !== productId));
}

export function clearCart() {
  setCart([]);
}

/** One checkout for the whole cart: every item becomes a Pending order for its own seller. All or nothing. */
export async function checkoutCart(input: { name: string; phone: string; note: string; payNow?: { email: string } | undefined }) {
  const lines = resolveCart(getCart(), getProducts(), getUsers());
  if (lines.length === 0) return { ok: false as const, error: "Your cart is empty" };
  const bad = lines.find((l) => l.problem);
  if (bad) return { ok: false as const, error: `${bad.item?.name ?? "An item"}: ${bad.problem}. Fix your cart first.` };
  for (const l of lines) {
    const error = validateShopOrder({ stock: l.item!.stock, quantity: l.quantity, name: input.name, phone: input.phone });
    if (error) return { ok: false as const, error };
  }
  if (input.payNow) {
    const emailError = validateEmail(input.payNow.email);
    if (emailError) return { ok: false as const, error: emailError };
    if (cartTotal(lines) < MIN_ONLINE_PAYMENT) return { ok: false as const, error: `Online payment needs at least ${formatNaira(MIN_ONLINE_PAYMENT)}. Choose pay later.` };
  }
  const reference = input.payNow ? uid("ebh") : null;
  const { data, error } = await supabase.rpc("place_shop_order", {
    _items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    _name: input.name.trim(),
    _phone: input.phone.trim(),
    _note: input.note.trim(),
    _pay_ref: reference as string,
  });
  if (error) {
    await loadShop().catch(() => {});
    return fail(error, "Could not send your order. Check your internet and try again.");
  }
  const orders = (data ?? []).map(toOrder);
  setCart([]);
  let payment: PendingPayment | null = null;
  if (input.payNow && reference) {
    payment = {
      reference,
      attempt: reference,
      orderIds: orders.map((o) => o.id),
      amount: cartTotal(lines),
      email: input.payNow.email.trim(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      items: lines.map((l) => `${l.item!.name} x${l.quantity} (${l.item!.vendor.business})`).join(", ").slice(0, 1000),
      createdAt: new Date().toISOString(),
    };
    setPendingPayment(payment);
  }
  void loadShop().catch(() => {});
  return { ok: true as const, orders, lines, payment };
}

/** Starts a fresh Paystack attempt for orders whose payment did not finish. */
export function retryPayment(payment: PendingPayment) {
  const next = { ...payment, attempt: retryReference(payment.reference), createdAt: new Date().toISOString() };
  setPendingPayment(next);
  return next;
}

/** Called after the server confirmed the payment and marked the orders paid. */
export function markPaymentPaid() {
  setPendingPayment(null);
  void loadPrivate().catch(() => {});
}

/** Shopper gives up on paying online: keep the orders as pay later. */
export function payLaterInstead() {
  setPendingPayment(null);
}
