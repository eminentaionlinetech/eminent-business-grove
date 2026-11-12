import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requestPasswordReset } from "@/lib/auth";

export function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="h-11 pr-11" required />
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

/** Sends a password reset link to the email used at sign-up. */
export function ForgotPasswordDialog({ open, onOpenChange, initialEmail }: { open: boolean; onOpenChange: (open: boolean) => void; initialEmail: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setSent(false);
    setError("");
  }, [open, initialEmail]);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await requestPasswordReset(email);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-navy" /> Recover your password</DialogTitle>
          <DialogDescription>Enter the email you used to create your Eminent Business Hub account. We'll send you a link to choose a new password.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-sm text-success">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">Check <b>{email.trim()}</b> (and your spam folder). Open the link, choose a new password, and you're signed in.</span>
            </p>
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={onSend} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email</Label>
              <Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-11" required />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy} className="h-11 w-full bg-gold text-navy hover:bg-gold/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send reset link
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
