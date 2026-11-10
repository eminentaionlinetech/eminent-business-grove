import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { paystackConfigured, paystackFetch } from "./paystack.server";

const referenceSchema = z.string().regex(/^[A-Za-z0-9_.=-]{6,100}$/);

/** Is the owner's Paystack account connected? Safe to call from any page. */
export const getPaystackStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: paystackConfigured() };
});

/** Starts a Paystack payment into the owner's account and returns the Paystack payment page link. */
export const startPaystackPayment = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        amountKobo: z.number().int().min(5000).max(10_000_000_000),
        reference: referenceSchema,
        customerName: z.string().trim().min(1).max(120),
        customerPhone: z.string().trim().min(6).max(40),
        items: z.string().max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const origin = new URL(getRequest().url).origin;
    const res = await paystackFetch<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: {
        email: data.email,
        amount: data.amountKobo,
        currency: "NGN",
        reference: data.reference,
        callback_url: `${origin}/shop/payment`,
        metadata: {
          custom_fields: [
            { display_name: "Customer", variable_name: "customer", value: data.customerName },
            { display_name: "Phone", variable_name: "phone", value: data.customerPhone },
            { display_name: "Items", variable_name: "items", value: data.items },
          ],
        },
      },
    });
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const, url: res.data.authorization_url };
  });

/** Asks Paystack whether a payment really went through. */
export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reference: referenceSchema }).parse(input))
  .handler(async ({ data }) => {
    const res = await paystackFetch<{ status: string; amount: number; currency: string; paid_at: string | null; reference: string }>(
      `/transaction/verify/${encodeURIComponent(data.reference)}`,
    );
    if (!res.ok) return { ok: false as const, error: res.error };
    return {
      ok: true as const,
      status: res.data.status,
      amountKobo: res.data.amount,
      currency: res.data.currency,
      paidAt: res.data.paid_at,
      reference: res.data.reference,
    };
  });
