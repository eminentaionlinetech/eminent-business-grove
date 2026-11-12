import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Users,
  ShieldCheck,
  Store,
  SlidersHorizontal,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { logout, type Session } from "@/lib/auth";
import { Logo } from "./Logo";

type NavItem = { to: "/dashboard" | "/admin" | "/products" | "/orders" | "/customers" | "/users" | "/marketing" | "/analytics" | "/settings" | "/shop" | "/my-shop"; label: string; short: string; icon: typeof Home };

function navFor(isAdmin: boolean): NavItem[] {
  if (isAdmin) {
    return [
      { to: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard },
      { to: "/products", label: "Products", short: "Products", icon: Package },
      { to: "/orders", label: "Orders", short: "Orders", icon: ShoppingBag },
      { to: "/users", label: "Customers / Users", short: "Users", icon: Users },
      { to: "/marketing", label: "Marketing Studio", short: "Marketing", icon: Megaphone },
      { to: "/analytics", label: "Analytics", short: "Analytics", icon: BarChart3 },
      { to: "/my-shop", label: "My Shop", short: "My Shop", icon: SlidersHorizontal },
      { to: "/shop", label: "Public Shop", short: "Shop", icon: Store },
      { to: "/settings", label: "Settings", short: "Settings", icon: Settings },
    ];
  }
  return [
    { to: "/dashboard", label: "Home", short: "Home", icon: Home },
    { to: "/products", label: "My Products", short: "Products", icon: Package },
    { to: "/orders", label: "My Orders", short: "Orders", icon: ShoppingBag },
    { to: "/customers", label: "Customers", short: "Customers", icon: Users },
    { to: "/marketing", label: "My Marketing", short: "Marketing", icon: Megaphone },
    { to: "/analytics", label: "Analytics", short: "Analytics", icon: BarChart3 },
    { to: "/my-shop", label: "My Shop", short: "My Shop", icon: SlidersHorizontal },
    { to: "/shop", label: "Public Shop", short: "Shop", icon: Store },
    { to: "/settings", label: "Settings", short: "Settings", icon: Settings },
  ];
}

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const isAdmin = session.role === "admin";
  const items = navFor(isAdmin);
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const bottom = items.slice(0, 4);
  const extra = items.slice(4);

  const doLogout = () => {
    setMoreOpen(false);
    void logout();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Logo />
        </div>
        {isAdmin ? (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-gold/15 px-3 py-2 text-xs font-bold text-gold">
            <ShieldCheck className="h-4 w-4" /> Admin mode
          </div>
        ) : null}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "!bg-sidebar-primary !text-sidebar-primary-foreground font-bold" }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-3 text-xs text-sidebar-foreground/60">{session.email}</div>
          <button
            onClick={doLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <Logo size="sm" />
        {isAdmin ? <span className="rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold text-navy">ADMIN</span> : null}
      </header>

      <main className="px-4 pb-28 pt-5 md:ml-64 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-card md:hidden">
        {bottom.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-semibold text-muted-foreground"
            activeProps={{ className: "!text-navy" }}
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? "grid h-7 w-10 place-items-center rounded-full bg-gold" : "grid h-7 w-10 place-items-center"}>
                  <item.icon className="h-5 w-5" />
                </span>
                {item.short}
              </>
            )}
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-semibold text-muted-foreground"
        >
          <span className="grid h-7 w-10 place-items-center">
            <Menu className="h-5 w-5" />
          </span>
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 px-4 pb-6">
            {extra.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold hover:bg-secondary"
              >
                <item.icon className="h-5 w-5 text-navy" /> {item.label}
              </Link>
            ))}
            <button onClick={doLogout} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-destructive hover:bg-secondary">
              <LogOut className="h-5 w-5" /> Logout
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
