import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, ExternalLink, EyeOff, MessageCircle, Package, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader, Panel, ProductImage, StockBadge } from "@/components/ebh/ui-bits";
import { useApp } from "@/hooks/use-store";
import { formatNaira, vendorSlug } from "@/lib/business";
import { setProductHidden, updateShopSettings } from "@/lib/actions";

export const Route = createFileRoute("/_authenticated/my-shop")({
  head: () => ({
    meta: [
      { title: "My Shop — Eminent Business Hub" },
      { name: "description", content: "Open or pause your public shop, write your shop's about text, and choose which products shoppers see." },
      { property: "og:title", content: "My Shop — Eminent Business Hub" },
      { property: "og:description", content: "Control what shoppers see in your public store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyShopPage,
});

function MyShopPage() {
  const { session, users, allProducts } = useApp();
  const me = users.find((u) => u.id === session.id);
  const business = me?.business || session.business || "My shop";
  const slug = vendorSlug(business, session.id);
  const open = me?.shopOpen !== false;
  const mine = useMemo(() => allProducts.filter((p) => p.ownerId === session.id), [allProducts, session.id]);
  const visible = mine.filter((p) => !p.hidden).length;

  const [bio, setBio] = useState(me?.shopBio ?? "");
  useEffect(() => setBio(me?.shopBio ?? ""), [me?.shopBio]);

  const link = typeof window !== "undefined" ? `${window.location.origin}/shop/store/${slug}` : `/shop/store/${slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Shop link copied");
    } catch {
      toast.error("Could not copy. Press and hold the link to copy it.");
    }
  };

  const shareText = `Shop with ${business} on Eminent Business Hub: ${link}`;

  return (
    <div>
      <PageHeader title="My Shop" subtitle="Control what shoppers see in your public store" />

      {!me ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Loading your shop…</p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Shop status">
            <label htmlFor="shop-open" className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span>
                <span className="block font-semibold">{open ? "Shop is open" : "Shop is closed"}</span>
                <span className="text-xs text-muted-foreground">
                  {open ? "Shoppers can see your products and order." : "Your products are hidden and nobody can order."}
                </span>
              </span>
              <Switch
                id="shop-open"
                checked={open}
                onCheckedChange={(v) => {
                  void updateShopSettings(session.id, { shopOpen: v });
                  toast.success(v ? "Your shop is open" : "Your shop is paused");
                }}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-secondary p-3">
                <div className="font-display text-2xl font-bold text-navy">{open ? visible : 0}</div>
                <div className="text-xs text-muted-foreground">Shoppers can see</div>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <div className="font-display text-2xl font-bold text-navy">{mine.length - visible}</div>
                <div className="text-xs text-muted-foreground">Hidden</div>
              </div>
            </div>
          </Panel>

          <Panel title="Share your shop">
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-gold"><Store className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{business}</span>
                <span className="block break-all text-xs text-muted-foreground">{link}</span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
              <Button asChild className="bg-gold text-navy hover:bg-gold/90">
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> Share
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/shop/store/$vendor" params={{ vendor: slug }}><ExternalLink className="h-4 w-4" /> View</Link>
              </Button>
            </div>
          </Panel>

          <Panel title="About your shop" className="lg:col-span-2">
            <Label htmlFor="shop-bio" className="sr-only">About your shop</Label>
            <Textarea
              id="shop-bio"
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Quality Ankara and ready-to-wear in Port Harcourt. Delivery across Rivers State in 24 hours."
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{bio.length}/300 • Shown on your store page</span>
              <Button
                size="sm"
                className="bg-gold text-navy hover:bg-gold/90"
                disabled={bio.trim() === (me.shopBio ?? "").trim()}
                onClick={() => {
                  void updateShopSettings(session.id, { shopBio: bio.trim() });
                  toast.success("Saved");
                }}
              >
                Save
              </Button>
            </div>
          </Panel>

          <Panel title="Products in your shop" className="lg:col-span-2">
            {mine.length === 0 ? (
              <EmptyState
                icon={<Package className="h-5 w-5" />}
                title="No products yet"
                text="Add products with photos and they will appear in your shop."
                action={
                  <Button asChild className="bg-gold text-navy hover:bg-gold/90">
                    <Link to="/products">Add products</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {mine.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <ProductImage src={p.imageUrl} alt={p.name} className={`h-14 w-14 shrink-0 rounded-xl border ${p.hidden ? "opacity-50" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {formatNaira(p.price)} <StockBadge stock={p.stock} />
                        {p.hidden ? <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Hidden</span> : null}
                      </div>
                    </div>
                    <Switch
                      checked={!p.hidden}
                      aria-label={`Show ${p.name} in shop`}
                      onCheckedChange={(v) => void setProductHidden(p.id, !v)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
