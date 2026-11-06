import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, FileText, Instagram, MessageCircle, Sparkles, CheckCircle2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/ebh/ui-bits";
import { useApp } from "@/hooks/use-store";
import { CATEGORIES } from "@/lib/business";
import { generateCaption, generateFlyer, generateWhatsApp, type Tone } from "@/lib/marketing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing Studio — Eminent Business Hub" },
      { name: "description", content: "Generate Instagram captions, WhatsApp messages and flyer text for your products." },
      { property: "og:title", content: "Marketing Studio — Eminent Business Hub" },
      { property: "og:description", content: "Professional copy for your products in one tap." },
    ],
  }),
  component: MarketingPage,
});

type Kind = "caption" | "whatsapp" | "flyer";

const KINDS: { id: Kind; label: string; icon: typeof Instagram }[] = [
  { id: "caption", label: "Caption", icon: Instagram },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "flyer", label: "Flyer text", icon: FileText },
];

function MarketingPage() {
  const { session, products } = useApp();
  const [productId, setProductId] = useState<string>("custom");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tone, setTone] = useState<Tone>("friendly");
  const [offer, setOffer] = useState("");
  const [kind, setKind] = useState<Kind>("caption");
  const [output, setOutput] = useState("");

  useEffect(() => {
    if (products.length && productId === "custom" && !name) setProductId(products[0].id);
  }, [products, productId, name]);

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p) {
      setName(p.name);
      setPrice(String(p.price));
      setCategory(p.category);
    }
  }, [productId, products]);

  const generate = (k: Kind = kind) => {
    if (!name.trim()) return toast.error("Choose or type a product name");
    const input = {
      product: name.trim(),
      price: price ? Number(price) : null,
      category,
      business: session.business,
      phone: session.phone,
      tone,
      offer,
    };
    const seed = Math.floor(Math.random() * 1000);
    setKind(k);
    setOutput(k === "caption" ? generateCaption(input, seed) : k === "whatsapp" ? generateWhatsApp(input, seed) : generateFlyer(input, seed));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied — paste it anywhere");
    } catch {
      toast.error("Couldn't copy. Press and hold the text to copy it.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Marketing Studio" subtitle="Ready-to-post copy for Instagram, WhatsApp and flyers" />

      <div className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info-soft p-4 text-info" role="status">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm font-semibold">
          Eminent Marketing Engine Active • Template Engine Ready — Professional copy generation enabled.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="1. Your product">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Type my own…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Product name</Label>
              <Input id="m-name" value={name} onChange={(e) => { setName(e.target.value); setProductId("custom"); }} placeholder="e.g. Ankara Wrap Dress" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-price">Price (₦)</Label>
                <Input id="m-price" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-offer">Special offer (optional)</Label>
              <Input id="m-offer" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. 10% off this weekend" />
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["friendly", "luxury", "urgent"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn("rounded-lg border py-2 text-sm font-semibold capitalize", tone === t ? "border-navy bg-navy text-primary-foreground" : "bg-card")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="2. Generate">
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <Button key={k.id} onClick={() => generate(k.id)} variant={kind === k.id && output ? "default" : "outline"} className="h-auto flex-col gap-1 py-3">
                <k.icon className="h-5 w-5" />
                <span className="text-xs">{k.label}</span>
              </Button>
            ))}
          </div>
          <Textarea value={output} onChange={(e) => setOutput(e.target.value)} placeholder="Tap Caption, WhatsApp or Flyer text to create your copy." className="mt-4 min-h-64 bg-muted/40 text-sm" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={copy} disabled={!output} className="bg-gold text-navy hover:bg-gold/90">
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button variant="outline" onClick={() => generate()} disabled={!output}>
              <Sparkles className="h-4 w-4" /> Try another
            </Button>
            <Button asChild variant="outline" disabled={!output}>
              <a href={`https://wa.me/?text=${encodeURIComponent(output)}`} target="_blank" rel="noreferrer" aria-disabled={!output}>
                <Share2 className="h-4 w-4" /> Share to WhatsApp
              </a>
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
