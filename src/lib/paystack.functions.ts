import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { MIN_ONLINE_PAYMENT, paymentBase, paymentMatches, toKobo } from "./business";
import { paystackConfigured, paystackFetch } from "./paystack.server";

const referenceSchema = z.string().regex(/^[A-Za-z0-9_.=-]{6,100}$/);

/** The unpaid shop orders of one checkout, read on the server so the amount can't be changed by the browser. */
async function checkoutOrders(reference: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, total, payment_status, customer_name, customer_phone, product_name, quantity")
    .eq("payment_ref", paymentBase(reference))
    .eq("source", "shop");
  if (error) throw error;
  return { supabaseAdmin, orders: data ?? [] };
}

/** Is the owner's Paystack account connected? Safe to call from any page. */
export const getPaystackStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: paystackConfigured() };
});

/** Starts a Paystack payment into the owner's account for the orders of one checkout. */
export const startPaystackPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().trim().email().max(200), reference: referenceSchema }).parse(input))
  .handler(async ({ data }) => {
    const { orders } = await checkoutOrders(data.reference);
    if (!orders.length) return { ok: false as const, error: "Order not found" };
    if (orders.every((o) => o.payment_status === "paid")) return { ok: false as const, error: "This order is already paid" };
    const amount = orders.reduce((s, o) => s + Number(o.total), 0);
    if (amount < MIN_ONLINE_PAYMENT) return { ok: false as const, error: "Amount too small for online payment" };
    const origin = new URL(getRequest().url).origin;
    const items = orders.map((o) => `${o.product_name} x${o.quantity}`).join(", ").slice(0, 1000);
    const res = await paystackFetch<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: {
        email: data.email,
        amount: toKobo(amount),
        currency: "NGN",
        reference: data.reference,
        callback_url: `${origin}/shop/payment`,
        metadata: {
          custom_fields: [
            { display_name: "Customer", variable_name: "customer", value: orders[0]!.customer_name },
            { display_name: "Phone", variable_name: "phone", value: orders[0]!.customer_phone },
            { display_name: "Items", variable_name: "items", value: items },
          ],
        },
      },
    });
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const, url: res.data.authorization_url };
  });

/** Asks Paystack whether a payment really went through; if the exact amount was paid, marks the orders paid. */
export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reference: referenceSchema }).parse(input))
  .handler(async ({ data }) => {
    const res = await paystackFetch<{ status: string; amount: number; currency: string; paid_at: string | null; reference: string }>(
      `/transaction/verify/${encodeURIComponent(data.reference)}`,
    );
    if (!res.ok) return { ok: false as const, error: res.error };
    const { supabaseAdmin, orders } = await checkoutOrders(data.reference);
    const amount = orders.reduce((s, o) => s + Number(o.total), 0);
    const already = orders.length > 0 && orders.every((o) => o.payment_status === "paid");
    const matches = orders.length > 0 && paymentMatches(amount, { status: res.data.status, amountKobo: res.data.amount, currency: res.data.currency });
    if (matches && !already) {
      const { error } = await supabaseAdmin.from("orders").update({ payment_status: "paid" }).eq("payment_ref", paymentBase(data.reference)).eq("source", "shop");
      if (error) {
        console.error("Could not mark orders paid", error);
        return { ok: false as const, error: "Payment received but the order could not be updated. Contact the seller." };
      }
    }
    return {
      ok: true as const,
      status: res.data.status,
      paid: matches || already,
      amount,
      amountKobo: res.data.amount,
      found: orders.length > 0,
    };
  });
