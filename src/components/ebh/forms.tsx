import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, DEFAULT_CATEGORY, formatNaira } from "@/lib/business";
import { createOrder, saveCustomer, saveProduct } from "@/lib/actions";
import type { Customer, OrderStatus, Product } from "@/lib/storage";
import { resizeImageFile } from "@/lib/image";
import { ProductImage } from "./ui-bits";

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
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [description, setDescription] = useState("");
  const [showInShop, setShowInShop] = useState(true);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isUpload = imageUrl.startsWith("data:");

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    try {
      setImageUrl(await resizeImageFile(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use this photo");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setPrice(product ? String(product.price) : "");
    setStock(product ? String(product.stock) : "");
    setImageUrl(product?.imageUrl ?? "");
    setCategory(product?.category ?? DEFAULT_CATEGORY);
    setDescription(product?.description ?? "");
    setShowInShop(!product?.hidden);
  }, [open, product]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    const s = Number(stock);
    if (!name.trim()) { toast.error("Enter a product name"); return; }
    if (!(p >= 0) || Number.isNaN(p)) { toast.error("Enter a valid price"); return; }
    if (!Number.isInteger(s) || s < 0) { toast.error("Stock must be a whole number"); return; }
    try {
      saveProduct({
        id: product?.id,
        ownerEmail: product?.ownerEmail ?? ownerEmail,
        name: name.trim(),
        price: p,
        stock: s,
        imageUrl: imageUrl.trim(),
        category,
        description: description.trim() || undefined,
        hidden: !showInShop,
      });
    } catch {
      toast.error("Your phone's storage for this app is full. Remove some photos or use a photo link.");
      return;
    }
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
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              <ProductImage src={imageUrl} alt="Product photo preview" className="h-20 w-20 shrink-0 rounded-xl border" />
              <div className="flex flex-1 flex-col gap-2">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={processing}>
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {imageUrl ? "Change photo" : "Take or choose photo"}
                </Button>
                {imageUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>
                    <X className="h-3.5 w-3.5" /> Remove photo
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Product photo"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </div>
            <Input
              id="p-img"
              type="url"
              aria-label="Photo link"
              value={isUpload ? "" : imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder={isUpload ? "Photo added from your phone" : "Or paste a photo link (https://…)"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description (optional)</Label>
            <Textarea
              id="p-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Size, colour, material, delivery info…"
            />
          </div>
          <label htmlFor="p-show" className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span>
              <span className="block text-sm font-semibold">Show in public shop</span>
              <span className="text-xs text-muted-foreground">Turn off to keep it private</span>
            </span>
            <Switch id="p-show" checked={showInShop} onCheckedChange={setShowInShop} />
          </label>
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
    if (!customerName.trim()) { toast.error("Enter the customer's name"); return; }
    if (!product) { toast.error("Choose a product"); return; }
    if (!Number.isInteger(q) || q < 1) { toast.error("Quantity must be at least 1"); return; }
    if (status !== "Cancelled" && q > product.stock) {
      { toast.error(`Only ${product.stock} of ${product.name} left in stock`); return; }
    }
    if (Number.isNaN(t) || t < 0) { toast.error("Enter a valid total"); return; }
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
    if (!name.trim()) { toast.error("Enter a name"); return; }
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
