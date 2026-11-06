import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CalendarRange, Sun, Trophy } from "lucide-react";
import { PageHeader, Panel, StatCard } from "@/components/ebh/ui-bits";
import { RevenueChartPanel, TopProductsPanel } from "@/components/ebh/widgets";
import { useApp } from "@/hooks/use-store";
import { formatNaira, revenueOf, salesPeriods, topProducts } from "@/lib/business";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Eminent Business Hub" },
      { name: "description", content: "Sales today, this week and this month, plus your best-selling product." },
      { property: "og:title", content: "Analytics — Eminent Business Hub" },
      { property: "og:description", content: "Know your numbers at a glance." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { orders, isAdmin } = useApp();
  const periods = salesPeriods(orders);
  const best = topProducts(orders, 1)[0];
  const completed = orders.filter((o) => o.status === "Completed");
  const avg = completed.length ? revenueOf(orders) / completed.length : 0;
  const counts = {
    Pending: orders.filter((o) => o.status === "Pending").length,
    Completed: completed.length,
    Cancelled: orders.filter((o) => o.status === "Cancelled").length,
  };
  const total = Math.max(1, orders.length);

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" subtitle={isAdmin ? "All businesses — completed sales only" : "Completed sales only"} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" value={formatNaira(periods.today)} icon={<Sun className="h-4 w-4" />} tone="navy" />
        <StatCard label="This week" value={formatNaira(periods.week)} hint="Last 7 days" icon={<CalendarRange className="h-4 w-4" />} />
        <StatCard label="This month" value={formatNaira(periods.month)} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Best seller" value={best ? best.name : "—"} hint={best ? `${best.quantity} sold` : "No sales yet"} icon={<Trophy className="h-4 w-4" />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChartPanel orders={orders} />
        </div>
        <Panel title="Order status">
          <div className="space-y-3">
            {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold">{k}</span>
                  <span className="text-muted-foreground">{counts[k]}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={k === "Completed" ? "h-full bg-success" : k === "Pending" ? "h-full bg-gold" : "h-full bg-destructive"}
                    style={{ width: `${(counts[k] / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="border-t pt-3 text-sm">
              Average order: <b>{formatNaira(avg)}</b>
            </div>
          </div>
        </Panel>
      </div>
      <TopProductsPanel orders={orders} />
    </div>
  );
}
