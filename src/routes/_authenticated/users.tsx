import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, PageHeader, Panel } from "@/components/ebh/ui-bits";
import { CustomerList } from "@/components/ebh/CustomerList";
import { useApp } from "@/hooks/use-store";
import { deleteUser } from "@/lib/actions";
import { formatNaira, revenueOf } from "@/lib/business";
import { setEmailLogs, type AppUser } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Customers & Users — Eminent Business Hub" },
      { name: "description", content: "Admin view of all registered businesses, their customers and email logs." },
      { property: "og:title", content: "Customers & Users — Eminent Business Hub" },
      { property: "og:description", content: "Manage accounts, customers and email logs." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { session, isAdmin, users, allOrders, allProducts, allCustomers, emailLogs } = useApp();
  const [toDelete, setToDelete] = useState<AppUser | null>(null);
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div>
      <PageHeader title="Customers / Users" subtitle="Everyone using Eminent Business Hub on this device" />
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="emails">Email logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {users.length === 0 ? (
            <EmptyState icon={<UserRound className="h-5 w-5" />} title="No accounts yet" text="Accounts appear here when people sign up on this device." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {users.map((u) => {
                const orders = allOrders.filter((o) => o.ownerEmail === u.email);
                return (
                  <div key={u.email} className="rounded-2xl border bg-card p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold", u.role === "admin" ? "bg-gold text-navy" : "bg-navy text-gold")}>
                        {u.role === "admin" ? <ShieldCheck className="h-5 w-5" /> : u.business.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{u.business}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.phone || "No phone"} • Joined {new Date(u.createdAt).toLocaleDateString("en-NG")}</div>
                      </div>
                      {u.email !== session.email ? (
                        <Button size="icon" variant="ghost" aria-label={`Delete ${u.email}`} onClick={() => setToDelete(u)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold">You</span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-secondary py-2"><b className="block text-sm">{allProducts.filter((p) => p.ownerEmail === u.email).length}</b>products</div>
                      <div className="rounded-lg bg-secondary py-2"><b className="block text-sm">{orders.length}</b>orders</div>
                      <div className="rounded-lg bg-secondary py-2"><b className="block text-sm">{formatNaira(revenueOf(orders))}</b>revenue</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Passwords are stored as one-way codes and are never shown here.</p>
        </TabsContent>

        <TabsContent value="customers">
          <CustomerList ownerEmail={session.email} customers={allCustomers} orders={allOrders} showOwner embedded />
        </TabsContent>

        <TabsContent value="emails">
          <Panel
            title="Email logs"
            action={
              emailLogs.length ? (
                <Button size="sm" variant="outline" onClick={() => setEmailLogs([])}>
                  Clear
                </Button>
              ) : null
            }
          >
            {emailLogs.length === 0 ? (
              <EmptyState icon={<Mail className="h-5 w-5" />} title="No emails yet" text="Welcome emails sent at sign-up are listed here." />
            ) : (
              <ul className="divide-y">
                {emailLogs.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-bold",
                        l.status === "sent" ? "bg-success-soft text-success" : l.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-info-soft text-info",
                      )}
                    >
                      {l.status === "skipped" ? "not sent" : l.status}
                    </span>
                    <span className="font-semibold">{l.to}</span>
                    <span className="text-xs text-muted-foreground">{l.kind} • {new Date(l.createdAt).toLocaleString("en-NG")}</span>
                    <span className="w-full text-xs text-muted-foreground">{l.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.business}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the account {toDelete?.email} and all their products, orders and customers. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) deleteUser(toDelete.email);
                toast.success("User deleted");
                setToDelete(null);
              }}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
