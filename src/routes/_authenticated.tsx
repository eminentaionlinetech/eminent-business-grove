import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/ebh/AppShell";
import { Splash } from "@/components/ebh/Logo";
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
