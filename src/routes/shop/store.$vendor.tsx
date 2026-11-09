import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShopBrowser, ShopLayout, useHydrated, useShopData } from "@/components/ebh/shop";
import { shopVendors, toWhatsAppNumber } from "@/lib/business";

export const Route = createFileRoute("/shop/store/$vendor")({
  head: () => ({
    meta: [
      { title: "Seller store — Eminent Business Hub Shop" },
      { name: "description", content: "See every product from this seller and order directly." },
      { property: "og:title", content: "Seller store — Eminent Business Hub" },
      { property: "og:description", content: "Browse this seller's products with photos and prices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VendorStore,
});

function VendorStore() {
  const { vendor: slug } = Route.useParams();
  const hydrated = useHydrated();
  const { users } = useShopData();
  const vendor = useMemo(() => [...shopVendors(users).values()].find((v) => v.slug === slug), [users, slug]);

  return (
    <ShopLayout>
      <Link to="/shop" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy">
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>
      {hydrated && !vendor ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-lg font-bold">Store not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">This seller may have closed their store.</p>
        </div>
      ) : (
        <>
          <section className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-navy text-gold">
              <Store className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold">{vendor?.business ?? "Loading…"}</h1>
              <p className="text-xs text-muted-foreground">Seller on Eminent Business Hub</p>
            </div>
            {vendor?.phone ? (
              <Button asChild variant="outline">
                <a href={`https://wa.me/${toWhatsAppNumber(vendor.phone)}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            ) : null}
            {vendor?.bio ? <p className="w-full whitespace-pre-line text-sm text-foreground/85">{vendor.bio}</p> : null}
          </section>
          {vendor && !vendor.open ? (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <h2 className="text-lg font-bold">This shop is closed for now</h2>
              <p className="mt-1 text-sm text-muted-foreground">The seller has paused orders. Check back soon or message them on WhatsApp.</p>
            </div>
          ) : (
            <ShopBrowser vendorSlug={slug} />
          )}
        </>
      )}
    </ShopLayout>
  );
}
