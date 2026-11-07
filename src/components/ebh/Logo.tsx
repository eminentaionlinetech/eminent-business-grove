import { cn } from "@/lib/utils";
import logoFull from "@/assets/ebh-logo-full.jpg.asset.json";
import logoMark from "@/assets/ebh-logo-mark.png.asset.json";

/**
 * Brand mark. Uses ONLY the owner's original logo:
 * - full: the original uploaded logo (symbol + name + tagline)
 * - mark: a straight crop of the symbol from that same file, for small spaces
 */
export function Logo({
  size = "md",
  showTagline = false,
  full = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  full?: boolean;
  className?: string;
}) {
  if (full) {
    return (
      <img
        src={logoFull.url}
        alt="Eminent Business Hub — Empowering Small Businesses • Products • Orders • Marketing • Growth"
        className={cn("h-40 w-40 rounded-2xl object-cover shadow-lg ring-1 ring-gold/30 md:h-56 md:w-56", className)}
      />
    );
  }

  const box = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoMark.url}
        alt="Eminent Business Hub logo"
        className={cn("shrink-0 rounded-lg object-cover ring-1 ring-gold/40", box)}
      />
      <div className="min-w-0 leading-tight">
        <div
          className={cn(
            "font-display font-extrabold tracking-wide",
            size === "lg" ? "text-lg" : "text-sm",
          )}
        >
          EMINENT BUSINESS HUB
        </div>
        {showTagline ? (
          <div className="mt-0.5 text-[0.7rem] opacity-80">
            Empowering Small Businesses • Products • Orders • Marketing • Growth.
          </div>
        ) : (
          <div className="text-[0.7rem] font-semibold text-gold">Build • Manage • Grow</div>
        )}
      </div>
    </div>
  );
}

export function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-navy text-primary-foreground">
      <Logo full className="animate-pulse" />
    </div>
  );
}
