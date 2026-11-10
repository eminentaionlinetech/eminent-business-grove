import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Truck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShopBrowser, ShopLayout } from "@/components/ebh/shop";

export const Route = createFileRoute("/shop/")({
  head: () => ({
    meta: [
      { title: "Shop — Eminent Business Hub" },
      { name: "description", content: "Browse and buy fashion, beauty, food and more from small businesses across Nigeria." },
      { property: "og:title", content: "Shop Nigerian small businesses — Eminent Business Hub" },
      { property: "og:description", content: "Browse products by category, see real photos and order straight from the seller." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopHome,
});

function ShopHome() {
  return (
    <ShopLayout>
      <section className="mb-5 overflow-hidden rounded-3xl bg-navy-gradient px-5 py-6 text-primary-foreground md:px-8 md:py-10">
        <p className="text-xs font-bold uppercase tracking-widest text-gold">EBH Marketplace</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-4xl">
          Shop from <span className="text-gold">small businesses</span> you can trust.
        </h1>
        <p className="mt-2 max-w-lg text-sm opacity-85">
          Pick a product, pay securely with Paystack or pay later, and the seller contacts you to arrange delivery.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-gold" /> Real local sellers</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-gold" /> Chat on WhatsApp</span>
          <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-gold" /> Pay on delivery or transfer</span>
        </div>
      </section>

      <ShopBrowser
        emptyAction={
          <Button asChild className="bg-gold text-navy hover:bg-gold/90">
            <Link to="/">Start selling on EBH</Link>
          </Button>
        }
      />
    </ShopLayout>
  );
}
