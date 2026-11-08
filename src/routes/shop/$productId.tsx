import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Minus, MessageCircle, Plus, ShoppingBag, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductImage, StockBadge } from "@/components/ebh/ui-bits";
import { ShopCard, ShopLayout, useHydrated, useShopData } from "@/components/ebh/shop";
import { formatNaira, shopListing, toWhatsAppNumber } from "@/lib/business";
import { placeShopOrder } from "@/lib/actions";
import type { Order } from "@/lib/storage";

export const Route = createFileRoute("/shop/$productId")({
  head: () => ({
    meta: [
      { title: "Product — Eminent Business Hub Shop" },
      { name: "description", content: "See photos, price and stock, then order this product straight from the seller." },
      { property: "og:title", content: "Product — Eminent Business Hub Shop" },
      { property: "og:description", content: "Order from a trusted small business in Nigeria." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const hydrated = useHydrated();
  const { products, users } = useShopData();
  const all = useMemo(() => shopListing(products, users), [products, users]);
  const item = all.find((p) => p.id === productId);
  const more = item ? all.filter((p) => p.id !== item.id && p.vendor.slug === item.vendor.slug).slice(0, 4) : [];

  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [placed, setPlaced] = useState<Order | null>(null);

  if (!hydrated) {
    return (
      <ShopLayout>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-secondary" />
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded bg-secondary" />
            <div className="h-8 w-1/3 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      </ShopLayout>
    );
  }

  if (!item) {
    return (
      <ShopLayout>
        <div className="rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-lg font-bold">Product not available</h1>
          <p className="mt-1 text-sm text-muted-foreground">It may have been removed by the seller.</p>
          <Button asChild className="mt-4 bg-gold text-navy hover:bg-gold/90">
            <Link to="/shop">Browse the shop</Link>
          </Button>
        </div>
      </ShopLayout>
    );
  }

  const soldOut = item.stock <= 0;
  const total = item.price * qty;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = placeShopOrder({ productId: item.id, quantity: qty, name, phone, note });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPlaced(res.order);
    toast.success("Order sent to the seller");
  };

  const waText = placed
    ? `Hello ${item.vendor.business}, I just ordered ${placed.productName} x${placed.quantity} (${formatNaira(placed.total)}) on Eminent Business Hub. My name is ${placed.customerName}, phone ${placed.customerPhone}.${placed.note ? ` Delivery: ${placed.note}` : ""}`
    : "";

  return (
    <ShopLayout>
      <Link to="/shop" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy">
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>
      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        <ProductImage src={item.imageUrl} alt={item.name} className="aspect-square w-full rounded-2xl border" />

        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.category}</div>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">{item.name}</h1>
          <div className="mt-2 font-display text-3xl font-bold text-navy">{formatNaira(item.price)}</div>
          <div className="mt-2"><StockBadge stock={item.stock} /></div>

          <Link
            to="/shop/store/$vendor"
            params={{ vendor: item.vendor.slug }}
            className="mt-4 flex items-center gap-3 rounded-xl border bg-card p-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-gold"><Store className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{item.vendor.business}</span>
              <span className="text-xs text-muted-foreground">See all products from this seller</span>
            </span>
          </Link>

          {placed ? (
            <div className="mt-5 rounded-2xl border border-success/30 bg-success-soft p-5">
              <div className="flex items-center gap-2 font-bold text-success">
                <CheckCircle2 className="h-5 w-5" /> Order sent!
              </div>
              <p className="mt-2 text-sm">
                {item.vendor.business} has your order for <b>{placed.productName} × {placed.quantity}</b> ({formatNaira(placed.total)}).
                They will contact you on <b>{placed.customerPhone}</b> to confirm payment and delivery.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {item.vendor.phone ? (
                  <Button asChild className="bg-gold text-navy hover:bg-gold/90">
                    <a href={`https://wa.me/${toWhatsAppNumber(item.vendor.phone)}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4" /> Message seller on WhatsApp
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <Link to="/shop">Continue shopping</Link>
                </Button>
              </div>
            </div>
          ) : soldOut ? (
            <div className="mt-5 rounded-2xl border bg-secondary p-5 text-sm">
              <b>Sold out.</b> Check back soon or see other products from this seller.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3 rounded-2xl border bg-card p-4 shadow-card">
              <h2 className="flex items-center gap-2 font-bold"><ShoppingBag className="h-4 w-4 text-navy" /> Buy this item</h2>
              <div className="flex items-center justify-between gap-3">
                <Label>Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" aria-label="Less" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold" aria-label="Quantity">{qty}</span>
                  <Button type="button" size="icon" variant="outline" aria-label="More" onClick={() => setQty((n) => Math.min(item.stock, n + 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-name">Your name</Label>
                <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-phone">Phone / WhatsApp number</Label>
                <Input id="b-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" autoComplete="tel" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-note">Delivery address or message (optional)</Label>
                <Textarea id="b-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rumuola, Port Harcourt" />
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-gold-soft p-3 text-xs text-navy">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                No payment now. The seller will contact you to arrange transfer or pay-on-delivery. Online card payment is coming soon.
              </div>
              <Button type="submit" className="h-12 w-full bg-gold text-base font-bold text-navy hover:bg-gold/90">
                Place order • {formatNaira(total)}
              </Button>
            </form>
          )}
        </div>
      </div>

      {more.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">More from {item.vendor.business}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {more.map((p) => <ShopCard key={p.id} item={p} />)}
          </div>
        </section>
      ) : null}
    </ShopLayout>
  );
}
