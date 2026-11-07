import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Copy, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo, Splash } from "@/components/ebh/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-store";
import { ADMIN_RECOVERY_SNIPPET, DEFAULT_ADMIN_EMAIL, OWNER_EMAIL, getRememberedDetails, signIn, signUp } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Eminent Business Hub" },
      { name: "description", content: "Sign in or create your free Eminent Business Hub account to manage products, orders and marketing." },
      { property: "og:title", content: "Eminent Business Hub — Build • Manage • Grow" },
      { property: "og:description", content: "Business management for small businesses in Nigeria. Built in Port Harcourt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
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

function AuthPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [adminFocusRequest, setAdminFocusRequest] = useState(0);

  useEffect(() => {
    if (adminFocusRequest > 0) document.getElementById("si-pass")?.focus();
  }, [adminFocusRequest]);

  // Pre-fill remembered details from this device.
  useEffect(() => {
    const d = getRememberedDetails();
    setEmail(d.email);
    setBusiness(d.business);
    setPhone(d.phone);
    setPassword(d.password);
    setRemember(d.remember);
    if (!d.email) setTab("signup");
  }, []);

  if (session === undefined) return <Splash />;
  if (session) return <Navigate to={session.role === "admin" ? "/admin" : "/dashboard"} />;

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await signIn({ email, password, remember });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success(`Welcome back, ${res.user.business}!`);
    navigate({ to: res.user.role === "admin" ? "/admin" : "/dashboard" });
  };

  const onSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await signUp({ email, business, phone, password, remember });
    if (!res.ok) {
      setBusy(false);
      { setError(res.error); return; }
    }
    const mail = await sendWelcomeEmail(res.user.email, res.user.business);
    setBusy(false);
    toast.success("Account created!", {
      description: mail.ok ? "A welcome email is on its way." : undefined,
    });
    navigate({ to: res.user.role === "admin" ? "/admin" : "/dashboard" });
  };

  const rememberBox = (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
      Remember me for 30 days
    </label>
  );

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-2">
      <div className="bg-navy-gradient px-6 pb-10 pt-8 text-primary-foreground md:flex md:flex-col md:justify-between md:p-12">
        <Logo full className="mx-auto md:mx-0" />
        <div className="mt-8 md:mt-0">
          <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">
            From chaos <br className="hidden md:block" />
            to <span className="text-gold">control.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm opacity-85 md:text-base">
            Track products, orders, customers and marketing for your shop, Instagram or WhatsApp business — all from your phone.
          </p>
        </div>
        <p className="mt-8 hidden text-sm text-gold md:block">Launch. Grow. Succeed. — Built in Port Harcourt. Trusted across Nigeria.</p>
      </div>

      <div className="flex items-start justify-center px-5 py-8 md:items-center">
        <div className="w-full max-w-md -mt-14 rounded-2xl border bg-card p-6 shadow-card md:mt-0">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "signin" | "signup"); setError(""); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="mt-4 space-y-4">
                {business ? <p className="text-sm text-muted-foreground">Welcome back, <b className="text-foreground">{business}</b> 👋</p> : null}
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-pass">Password</Label>
                  <PasswordInput id="si-pass" value={password} onChange={setPassword} autoComplete="current-password" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  {rememberBox}
                  <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-semibold text-info hover:underline">
                    Forgot password?
                  </button>
                </div>
                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                <Button type="submit" disabled={busy} className="h-11 w-full bg-gold text-navy shadow-gold hover:bg-gold/90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-business">Business name</Label>
                  <Input id="su-business" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Ada's Fabrics" className="h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-phone">Phone</Label>
                  <Input id="su-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" autoComplete="tel" className="h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-pass">Password</Label>
                  <PasswordInput id="su-pass" value={password} onChange={setPassword} autoComplete="new-password" />
                </div>
                {rememberBox}
                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                <Button type="submit" disabled={busy} className="h-11 w-full bg-gold text-navy shadow-gold hover:bg-gold/90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create my account
                </Button>
              </form>
            </TabsContent>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="mt-5 h-11 w-full border-navy font-semibold text-navy"
              onClick={() => {
                setTab("signin");
                setEmail(OWNER_EMAIL);
                setPassword("");
                setError("");
                setAdminFocusRequest((request) => request + 1);
              }}
            >
              <ShieldCheck className="h-4 w-4" /> Sign in as Admin
            </Button>
            {adminFocusRequest > 0 ? (
              <p role="status" className="mt-3 break-words rounded-lg bg-secondary p-3 text-sm text-foreground">
                Signing in with <strong>{OWNER_EMAIL}</strong> or <strong>{DEFAULT_ADMIN_EMAIL}</strong> gives full admin access on this device. Enter your password to continue.
              </p>
            ) : null}
          </Tabs>

          <p className="mt-5 flex gap-2 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4 shrink-0 text-navy" />
            Your account and data are saved on this device only. For secure online accounts, a proper sign-in server is needed later.
          </p>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot password?</DialogTitle>
            <DialogDescription>
              Passwords are stored on this device only, so there is no reset email. You can sign in as admin instead.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Sign in with <b>{DEFAULT_ADMIN_EMAIL}</b> (or any email containing "admin") and a new password. The first admin sign-in on a device creates the admin account.
            </li>
            <li>Or, on a computer, open the browser console and paste this line:</li>
          </ol>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-navy p-3 text-xs text-gold">{ADMIN_RECOVERY_SNIPPET}</pre>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(ADMIN_RECOVERY_SNIPPET);
                toast.success("Copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy line
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90"
              onClick={() => {
                setEmail(DEFAULT_ADMIN_EMAIL);
                setPassword("");
                setTab("signin");
                setForgotOpen(false);
              }}
            >
              Sign in as admin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
