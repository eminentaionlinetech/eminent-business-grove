import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, LogOut, Mail, Upload, CreditCard, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel } from "@/components/ebh/ui-bits";
import { useApp } from "@/hooks/use-store";
import { changePassword, logout } from "@/lib/auth";
import { updateProfile } from "@/lib/actions";
import { WELCOME_TEMPLATE_HTML, getEmailConfig, isEmailConfigured, saveEmailConfig, sendWelcomeEmail } from "@/lib/email";
import { exportBackup, importBackup } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Eminent Business Hub" },
      { name: "description", content: "Update your business profile, password, email setup and backups." },
      { property: "og:title", content: "Settings — Eminent Business Hub" },
      { property: "og:description", content: "Manage your Eminent Business Hub account." },
    ],
  }),
  component: SettingsPage,
});

const goldBtn = "bg-gold text-navy hover:bg-gold/90";

function SettingsPage() {
  const { session, isAdmin } = useApp();
  const navigate = useNavigate();
  const [business, setBusiness] = useState(session.business);
  const [phone, setPhone] = useState(session.phone);
  const [email, setEmail] = useState(session.email);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [cfg, setCfg] = useState({ publicKey: "", serviceId: "", templateId: "", replyTo: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCfg(getEmailConfig()), []);

  const saveProfile = () => {
    const res = updateProfile(session.email, { business: business.trim(), phone: phone.trim(), email });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Profile saved");
  };

  const savePassword = async () => {
    const res = await changePassword(session.email, cur, next);
    if (!res.ok) { toast.error(res.error); return; }
    setCur("");
    setNext("");
    toast.success("Password changed");
  };

  const download = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ebh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file: File) => {
    try {
      importBackup(await file.text());
      toast.success("Backup restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read this file");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Business profile">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-biz">Business name</Label>
              <Input id="s-biz" value={business} onChange={(e) => setBusiness(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground">Account type: <b>{isAdmin ? "Admin" : "Business owner"}</b></div>
            <Button onClick={saveProfile} className={goldBtn}>Save profile</Button>
          </div>
        </Panel>

        <Panel title="Change password">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-cur">Current password</Label>
              <Input id="s-cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-new">New password</Label>
              <Input id="s-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </div>
            <Button onClick={savePassword} variant="outline">Change password</Button>
            <p className="flex gap-2 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4 shrink-0 text-navy" />
              Sign-in is saved on this device only. For real online security, a proper sign-in server is needed later.
            </p>
          </div>
        </Panel>

        {isAdmin ? (
          <Panel title="Welcome email (EmailJS)">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Status: <b className={isEmailConfigured(cfg) ? "text-success" : "text-info"}>{isEmailConfigured(cfg) ? "Ready" : "Keys not set yet"}</b>. Paste your keys from emailjs.com.
              </p>
              {(["publicKey", "serviceId", "templateId", "replyTo"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`e-${k}`}>{{ publicKey: "Public key", serviceId: "Service ID", templateId: "Template ID", replyTo: "Reply-to email" }[k]}</Label>
                  <Input id={`e-${k}`} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value.trim() })} />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button className={goldBtn} onClick={() => { saveEmailConfig(cfg); toast.success("Email settings saved"); }}>Save</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    saveEmailConfig(cfg);
                    const r = await sendWelcomeEmail(session.email, session.business, "test");
                    if (r.ok) toast.success(`Test email sent to ${session.email}`);
                    else toast.error(r.reason === "not-configured" ? "Add all keys first" : "Sending failed — check Email logs");
                  }}
                >
                  <Mail className="h-4 w-4" /> Send test
                </Button>
                <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(WELCOME_TEMPLATE_HTML); toast.success("Email design copied"); }}>
                  Copy email design
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}

        <Panel title="Backup & restore">
          <p className="mb-3 text-sm text-muted-foreground">Your data lives on this device. Download a backup file often, and restore it on a new phone.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download} className={goldBtn}><Download className="h-4 w-4" /> Download backup</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Restore backup</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
          </div>
        </Panel>

        <Panel title="Payments">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" /> Online payments are coming soon.</p>
        </Panel>

        <Panel title="Account">
          <Button variant="outline" className="text-destructive" onClick={() => { logout(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Your email, business name and phone stay remembered for next time.</p>
        </Panel>
      </div>
    </div>
  );
}
