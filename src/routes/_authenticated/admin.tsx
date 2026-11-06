import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Package, ShoppingBag, Users, Wallet } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ebh/ui-bits";
import { LowStockPanel, RecentOrders, RevenueChartPanel, TopProductsPanel } from "@/components/ebh/widgets";
import { useApp } from "@/hooks/use-store";
import { formatNaira, pendingValueOf, revenueOf, summarizeCustomers } from "@/lib/business";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Eminent Business Hub" },
      { name: "description", content: "Admin overview of all users, products, orders and revenue." },
      { property: "og:title", content: "Admin Dashboard — Eminent Business Hub" },
      { property: "og:description", content: "Admin overview of the whole platform." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { isAdmin, allOrders, allProducts, allCustomers, users } = useApp();
  if (!isAdmin) return <Navigate to="/dashboard" />;
  const customerCount = summarizeCustomers(allCustomers, allOrders).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Admin Dashboard" subtitle={`${users.length} registered ${users.length === 1 ? "account" : "accounts"} on this device`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total revenue" value={formatNaira(revenueOf(allOrders))} hint={`${formatNaira(pendingValueOf(allOrders))} pending`} icon={<Wallet className="h-4 w-4" />} tone="navy" />
        <StatCard label="Total orders" value={String(allOrders.length)} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Total products" value={String(allProducts.length)} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Total customers" value={String(customerCount)} icon={<Users className="h-4 w-4" />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <RevenueChartPanel orders={allOrders} />
          <RecentOrders orders={allOrders} showOwner limit={8} />
        </div>
        <div className="space-y-5">
          <TopProductsPanel orders={allOrders} />
          <LowStockPanel products={allProducts} />
        </div>
      </div>
    </div>
  );
}
