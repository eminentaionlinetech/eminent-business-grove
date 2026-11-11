import { cn } from "@/lib/utils";
import logoFullUrl from "@/assets/ebh-logo-full.png";
import logoMarkUrl from "@/assets/ebh-logo-mark.png";

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
        src={logoFullUrl}
        alt="Eminent Business Hub — Empowering Small Businesses • Products • Orders • Marketing • Growth"
        className={cn("h-auto w-72 max-w-full rounded-2xl shadow-lg ring-1 ring-gold/30 md:w-96", className)}
      />
    );
  }

  const box = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoMarkUrl}
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
