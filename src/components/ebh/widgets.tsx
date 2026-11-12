import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ShoppingBag, Trophy } from "lucide-react";
import { BarChart, EmptyState, Panel, StatusBadge } from "./ui-bits";
import { formatNaira, isLowStock, last7Days, topProducts } from "@/lib/business";
import { updateOrderStatus } from "@/lib/actions";
import type { Order, OrderStatus, Product } from "@/lib/storage";

export function StatusSelect({ order }: { order: Order }) {
  return (
    <select
      aria-label="Order status"
      value={order.status}
      onChange={async (e) => {
        const r = await updateOrderStatus(order.id, e.target.value as OrderStatus);
        if (!r.ok) toast.error(r.error);
      }}
      className="rounded-md border bg-card px-2 py-1 text-xs font-semibold"
    >
      <option>Pending</option>
      <option>Completed</option>
      <option>Cancelled</option>
    </select>
  );
}

export function RecentOrders({ orders, showOwner = false, limit = 6 }: { orders: Order[]; showOwner?: boolean; limit?: number }) {
  const list = orders.slice(0, limit);
  return (
    <Panel
      title="Recent orders"
      action={
        <Link to="/orders" className="text-sm font-semibold text-info hover:underline">
          View all
        </Link>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="No orders yet" text="Orders you record will show here." />
      ) : (
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 md:px-5">Customer</th>
                <th className="px-2 py-2">Product</th>
                {showOwner ? <th className="px-2 py-2">Business</th> : null}
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-4 py-2 md:px-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-semibold md:px-5">{o.customerName}</td>
                  <td className="px-2 py-2.5">
                    {o.productName} <span className="text-muted-foreground">×{o.quantity}</span>
                  </td>
                  {showOwner ? <td className="px-2 py-2.5 text-xs text-muted-foreground">{o.ownerId.slice(0, 6)}</td> : null}
                  <td className="px-2 py-2.5 text-right font-semibold">{formatNaira(o.total)}</td>
                  <td className="px-4 py-2.5 md:px-5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      <StatusSelect order={o} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function TopProductsPanel({ orders }: { orders: Order[] }) {
  const top = topProducts(orders);
  return (
    <Panel title="Top products">
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your best sellers will appear after your first orders.</p>
      ) : (
        <ol className="space-y-2">
          {top.map((p, i) => (
            <li key={p.name + i} className="flex items-center gap-3">
              <span className={i === 0 ? "grid h-7 w-7 place-items-center rounded-full bg-gold text-navy" : "grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-bold"}>
                {i === 0 ? <Trophy className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.quantity} sold</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function RevenueChartPanel({ orders }: { orders: Order[] }) {
  return (
    <Panel title="Revenue — last 7 days">
      <BarChart data={last7Days(orders)} format={formatNaira} />
    </Panel>
  );
}

export function LowStockPanel({ products }: { products: Product[] }) {
  const low = products.filter(isLowStock).sort((a, b) => a.stock - b.stock);
  return (
    <Panel title="Low stock alert">
      {low.length === 0 ? (
        <p className="text-sm text-muted-foreground">All products are well stocked. 👍</p>
      ) : (
        <ul className="space-y-2">
          {low.slice(0, 6).map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="flex-1 truncate font-semibold">{p.name}</span>
              <span className="text-xs font-bold text-warning">{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
