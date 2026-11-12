import { useMemo, useState } from "react";
import { Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ebh/ui-bits";
import { CustomerDialog } from "@/components/ebh/forms";
import { formatNaira, summarizeCustomers } from "@/lib/business";
import { deleteCustomer } from "@/lib/actions";
import type { Customer, Order } from "@/lib/storage";

export function CustomerList({
  ownerId,
  customers,
  orders,
  showOwner,
  embedded = false,
}: {
  ownerId: string;
  customers: Customer[];
  orders: Order[];
  showOwner: boolean;
  embedded?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const all = useMemo(() => summarizeCustomers(customers, orders), [customers, orders]);
  const list = all.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()) || c.phone.includes(q.trim()));

  const addBtn = (
    <Button onClick={() => setOpen(true)} className="bg-gold text-navy hover:bg-gold/90">
      <Plus className="h-4 w-4" /> Add customer
    </Button>
  );

  return (
    <div>
      {embedded ? <div className="mb-3 flex justify-end">{addBtn}</div> : <PageHeader title="Customers" subtitle={`${all.length} customers`} action={addBtn} />}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="h-10 bg-card pl-9" />
      </div>
      {all.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No customers yet" text="Customers are added automatically when you record orders, or add them yourself." action={addBtn} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {list.map((c) => (
            <div key={c.key} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy font-display font-bold text-gold">
                {c.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.orders} orders • {formatNaira(c.spent)} spent{showOwner ? ` • ${c.ownerId.slice(0, 6)}` : ""}
                </div>
              </div>
              {c.phone ? (
                <Button asChild size="icon" variant="outline" aria-label={`Call ${c.name}`}>
                  <a href={`tel:${c.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
              {c.saved ? (
                <Button size="icon" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => c.saved && void deleteCustomer(c.saved.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <CustomerDialog open={open} onOpenChange={setOpen} ownerId={ownerId} />
    </div>
  );
}
