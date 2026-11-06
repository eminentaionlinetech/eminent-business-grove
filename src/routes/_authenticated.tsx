import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/ebh/AppShell";
import { Logo } from "@/components/ebh/Logo";
import { useSession } from "@/hooks/use-store";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const session = useSession();
  if (session === undefined) return <Splash />;
  if (session === null) return <Navigate to="/" />;
  return (
    <AppShell session={session}>
      <Outlet />
    </AppShell>
  );
}

export function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-navy text-primary-foreground">
      <Logo size="lg" />
    </div>
  );
}
