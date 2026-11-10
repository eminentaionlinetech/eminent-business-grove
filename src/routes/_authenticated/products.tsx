import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { EmptyState, PageHeader, ProductImage, StockBadge } from "@/components/ebh/ui-bits";
import { ProductDialog } from "@/components/ebh/forms";
import { useApp } from "@/hooks/use-store";
import { CATEGORIES, formatNaira } from "@/lib/business";
import { deleteProduct } from "@/lib/actions";
import type { Product } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — Eminent Business Hub" },
      { name: "description", content: "Add, edit and track stock for all your products." },
      { property: "og:title", content: "Products — Eminent Business Hub" },
      { property: "og:description", content: "Manage your product catalogue and stock." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { session, products, isAdmin } = useApp();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const list = useMemo(
    () =>
      products.filter(
        (p) => (cat === "all" || p.category === cat) && p.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [products, q, cat],
  );

  const startAdd = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title={isAdmin ? "All Products" : "My Products"}
        subtitle={`${products.length} products`}
        action={
          <Button onClick={startAdd} className="bg-gold text-navy hover:bg-gold/90">
            <Plus className="h-4 w-4" /> Add product
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="h-10 bg-card pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-10 bg-card sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="No products yet"
          text="Add the items you really sell — name, price, stock and a photo."
          action={
            <div className="flex gap-2">
              <Button onClick={startAdd} className="bg-gold text-navy hover:bg-gold/90">
                Add product
              </Button>
            </div>
          }
        />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No products match your search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <ProductImage src={p.imageUrl} alt={p.name} className="aspect-square w-full" />
              <div className="space-y-1.5 p-3">
                <div className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{p.category}</div>
                <h3 className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</h3>
                <div className="font-display text-base font-bold text-navy">{formatNaira(p.price)}</div>
                <div className="flex flex-wrap gap-1">
                  <StockBadge stock={p.stock} />
                  {p.hidden ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold text-muted-foreground">Hidden from shop</span> : null}
                </div>
                {isAdmin ? <div className="truncate text-[0.65rem] text-muted-foreground">{p.ownerEmail}</div> : null}
                <div className="flex gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" aria-label={`Delete ${p.name}`} onClick={() => setToDelete(p)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ProductDialog open={open} onOpenChange={setOpen} ownerEmail={session.email} product={editing} />
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the product. Past orders keep their record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) deleteProduct(toDelete.id);
                toast.success("Product deleted");
                setToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
