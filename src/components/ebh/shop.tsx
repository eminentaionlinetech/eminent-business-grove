import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCollection, useSession } from "@/hooks/use-store";
import { CATEGORIES, formatNaira, shopListing, type ShopItem } from "@/lib/business";
import { KEYS, type AppUser, type Product } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ProductImage, StockBadge } from "./ui-bits";

const noop = () => () => {};
/** false during server render, true once the page is running on the phone. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function useShopData() {
  const products = useCollection<Product>(KEYS.products);
  const users = useCollection<AppUser>(KEYS.users);
  return { products, users };
}

export function ShopLayout({ children }: { children: ReactNode }) {
  const session = useSession();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-sidebar text-sidebar-foreground shadow-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/shop" aria-label="Eminent Business Hub shop home">
            <Logo size="sm" />
          </Link>
          {session ? (
            <Button asChild size="sm" className="bg-gold text-navy hover:bg-gold/90">
              <Link to={session.role === "admin" ? "/admin" : "/dashboard"}>
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
          ) : session === null ? (
            <Button asChild size="sm" className="bg-gold text-navy hover:bg-gold/90">
              <Link to="/">
                <Store className="h-4 w-4" /> Sell on EBH
              </Link>
            </Button>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 md:pt-8">{children}</main>
      <footer className="border-t bg-card px-4 py-6 text-center text-xs text-muted-foreground">
        <span className="font-semibold text-navy">Launch. Grow. Succeed.</span> — Built in Port Harcourt. Trusted across Nigeria.
      </footer>
    </div>
  );
}

export function ShopCard({ item }: { item: ShopItem }) {
  return (
    <Link
      to="/shop/$productId"
      params={{ productId: item.id }}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="relative">
        <ProductImage src={item.imageUrl} alt={item.name} className="aspect-square w-full" />
        {item.stock <= 0 ? (
          <span className="absolute inset-x-0 bottom-0 bg-navy/85 py-1 text-center text-xs font-bold text-primary-foreground">Sold out</span>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <div className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{item.category}</div>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug">{item.name}</h3>
        <div className="font-display text-base font-bold text-navy">{formatNaira(item.price)}</div>
        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Store className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.vendor.business}</span>
        </div>
      </div>
    </Link>
  );
}

export function ShopSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-card">
          <div className="aspect-square animate-pulse bg-secondary" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Search + category chips + product grid. Used by the main shop and each vendor's store. */
export function ShopBrowser({ vendorSlug, emptyAction }: { vendorSlug?: string; emptyAction?: ReactNode }) {
  const hydrated = useHydrated();
  const { products, users } = useShopData();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");

  const scoped = useMemo(() => shopListing(products, users, { vendorSlug }), [products, users, vendorSlug]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [scoped]);
  const cats = ["All", ...CATEGORIES.filter((c) => counts.has(c)), ...[...counts.keys()].filter((c) => !CATEGORIES.includes(c))];
  const list = useMemo(() => shopListing(products, users, { vendorSlug, q, category }), [products, users, vendorSlug, q, category]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products or shops"
          aria-label="Search products or shops"
          className="h-11 rounded-xl bg-card pl-9"
        />
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              category === c ? "border-navy bg-navy text-primary-foreground" : "bg-card text-foreground hover:bg-secondary",
            )}
          >
            {c}
            {c !== "All" ? <span className="ml-1 opacity-60">{counts.get(c)}</span> : null}
          </button>
        ))}
      </div>

      {!hydrated ? (
        <ShopSkeleton />
      ) : scoped.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gold-soft text-navy">
            <Store className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-bold">No products here yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When sellers add products with photos, they will show up here for shoppers to buy.
          </p>
          {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
        </div>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No products match your search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {list.map((item) => (
            <ShopCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export { StockBadge };
