import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ebh/Logo";
import { PasswordInput } from "@/components/ebh/ForgotPassword";
import { finishPasswordReset } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Eminent Business Hub" },
      { name: "description", content: "Set a new password for your Eminent Business Hub account." },
      { property: "og:title", content: "Reset password — Eminent Business Hub" },
      { property: "og:description", content: "Choose a new password and get back to your business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (pass !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    const res = await finishPasswordReset(pass);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    if (res.needsConfirm) return;
    toast.success("Password reset successful!");
    navigate({ to: res.session.role === "admin" ? "/admin" : "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-navy-gradient px-5 py-8">
      <Logo full className="mx-auto" />
      <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <h1 className="text-xl font-extrabold">Choose a new password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="rp-pass">New password</Label>
          <PasswordInput id="rp-pass" value={pass} onChange={setPass} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-confirm">Confirm new password</Label>
          <PasswordInput id="rp-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy} className="h-11 w-full bg-gold text-navy hover:bg-gold/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save & sign in
        </Button>
        <Link to="/" className="block text-center text-sm font-semibold text-info">Back to sign in</Link>
      </form>
    </div>
  );
}
