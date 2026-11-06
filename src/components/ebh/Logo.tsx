import { cn } from "@/lib/utils";

/**
 * Brand mark slot. Uses ONLY the owner's original logo.
 * Until the original logo file is added, this shows the brand name as text (no invented artwork).
 * To use the real logo: set LOGO_SRC to the uploaded image URL.
 */
const LOGO_SRC: string | null = null;

export function Logo({
  size = "md",
  showTagline = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}) {
  const box = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-full bg-navy p-1 ring-2 ring-gold/70",
          box,
        )}
      >
        {LOGO_SRC ? (
          <img src={LOGO_SRC} alt="Eminent Business Hub logo" className="h-full w-full object-contain" />
        ) : (
          <span className="font-display text-[0.6rem] font-extrabold leading-none tracking-wider text-gold">
            EBH
          </span>
        )}
      </div>
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
      <Logo size="lg" />
    </div>
  );
}
