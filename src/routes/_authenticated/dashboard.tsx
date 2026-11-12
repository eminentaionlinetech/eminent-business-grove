import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, Package, Plus, ShoppingBag, Wallet, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ebh/ui-bits";
import { LowStockPanel, RecentOrders, RevenueChartPanel, TopProductsPanel } from "@/components/ebh/widgets";
import { OrderDialog, ProductDialog } from "@/components/ebh/forms";
import { useApp } from "@/hooks/use-store";
import { formatNaira, pendingValueOf, revenueOf } from "@/lib/business";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Eminent Business Hub" },
      { name: "description", content: "Your business at a glance: revenue, orders, products and quick actions." },
      { property: "og:title", content: "Home — Eminent Business Hub" },
      { property: "og:description", content: "Your business at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { session, products, orders, customers } = useApp();
  const [productOpen, setProductOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-navy-gradient p-5 text-primary-foreground shadow-card md:p-7">
        <p className="text-sm text-gold">Build • Manage • Grow</p>
        <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">Welcome back, {session.business || "friend"} 👋</h1>
        <p className="mt-1 text-sm opacity-80">Here's how your business is doing today.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button onClick={() => setProductOpen(true)} className="bg-gold text-navy hover:bg-gold/90">
            <Plus className="h-4 w-4" /> Add product
          </Button>
          <Button onClick={() => setOrderOpen(true)} variant="secondary">
            <ShoppingBag className="h-4 w-4" /> New order
          </Button>
          <Button asChild variant="secondary" className="col-span-2 sm:col-span-1">
            <Link to="/marketing">
              <Megaphone className="h-4 w-4" /> Create a post
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="My revenue" value={formatNaira(revenueOf(orders))} hint="Completed orders" icon={<Wallet className="h-4 w-4" />} tone="navy" />
        <StatCard label="Pending" value={formatNaira(pendingValueOf(orders))} hint={`${orders.filter((o) => o.status === "Pending").length} orders to deliver`} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="My orders" value={String(orders.length)} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="My products" value={String(products.length)} hint={`${customers.length} customers`} icon={<Package className="h-4 w-4" />} />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed bg-card p-5 sm:flex-row sm:items-center">
          <Sparkles className="h-6 w-6 text-gold" />
          <div className="flex-1">
            <p className="font-bold">Your shop is empty</p>
            <p className="text-sm text-muted-foreground">Add your first real product with its photo, price and stock.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setProductOpen(true)} className="bg-gold text-navy hover:bg-gold/90">
              Add product
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <RevenueChartPanel orders={orders} />
          <RecentOrders orders={orders} />
        </div>
        <div className="space-y-5">
          <TopProductsPanel orders={orders} />
          <LowStockPanel products={products} />
        </div>
      </div>

      <ProductDialog open={productOpen} onOpenChange={setProductOpen} ownerId={session.id} />
      <OrderDialog open={orderOpen} onOpenChange={setOrderOpen} ownerId={session.id} products={products} customers={customers} />
    </div>
  );
}
