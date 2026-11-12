// Moves products, orders and customers saved on this phone by the older version into the seller's online account. Runs once per account.
import { supabase } from "@/integrations/supabase/client";
import { isSampleProduct } from "./business";
import { LEGACY, readJson } from "./storage";

type OldProduct = { id: string; ownerEmail: string; name: string; price: number; stock: number; imageUrl: string; category: string; description?: string; hidden?: boolean };
type OldOrder = {
  id: string; ownerEmail: string; customerName: string; customerPhone: string; productId: string; productName: string;
  quantity: number; total: number; status: string; createdAt: string; note?: string;
};
type OldCustomer = { ownerEmail: string; name: string; phone: string; email: string; createdAt: string };

export async function moveLocalDataOnline(session: { id: string; email: string }) {
  const flag = `ebh_moved_online_${session.email}`;
  if (localStorage.getItem(flag)) return;
  const mine = <T extends { ownerEmail: string }>(list: T[]) => list.filter((x) => x.ownerEmail === session.email);
  const products = mine(readJson<OldProduct[]>(LEGACY.products, [])).filter((p) => !isSampleProduct(p));
  const orders = mine(readJson<OldOrder[]>(LEGACY.orders, []));
  const customers = mine(readJson<OldCustomer[]>(LEGACY.customers, []));
  if (!products.length && !orders.length && !customers.length) {
    localStorage.setItem(flag, "1");
    return;
  }

  const ids = new Map<string, string>();
  for (const p of products) {
    const id = crypto.randomUUID();
    ids.set(p.id, id);
    const isUpload = p.imageUrl?.startsWith("data:image/");
    const { error } = await supabase.from("products").insert({
      id,
      owner_id: session.id,
      name: (p.name || "Product").slice(0, 120),
      price: Math.max(0, Number(p.price) || 0),
      stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
      image_url: isUpload ? `photo:${id}` : (p.imageUrl || "").slice(0, 2048),
      category: (p.category || "Other").slice(0, 60),
      description: (p.description || "").slice(0, 2000),
      hidden: !!p.hidden,
    });
    if (error) throw error;
    if (isUpload) await supabase.from("product_photos").insert({ product_id: id, data: p.imageUrl });
  }
  if (orders.length) {
    const { error } = await supabase.from("orders").insert(
      orders.map((o) => ({
        owner_id: session.id,
        customer_name: (o.customerName || "Customer").slice(0, 120),
        customer_phone: (o.customerPhone || "").slice(0, 40),
        product_id: ids.get(o.productId) ?? crypto.randomUUID(),
        product_name: (o.productName || "Product").slice(0, 120),
        quantity: Math.max(1, Math.floor(o.quantity) || 1),
        total: Math.max(0, Number(o.total) || 0),
        status: ["Pending", "Completed", "Cancelled"].includes(o.status) ? o.status : "Pending",
        note: o.note ? o.note.slice(0, 500) : null,
        created_at: o.createdAt,
      })),
    );
    if (error) throw error;
  }
  if (customers.length) {
    const { error } = await supabase.from("customers").insert(
      customers.map((c) => ({
        owner_id: session.id,
        name: (c.name || "Customer").slice(0, 120),
        phone: (c.phone || "").slice(0, 40),
        email: (c.email || "").slice(0, 200),
        created_at: c.createdAt,
      })),
    );
    if (error) throw error;
  }
  localStorage.setItem(flag, "1");
}
