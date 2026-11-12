import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, RefreshCw, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShopLayout, useHydrated } from "@/components/ebh/shop";
import { formatNaira } from "@/lib/business";
import { markPaymentPaid, payLaterInstead, retryPayment } from "@/lib/actions";
import { getPendingPayment } from "@/lib/storage";
import { startPaystackPayment, verifyPaystackPayment } from "@/lib/paystack.functions";

type Search = { reference?: string | undefined };

export const Route = createFileRoute("/shop/payment")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const ref = typeof s["reference"] === "string" ? s["reference"] : typeof s["trxref"] === "string" ? s["trxref"] : undefined;
    return { reference: ref };
  },
  head: () => ({
    meta: [
      { title: "Payment — Eminent Business Hub Shop" },
      { name: "description", content: "Checking your Paystack payment for your Eminent Business Hub order." },
      { property: "og:title", content: "Payment — Eminent Business Hub Shop" },
      { property: "og:description", content: "Secure Paystack payment for orders from Nigerian small businesses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentPage,
});

type State =
  | { kind: "checking" }
  | { kind: "paid"; amount: number }
  | { kind: "unpaid"; message: string }
  | { kind: "none" };

function PaymentPage() {
  const hydrated = useHydrated();
  const { reference } = Route.useSearch();
  const verify = useServerFn(verifyPaystackPayment);
  const start = useServerFn(startPaystackPayment);
  const [state, setState] = useState<State>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!hydrated || ran.current) return;
    ran.current = true;
    const pending = getPendingPayment();
    const ref = reference ?? pending?.attempt;
    if (!ref) {
      setState({ kind: "none" });
      return;
    }
    verify({ data: { reference: ref } })
      .then((res) => {
        if (!res.ok) {
          setState({ kind: "unpaid", message: "We couldn't confirm this payment with Paystack yet." });
          return;
        }
        if (res.paid) {
          markPaymentPaid();
          setState({ kind: "paid", amount: res.amount });
        } else if (res.status === "success") {
          setState({ kind: "unpaid", message: "The amount paid doesn't match your order. Please contact the seller." });
        } else {
          setState({ kind: "unpaid", message: res.status === "abandoned" ? "You didn't finish paying." : `Payment ${res.status}.` });
        }
      })
      .catch(() => setState({ kind: "unpaid", message: "We couldn't reach Paystack. Check your internet and try again." }));
  }, [hydrated, reference, verify]);

  const tryAgain = async () => {
    const pending = getPendingPayment();
    if (!pending) return;
    setBusy(true);
    const next = retryPayment(pending);
    try {
      const res = await start({
        data: { email: next.email, reference: next.attempt },
      });
      if (res.ok) {
        window.location.assign(res.url);
        return;
      }
      setState({ kind: "unpaid", message: res.error });
    } catch {
      setState({ kind: "unpaid", message: "We couldn't reach Paystack. Try again." });
    }
    setBusy(false);
  };

  return (
    <ShopLayout>
      <div className="mx-auto max-w-xl">
        {!hydrated || state.kind === "checking" ? (
          <div className="flex flex-col items-center rounded-2xl border bg-card p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-navy" />
            <p className="mt-3 font-bold">Checking your payment…</p>
          </div>
        ) : state.kind === "paid" ? (
          <div className="rounded-2xl border border-success/30 bg-success-soft p-5">
            <div className="flex items-center gap-2 text-lg font-bold text-success">
              <CheckCircle2 className="h-6 w-6" /> Payment successful
            </div>
            <p className="mt-2 text-sm">
              Paystack confirmed <b>{formatNaira(state.amount)}</b>. Your order is marked as paid and the seller will contact you to arrange delivery.
            </p>
            <Button asChild className="mt-4 w-full bg-gold text-navy hover:bg-gold/90">
              <Link to="/shop">Continue shopping</Link>
            </Button>
          </div>
        ) : state.kind === "unpaid" ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-5">
            <div className="flex items-center gap-2 text-lg font-bold text-destructive">
              <XCircle className="h-6 w-6" /> Payment not completed
            </div>
            <p className="mt-2 text-sm">{state.message} Your order is saved — you can try again or pay the seller later.</p>
            {getPendingPayment() ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button onClick={tryAgain} disabled={busy} className="bg-gold text-navy hover:bg-gold/90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try paying again
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => { payLaterInstead(); setState({ kind: "none" }); }}>
                  <Wallet className="h-4 w-4" /> Pay later instead
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" className="mt-4 w-full"><Link to="/shop">Back to the shop</Link></Button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-5 text-center">
            <p className="font-bold">Your order is saved as pay later</p>
            <p className="mt-1 text-sm text-muted-foreground">The seller will contact you to arrange transfer or pay on delivery.</p>
            <Button asChild className="mt-4 bg-gold text-navy hover:bg-gold/90"><Link to="/shop">Continue shopping</Link></Button>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
