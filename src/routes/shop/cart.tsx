import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, MessageCircle, Minus, Plus, ShoppingCart, Store, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductImage } from "@/components/ebh/ui-bits";
import { ShopLayout, useCart, useHydrated, useShopData } from "@/components/ebh/shop";
import { cartTotal, formatNaira, groupBySeller, resolveCart, toWhatsAppNumber, type CartLine, type ShopVendor } from "@/lib/business";
import { checkoutCart, removeFromCart, setCartQuantity } from "@/lib/actions";

export const Route = createFileRoute("/shop/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Eminent Business Hub Shop" },
      { name: "description", content: "Review the items in your cart and send your order to each seller in one go." },
      { property: "og:title", content: "Your cart — Eminent Business Hub Shop" },
      { property: "og:description", content: "Order from several Nigerian small businesses with one checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

type Placed = { name: string; phone: string; note: string; groups: { vendor: ShopVendor; lines: CartLine[] }[]; total: number };

function CartPage() {
  const hydrated = useHydrated();
  const cart = useCart();
  const { products, users } = useShopData();
  const lines = useMemo(() => resolveCart(cart, products, users), [cart, products, users]);
  const groups = useMemo(() => groupBySeller(lines), [lines]);
  const missing = lines.filter((l) => !l.item);
  const total = cartTotal(lines);
  const hasProblem = lines.some((l) => l.problem);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [placed, setPlaced] = useState<Placed | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = checkoutCart({ name, phone, note });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPlaced({ name: name.trim(), phone: phone.trim(), note: note.trim(), groups: groupBySeller(res.lines), total: cartTotal(res.lines) });
    toast.success(res.orders.length > 1 ? `${res.orders.length} orders sent` : "Order sent to the seller");
    window.scrollTo({ top: 0 });
  };

  if (!hydrated) {
    return (
      <ShopLayout>
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />)}
        </div>
      </ShopLayout>
    );
  }

  if (placed) return <ShopLayout><OrderSent placed={placed} /></ShopLayout>;

  return (
    <ShopLayout>
      <Link to="/shop" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy">
        <ArrowLeft className="h-4 w-4" /> Continue shopping
      </Link>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-extrabold">
        <ShoppingCart className="h-6 w-6 text-navy" /> Your cart
      </h1>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gold-soft text-navy">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <h2 className="mt-3 font-bold">Your cart is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tap "Add to cart" on any product to save it here.</p>
          <Button asChild className="mt-4 bg-gold text-navy hover:bg-gold/90">
            <Link to="/shop">Browse the shop</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.vendor.slug} className="rounded-2xl border bg-card shadow-card">
                <Link
                  to="/shop/store/$vendor"
                  params={{ vendor: g.vendor.slug }}
                  className="flex items-center gap-2 border-b px-4 py-3 text-sm font-bold"
                >
                  <Store className="h-4 w-4 text-navy" /> {g.vendor.business}
                </Link>
                <ul className="divide-y">
                  {g.lines.map((l) => <CartRow key={l.productId} line={l} />)}
                </ul>
              </section>
            ))}
            {missing.length ? (
              <section className="rounded-2xl border border-destructive/30 bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {missing.length} item{missing.length > 1 ? "s are" : " is"} no longer available
                </div>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => missing.forEach((m) => removeFromCart(m.productId))}>
                  Remove {missing.length > 1 ? "them" : "it"}
                </Button>
              </section>
            ) : null}
          </div>

          <form onSubmit={submit} className="h-fit space-y-3 rounded-2xl border bg-card p-4 shadow-card lg:sticky lg:top-20">
            <h2 className="font-bold">Your details</h2>
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Your name</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone / WhatsApp number</Label>
              <Input id="c-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" autoComplete="tel" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-note">Delivery address or message (optional)</Label>
              <Textarea id="c-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rumuola, Port Harcourt" />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold text-navy">{formatNaira(total)}</span>
            </div>
            {groups.length > 1 ? (
              <p className="text-xs text-muted-foreground">Your order goes to {groups.length} sellers. Each one will contact you.</p>
            ) : null}
            <div className="flex items-start gap-2 rounded-xl bg-gold-soft p-3 text-xs text-navy">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
              No payment now. Sellers contact you to arrange transfer or pay-on-delivery.
            </div>
            <Button type="submit" disabled={hasProblem} className="h-12 w-full bg-gold text-base font-bold text-navy hover:bg-gold/90">
              Place order • {formatNaira(total)}
            </Button>
            {hasProblem ? <p className="text-center text-xs text-destructive">Fix the items marked in red first.</p> : null}
          </form>
        </div>
      )}
    </ShopLayout>
  );
}

function CartRow({ line }: { line: CartLine }) {
  const item = line.item!;
  const max = Math.max(1, item.stock);
  return (
    <li className="flex gap-3 p-3">
      <Link to="/shop/$productId" params={{ productId: item.id }} className="shrink-0">
        <ProductImage src={item.imageUrl} alt={item.name} className="h-20 w-20 rounded-xl border" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to="/shop/$productId" params={{ productId: item.id }} className="line-clamp-2 text-sm font-bold leading-snug">
          {item.name}
        </Link>
        <div className="text-xs text-muted-foreground">{formatNaira(item.price)} each</div>
        {line.problem ? (
          <div className="mt-1 text-xs font-bold text-destructive">{line.problem}</div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={`Less ${item.name}`} onClick={() => setCartQuantity(item.id, line.quantity - 1)}>
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-7 text-center text-sm font-bold">{line.quantity}</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label={`More ${item.name}`}
              disabled={line.quantity >= item.stock}
              onClick={() => setCartQuantity(item.id, Math.min(max, line.quantity + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {line.quantity > item.stock && item.stock > 0 ? (
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCartQuantity(item.id, item.stock)}>
                Set to {item.stock}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <span className="font-display text-sm font-bold text-navy">{formatNaira(line.subtotal)}</span>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Remove ${item.name}`} onClick={() => removeFromCart(item.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function OrderSent({ placed }: { placed: Placed }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-success/30 bg-success-soft p-5">
      <div className="flex items-center gap-2 text-lg font-bold text-success">
        <CheckCircle2 className="h-6 w-6" /> Order sent!
      </div>
      <p className="mt-2 text-sm">
        Total <b>{formatNaira(placed.total)}</b>. {placed.groups.length > 1 ? "Each seller" : "The seller"} will contact you on <b>{placed.phone}</b> to confirm payment and delivery.
      </p>
      <div className="mt-4 space-y-3">
        {placed.groups.map((g) => {
          const items = g.lines.map((l) => `${l.item!.name} x${l.quantity}`).join(", ");
          const sum = g.lines.reduce((s, l) => s + l.subtotal, 0);
          const text = `Hello ${g.vendor.business}, I just ordered ${items} (${formatNaira(sum)}) on Eminent Business Hub. My name is ${placed.name}, phone ${placed.phone}.${placed.note ? ` Delivery: ${placed.note}` : ""}`;
          return (
            <div key={g.vendor.slug} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-bold"><Store className="h-4 w-4 text-navy" /> {g.vendor.business}</div>
              <div className="mt-1 text-xs text-muted-foreground">{items} • {formatNaira(sum)}</div>
              {g.vendor.phone ? (
                <Button asChild size="sm" className="mt-2 bg-gold text-navy hover:bg-gold/90">
                  <a href={`https://wa.me/${toWhatsAppNumber(g.vendor.phone)}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" /> Message on WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button asChild variant="outline" className="mt-4 w-full">
        <Link to="/shop">Continue shopping</Link>
      </Button>
    </div>
  );
}
