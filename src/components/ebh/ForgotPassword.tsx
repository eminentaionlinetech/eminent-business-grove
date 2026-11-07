import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { findAccount, resetPassword } from "@/lib/auth";
import type { AppUser } from "@/lib/storage";

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="h-11 pr-11"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type Account = NonNullable<ReturnType<typeof findAccount>>;

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  initialEmail,
  onRecovered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail: string;
  onRecovered: (user: AppUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [proof, setProof] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setAccount(null);
    setProof("");
    setPass("");
    setConfirm("");
    setError("");
  }, [open, initialEmail]);

  const onFind = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const found = findAccount(email);
    if (!found) {
      setError(
        "No account found with this email on this device. Accounts are saved on the phone or browser where they were created — open Eminent Business Hub there, or restore a backup.",
      );
      return;
    }
    setAccount(found);
  };

  const onReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setError("");
    if (pass !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await resetPassword({ email: account.email, proof, newPassword: pass, remember: true });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onRecovered(res.user);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-navy" /> Recover your password
          </DialogTitle>
          <DialogDescription>
            {account
              ? "Confirm it's you, then choose a new password."
              : "Enter the email you used to create your Eminent Business Hub account."}
          </DialogDescription>
        </DialogHeader>

        {!account ? (
          <form onSubmit={onFind} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email</Label>
              <Input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11"
                required
              />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11 w-full bg-gold text-navy hover:bg-gold/90">
              Find my account
            </Button>
          </form>
        ) : (
          <form onSubmit={onReset} className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span className="break-words">
                Account found: <b>{account.business || account.email}</b> ({account.email})
              </span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="fp-proof">
                {account.verifyBy === "phone" ? "Phone number you signed up with" : "Business name on this account"}
              </Label>
              <Input
                id="fp-proof"
                type={account.verifyBy === "phone" ? "tel" : "text"}
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                placeholder={account.verifyBy === "phone" ? "e.g. 0803 123 4567" : "e.g. Ada's Fabrics"}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-pass">New password</Label>
              <PasswordInput id="fp-pass" value={pass} onChange={setPass} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-confirm">Confirm new password</Label>
              <PasswordInput id="fp-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy} className="h-11 w-full bg-gold text-navy hover:bg-gold/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Reset password & sign in
            </Button>
            <button
              type="button"
              onClick={() => {
                setAccount(null);
                setError("");
              }}
              className="w-full text-center text-sm font-semibold text-info hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
