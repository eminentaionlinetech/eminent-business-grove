// Server-only Paystack helper. Calls go through Lovable's connector gateway with the owner's Paystack key.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_paystack";

export function paystackConfigured() {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["UDC_PAYSTACK_API_KEY"]);
}

export async function paystackFetch<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const paystackKey = process.env["UDC_PAYSTACK_API_KEY"];
  if (!lovableKey || !paystackKey) {
    return { ok: false as const, status: 503, error: "Paystack is not connected yet" };
  }
  const request: RequestInit = {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": paystackKey,
      "Content-Type": "application/json",
    },
  };
  if (init?.body !== undefined) request.body = JSON.stringify(init.body);
  const res = await fetch(`${GATEWAY_URL}${path}`, request);
  const text = await res.text();
  let json: { status?: boolean; message?: string; data?: T } = {};
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  if (!res.ok || json.status === false) {
    console.error(`Paystack request failed [${res.status}] ${path}: ${text.slice(0, 500)}`);
    return { ok: false as const, status: res.status, error: json.message || `Paystack error ${res.status}` };
  }
  return { ok: true as const, data: json.data as T };
}
