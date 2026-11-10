// Mutations that touch several collections at once (orders change stock, etc.).
import {
  MIN_ONLINE_PAYMENT,
  addToCartList,
  applyStock,
  cartTotal,
  formatNaira,
  isSampleProduct,
  resolveCart,
  shopListing,
  stockDelta,
  validateEmail,
  validateShopOrder,
} from "./business";
import {
  KEYS,
  setPendingPayment,
  type PendingPayment,
  getCart,
  getCustomers,
  getOrders,
  getProducts,
  getUsers,
  notify,
  setCart,
  setCustomers,
  setOrders,
  setProducts,
  setUsers,
  uid,
  type Order,
  type OrderStatus,
  type Product,
} from "./storage";

export function saveProduct(input: Omit<Product, "id" | "createdAt"> & { id?: string | undefined }) {
  const products = getProducts();
  if (input.id) {
    setProducts(products.map((p) => (p.id === input.id ? { ...p, ...input, id: p.id } : p)));
  } else {
    setProducts([{ ...input, id: uid("prd"), createdAt: new Date().toISOString() }, ...products]);
  }
}

export function deleteProduct(id: string) {
  setProducts(getProducts().filter((p) => p.id !== id));
}

export function createOrder(input: Omit<Order, "id" | "createdAt" | "productName"> & { productName?: string | undefined }) {
  const products = getProducts();
  const product = products.find((p) => p.id === input.productId);
  const order: Order = {
    ...input,
    productName: product?.name ?? input.productName ?? "Product",
    id: uid("ord"),
    createdAt: new Date().toISOString(),
  };
  setProducts(applyStock(products, order.productId, stockDelta(null, order.status, order.quantity)));
  setOrders([order, ...getOrders()]);

  // Remember the customer for next time.
  const customers = getCustomers();
  const exists = customers.some(
    (c) => c.ownerEmail === order.ownerEmail && c.name.trim().toLowerCase() === order.customerName.trim().toLowerCase(),
  );
  if (!exists && order.customerName.trim()) {
    setCustomers([
      { id: uid("cus"), ownerEmail: order.ownerEmail, name: order.customerName.trim(), phone: order.customerPhone, email: "", createdAt: order.createdAt },
      ...customers,
    ]);
  }
  return order;
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === id);
  if (!order || order.status === status) return;
  setProducts(applyStock(getProducts(), order.productId, stockDelta(order.status, status, order.quantity)));
  setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
}

export function deleteOrder(id: string) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === id);
  if (order) setProducts(applyStock(getProducts(), order.productId, stockDelta(order.status, "Cancelled", order.quantity)));
  setOrders(orders.filter((o) => o.id !== id));
}

export function saveCustomer(input: { ownerEmail: string; name: string; phone: string; email: string }) {
  setCustomers([{ ...input, id: uid("cus"), createdAt: new Date().toISOString() }, ...getCustomers()]);
}

export function deleteCustomer(id: string) {
  setCustomers(getCustomers().filter((c) => c.id !== id));
}

/** Deletes a user account and everything they own. */
export function deleteUser(email: string) {
  setUsers(getUsers().filter((u) => u.email !== email));
  setProducts(getProducts().filter((p) => p.ownerEmail !== email));
  setOrders(getOrders().filter((o) => o.ownerEmail !== email));
  setCustomers(getCustomers().filter((c) => c.ownerEmail !== email));
}

export function updateProfile(currentEmail: string, next: { business: string; phone: string; email: string }) {
  const email = next.email.trim().toLowerCase();
  const users = getUsers();
  if (email !== currentEmail && users.some((u) => u.email === email)) {
    return { ok: false as const, error: "Another account already uses this email." };
  }
  setUsers(users.map((u) => (u.email === currentEmail ? { ...u, email, business: next.business, phone: next.phone } : u)));
  if (email !== currentEmail) {
    setProducts(getProducts().map((p) => (p.ownerEmail === currentEmail ? { ...p, ownerEmail: email } : p)));
    setOrders(getOrders().map((o) => (o.ownerEmail === currentEmail ? { ...o, ownerEmail: email } : o)));
    setCustomers(getCustomers().map((c) => (c.ownerEmail === currentEmail ? { ...c, ownerEmail: email } : c)));
  }
  localStorage.setItem(KEYS.email, email);
  localStorage.setItem(KEYS.business, next.business);
  localStorage.setItem(KEYS.phone, next.phone);
  notify();
  return { ok: true as const };
}

/** Removes the old example products (not real items) that earlier versions could load. */
export function removeSampleProducts() {
  const products = getProducts();
  const clean = products.filter((p) => !isSampleProduct(p));
  if (clean.length !== products.length) {
    const removed = new Set(products.filter((p) => isSampleProduct(p)).map((p) => p.id));
    setProducts(clean);
    setCart(getCart().filter((c) => !removed.has(c.productId)));
  }
}

/** A shopper buys from the public shop: checks stock, then sends a Pending order to the vendor. */
export function placeShopOrder(input: { productId: string; quantity: number; name: string; phone: string; note: string }) {
  const product = shopListing(getProducts(), getUsers()).find((p) => p.id === input.productId);
  if (!product) return { ok: false as const, error: "This product is no longer available" };
  const error = validateShopOrder({ stock: product.stock, quantity: input.quantity, name: input.name, phone: input.phone });
  if (error) return { ok: false as const, error };
  const order = createOrder({
    ownerEmail: product.ownerEmail,
    customerName: input.name.trim(),
    customerPhone: input.phone.trim(),
    productId: product.id,
    quantity: input.quantity,
    total: product.price * input.quantity,
    status: "Pending",
    note: input.note.trim() || undefined,
    source: "shop",
  });
  return { ok: true as const, order };
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
export function checkoutCart(input: { name: string; phone: string; note: string; payNow?: { email: string } | undefined }) {
  const lines = resolveCart(getCart(), getProducts(), getUsers());
  if (lines.length === 0) return { ok: false as const, error: "Your cart is empty" };
  const bad = lines.find((l) => l.problem);
  if (bad) return { ok: false as const, error: `${bad.item?.name ?? "An item"}: ${bad.problem}. Fix your cart first.` };
  for (const l of lines) {
    const error = validateShopOrder({ stock: l.item!.stock, quantity: l.quantity, name: input.name, phone: input.phone });
    if (error) return { ok: false as const, error };
  }
  const reference = input.payNow ? uid("ebh") : undefined;
  if (input.payNow) {
    const emailError = validateEmail(input.payNow.email);
    if (emailError) return { ok: false as const, error: emailError };
    if (cartTotal(lines) < MIN_ONLINE_PAYMENT) return { ok: false as const, error: `Online payment needs at least ${formatNaira(MIN_ONLINE_PAYMENT)}. Choose pay later.` };
  }
  const orders = lines.map((l) =>
    createOrder({
      ownerEmail: l.item!.ownerEmail,
      customerName: input.name.trim(),
      customerPhone: input.phone.trim(),
      productId: l.productId,
      quantity: l.quantity,
      total: l.subtotal,
      status: "Pending",
      note: input.note.trim() || undefined,
      source: "shop",
      paymentStatus: "unpaid",
      paymentRef: reference,
    }),
  );
  setCart([]);
  let payment: PendingPayment | null = null;
  if (input.payNow && reference) {
    payment = {
      reference,
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
  return { ok: true as const, orders, lines, payment };
}

/** Starts a fresh Paystack attempt for orders whose payment did not finish. */
export function retryPayment(payment: PendingPayment) {
  const reference = uid("ebh");
  const ids = new Set(payment.orderIds);
  setOrders(getOrders().map((o) => (ids.has(o.id) ? { ...o, paymentRef: reference } : o)));
  const next = { ...payment, reference, createdAt: new Date().toISOString() };
  setPendingPayment(next);
  return next;
}

/** Called only after Paystack confirmed the exact amount: marks every order of that payment as paid. */
export function markPaymentPaid(payment: PendingPayment) {
  const ids = new Set(payment.orderIds);
  setOrders(getOrders().map((o) => (ids.has(o.id) ? { ...o, paymentStatus: "paid", paymentRef: payment.reference } : o)));
  setPendingPayment(null);
}

/** Shopper gives up on paying online: keep the orders as pay later. */
export function payLaterInstead() {
  setPendingPayment(null);
}

// ---------- Seller shop controls ----------
export function setProductHidden(id: string, hidden: boolean) {
  setProducts(getProducts().map((p) => (p.id === id ? { ...p, hidden } : p)));
}

export function updateShopSettings(email: string, next: { shopOpen?: boolean; shopBio?: string }) {
  setUsers(getUsers().map((u) => (u.email === email ? { ...u, ...next } : u)));
}
