import { createFileRoute } from "@tanstack/react-router";
import { CustomerList } from "@/components/ebh/CustomerList";
import { useApp } from "@/hooks/use-store";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Eminent Business Hub" },
      { name: "description", content: "See who buys from you, how often, and how much they spend." },
      { property: "og:title", content: "Customers — Eminent Business Hub" },
      { property: "og:description", content: "Your customer list, built from your orders." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { session, customers, orders, isAdmin } = useApp();
  return <CustomerList ownerId={session.id} customers={customers} orders={orders} showOwner={isAdmin} />;
}
