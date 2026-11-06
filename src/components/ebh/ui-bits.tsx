import { useState, type ReactNode } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/storage";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "navy";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-card",
        tone === "navy" ? "border-transparent bg-navy-gradient text-primary-foreground" : "bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs font-semibold uppercase tracking-wide", tone === "navy" ? "text-gold" : "text-muted-foreground")}>
          {label}
        </span>
        {icon ? (
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", tone === "navy" ? "bg-gold text-navy" : "bg-gold-soft text-navy")}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      {hint ? <div className={cn("mt-1 text-xs", tone === "navy" ? "opacity-80" : "text-muted-foreground")}>{hint}</div> : null}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-card md:p-5", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    Pending: "bg-warning-soft text-warning",
    Completed: "bg-success-soft text-success",
    Cancelled: "bg-destructive/10 text-destructive",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", styles[status])}>{status}</span>;
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">Out of stock</span>;
  if (stock <= 5) return <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-bold text-warning">Low: {stock} left</span>;
  return <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">{stock} in stock</span>;
}

export function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("grid place-items-center bg-secondary text-navy/40", className)}>
        <Package className="h-10 w-10" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-gold-soft text-navy">{icon}</div>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function BarChart({ data, format }: { data: { label: string; total: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex h-48 items-end gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[0.6rem] font-semibold text-muted-foreground">{d.total ? format(d.total).replace("₦", "₦ ") : ""}</span>
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-10 rounded-t-md bg-navy transition-all"
              style={{ height: `${Math.max(3, (d.total / max) * 100)}%`, opacity: d.total ? 1 : 0.15 }}
              title={format(d.total)}
            />
          </div>
          <span className="text-xs text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
