import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, ShoppingBag, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ebh/ui-bits";
import { StatusSelect } from "@/components/ebh/widgets";
import { OrderDialog } from "@/components/ebh/forms";
import { useApp } from "@/hooks/use-store";
import { formatNaira } from "@/lib/business";
import { deleteOrder } from "@/lib/actions";
import type { OrderStatus } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Eminent Business Hub" },
      { name: "description", content: "Record orders, track delivery status and follow up with customers." },
      { property: "og:title", content: "Orders — Eminent Business Hub" },
      { property: "og:description", content: "Record and track every order." },
    ],
  }),
  component: OrdersPage,
});

const FILTERS: ("All" | OrderStatus)[] = ["All", "Pending", "Completed", "Cancelled"];

function waLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function OrdersPage() {
  const { session, orders, products, customers, isAdmin, ownerName } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (filter === "All" || o.status === filter) &&
        (!s || o.customerName.toLowerCase().includes(s) || o.productName.toLowerCase().includes(s)),
    );
  }, [orders, q, filter]);

  return (
    <div>
      <PageHeader
        title={isAdmin ? "All Orders" : "My Orders"}
        subtitle={`${orders.length} orders`}
        action={
          <Button onClick={() => setOpen(true)} className="bg-gold text-navy hover:bg-gold/90">
            <Plus className="h-4 w-4" /> Create order
          </Button>
        }
      />
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer or product" className="h-10 bg-card pl-9" />
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold",
              filter === f ? "border-navy bg-navy text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            {f}
            {f !== "All" ? ` (${orders.filter((o) => o.status === f).length})` : ""}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="No orders yet"
          text="Record each sale here — stock updates automatically."
          action={
            <Button onClick={() => setOpen(true)} className="bg-gold text-navy hover:bg-gold/90">
              Create order
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No orders match.</p>
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{o.customerName}</span>
                  <StatusBadge status={o.status} />
                  {o.source === "shop" ? <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.65rem] font-bold text-navy">From shop</span> : null}
                  {o.paymentStatus === "paid" ? (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-bold text-success">Paid online</span>
                  ) : o.source === "shop" ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold text-muted-foreground">Pay later</span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {o.productName} × {o.quantity} • {new Date(o.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                  {isAdmin ? ` • ${ownerName(o.ownerId)}` : ""}
                </div>
                {o.note ? <div className="mt-1 text-xs text-muted-foreground">Delivery: {o.note}</div> : null}
              </div>
              <div className="font-display text-lg font-bold">{formatNaira(o.total)}</div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <StatusSelect order={o} />
                {o.customerPhone ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={waLink(o.customerPhone, `Hello ${o.customerName}, this is ${session.business}. Your order of ${o.productName} (x${o.quantity}) is ${o.status.toLowerCase()}. Thank you!`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Delete order"
                  onClick={() => {
                    void deleteOrder(o.id).then((r) => { if (!r.ok) toast.error(r.error); });
                    toast.success("Order deleted");
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderDialog open={open} onOpenChange={setOpen} ownerId={session.id} products={products} customers={customers} />
    </div>
  );
}
