// Mutations that touch several collections at once (orders change stock, etc.).
import { applyStock, stockDelta, validateShopOrder } from "./business";
import {
  KEYS,
  getCustomers,
  getOrders,
  getProducts,
  getUsers,
  notify,
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

/** Adds a few real-looking starter products so a new shop isn't empty. */
export function addStarterProducts(ownerEmail: string) {
  const now = new Date().toISOString();
  const starter: Product[] = [
    { name: "Ankara Wrap Dress", price: 18500, stock: 12, category: "Fashion", imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=70" },
    { name: "Shea Butter Glow Cream", price: 6500, stock: 4, category: "Beauty", imageUrl: "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=600&q=70" },
    { name: "Leather Tote Bag", price: 24000, stock: 7, category: "Shoes & Bags", imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=70" },
  ].map((p) => ({ ...p, id: uid("prd"), ownerEmail, createdAt: now }));
  setProducts([...starter, ...getProducts()]);
}

/** A shopper buys from the public shop: checks stock, then sends a Pending order to the vendor. */
export function placeShopOrder(input: { productId: string; quantity: number; name: string; phone: string; note: string }) {
  const product = getProducts().find((p) => p.id === input.productId);
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
