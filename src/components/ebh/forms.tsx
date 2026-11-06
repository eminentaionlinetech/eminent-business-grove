import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, formatNaira } from "@/lib/business";
import { createOrder, saveCustomer, saveProduct } from "@/lib/actions";
import type { Customer, OrderStatus, Product } from "@/lib/storage";

const goldBtn = "bg-gold text-navy hover:bg-gold/90";

export function ProductDialog({
  open,
  onOpenChange,
  ownerEmail,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownerEmail: string;
  product?: Product | null;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setPrice(product ? String(product.price) : "");
    setStock(product ? String(product.stock) : "");
    setImageUrl(product?.imageUrl ?? "");
    setCategory(product?.category ?? CATEGORIES[0]);
  }, [open, product]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    const s = Number(stock);
    if (!name.trim()) return toast.error("Enter a product name");
    if (!(p >= 0) || Number.isNaN(p)) return toast.error("Enter a valid price");
    if (!Number.isInteger(s) || s < 0) return toast.error("Stock must be a whole number");
    saveProduct({
      id: product?.id,
      ownerEmail: product?.ownerEmail ?? ownerEmail,
      name: name.trim(),
      price: p,
      stock: s,
      imageUrl: imageUrl.trim(),
      category,
    });
    toast.success(product ? "Product updated" : "Product added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ankara Wrap Dress" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Price (₦)</Label>
              <Input id="p-price" type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Stock</Label>
              <Input id="p-stock" type="number" inputMode="numeric" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-img">Image link (optional)</Label>
            <Input id="p-img" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
          <DialogFooter>
            <Button type="submit" className={goldBtn}>
              {product ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrderDialog({
  open,
  onOpenChange,
  ownerEmail,
  products,
  customers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownerEmail: string;
  products: Product[];
  customers: Customer[];
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [total, setTotal] = useState("");
  const [touchedTotal, setTouchedTotal] = useState(false);
  const [status, setStatus] = useState<OrderStatus>("Pending");

  const product = products.find((p) => p.id === productId);

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setCustomerPhone("");
    setProductId(products[0]?.id ?? "");
    setQuantity("1");
    setTouchedTotal(false);
    setStatus("Pending");
  }, [open, products]);

  useEffect(() => {
    if (!touchedTotal) setTotal(product ? String(product.price * (Number(quantity) || 0)) : "");
  }, [product, quantity, touchedTotal]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = Number(quantity);
    const t = Number(total);
    if (!customerName.trim()) return toast.error("Enter the customer's name");
    if (!product) return toast.error("Choose a product");
    if (!Number.isInteger(q) || q < 1) return toast.error("Quantity must be at least 1");
    if (status !== "Cancelled" && q > product.stock) {
      return toast.error(`Only ${product.stock} of ${product.name} left in stock`);
    }
    if (Number.isNaN(t) || t < 0) return toast.error("Enter a valid total");
    createOrder({
      ownerEmail: product.ownerEmail || ownerEmail,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      productId: product.id,
      quantity: q,
      total: t,
      status,
    });
    toast.success("Order created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create order</DialogTitle>
        </DialogHeader>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a product first, then you can record orders for it.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-cust">Customer name</Label>
              <Input
                id="o-cust"
                list="ebh-customers"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  const match = customers.find((c) => c.name.toLowerCase() === e.target.value.toLowerCase());
                  if (match?.phone) setCustomerPhone(match.phone);
                }}
                required
              />
              <datalist id="ebh-customers">
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-phone">Customer phone (optional)</Label>
              <Input id="o-phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatNaira(p.price)} ({p.stock} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-qty">Quantity</Label>
                <Input id="o-qty" type="number" min={1} step={1} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-total">Total (₦)</Label>
                <Input
                  id="o-total"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => {
                    setTouchedTotal(true);
                    setTotal(e.target.value);
                  }}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" className={goldBtn}>
                Create order
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CustomerDialog({ open, onOpenChange, ownerEmail }: { open: boolean; onOpenChange: (v: boolean) => void; ownerEmail: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setEmail("");
    }
  }, [open]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Enter a name");
    saveCustomer({ ownerEmail, name: name.trim(), phone: phone.trim(), email: email.trim() });
    toast.success("Customer added");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email (optional)</Label>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" className={goldBtn}>
              Add customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
