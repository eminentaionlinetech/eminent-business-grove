import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Minus, Plus, ShoppingCart, Store, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ProductImage, StockBadge } from "@/components/ebh/ui-bits";
import { ShopCard, ShopLayout, useCart, useHydrated, useShopData } from "@/components/ebh/shop";
import { formatNaira, shopListing, toWhatsAppNumber } from "@/lib/business";
import { addToCart } from "@/lib/actions";

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
  return <ProductView key={productId} productId={productId} />;
}

function ProductView({ productId }: { productId: string }) {
  const hydrated = useHydrated();
  const { products, users } = useShopData();
  const all = useMemo(() => shopListing(products, users), [products, users]);
  const item = all.find((p) => p.id === productId);
  const more = item ? all.filter((p) => p.id !== item.id && p.vendor.slug === item.vendor.slug).slice(0, 4) : [];

  const cart = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const inCart = cart.find((c) => c.productId === productId)?.quantity ?? 0;

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
  const canAdd = Math.max(0, item.stock - inCart);
  const total = item.price * qty;

  const add = (goToCart: boolean) => {
    const res = addToCart(item.id, qty);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.capped) toast.info(`Only ${item.stock} in stock — your cart has ${res.quantity}`);
    else if (!goToCart) toast.success(`Added to cart (${res.quantity})`, { action: { label: "View cart", onClick: () => navigate({ to: "/shop/cart" }) } });
    setQty(1);
    if (goToCart) navigate({ to: "/shop/cart" });
  };

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

          {item.description ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/85">{item.description}</p>
          ) : null}

          {soldOut ? (
            <div className="mt-5 rounded-2xl border bg-secondary p-5 text-sm">
              <b>Sold out.</b> Check back soon or see other products from this seller.
            </div>
          ) : (
            <div className="mt-5 space-y-3 rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <Label>Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" aria-label="Less" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold" aria-label="Quantity">{qty}</span>
                  <Button type="button" size="icon" variant="outline" aria-label="More" onClick={() => setQty((n) => Math.min(Math.max(1, canAdd), n + 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {inCart ? (
                <Link to="/shop/cart" className="block rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-navy">
                  {inCart} already in your cart — view cart
                </Link>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-12 border-navy text-navy" disabled={canAdd <= 0} onClick={() => add(false)}>
                  <ShoppingCart className="h-4 w-4" /> Add to cart
                </Button>
                <Button type="button" className="h-12 bg-gold font-bold text-navy hover:bg-gold/90" disabled={canAdd <= 0 && inCart <= 0} onClick={() => (canAdd > 0 ? add(true) : navigate({ to: "/shop/cart" }))}>
                  <Zap className="h-4 w-4" /> Buy now
                </Button>
              </div>
              <div className="text-center text-xs text-muted-foreground">Total for {qty}: <b className="text-navy">{formatNaira(total)}</b></div>
              <div className="flex items-start gap-2 rounded-xl bg-gold-soft p-3 text-xs text-navy">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                No payment now. The seller will contact you to arrange transfer or pay-on-delivery. Online card payment is coming soon.
              </div>
            </div>
          )}

          {item.vendor.phone ? (
            <Button asChild variant="ghost" className="mt-3 w-full text-navy">
              <a
                href={`https://wa.me/${toWhatsAppNumber(item.vendor.phone)}?text=${encodeURIComponent(`Hello ${item.vendor.business}, I'm interested in ${item.name} (${formatNaira(item.price)}) on Eminent Business Hub.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" /> Ask the seller on WhatsApp
              </a>
            </Button>
          ) : null}
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
