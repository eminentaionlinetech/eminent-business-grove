// Welcome emails via EmailJS (browser SDK). Keys are placeholders until set in Settings.
import { OWNER_EMAIL } from "./auth";
import { KEYS, addEmailLog, readJson, writeJson, type EmailJsConfig } from "./storage";

export const APP_URL = "https://eminentbusinesshub.com";
export const SENDER_NAME = "Eminent Business Hub";

const PLACEHOLDERS: EmailJsConfig = {
  publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
  serviceId: "YOUR_SERVICE_ID",
  templateId: "YOUR_TEMPLATE_ID",
  replyTo: OWNER_EMAIL,
};

export function getEmailConfig(): EmailJsConfig {
  const env = import.meta.env;
  const stored = readJson<Partial<EmailJsConfig>>(KEYS.emailjs, {});
  return {
    publicKey: stored.publicKey || env["VITE_EMAILJS_PUBLIC_KEY"] || PLACEHOLDERS.publicKey,
    serviceId: stored.serviceId || env["VITE_EMAILJS_SERVICE_ID"] || PLACEHOLDERS.serviceId,
    templateId: stored.templateId || env["VITE_EMAILJS_TEMPLATE_ID"] || PLACEHOLDERS.templateId,
    replyTo: stored.replyTo?.trim().toLowerCase() === "okechukwudestiny428@gmail.com"
      ? OWNER_EMAIL
      : stored.replyTo || PLACEHOLDERS.replyTo,
  };
}

export function saveEmailConfig(cfg: EmailJsConfig) {
  writeJson(KEYS.emailjs, cfg);
}

export function isEmailConfigured(cfg = getEmailConfig()) {
  return !Object.values(cfg).some((v) => !v || v.startsWith("YOUR_"));
}

export async function sendWelcomeEmail(email: string, business: string, kind: "welcome" | "test" = "welcome") {
  const cfg = getEmailConfig();
  if (!isEmailConfigured(cfg)) {
    addEmailLog({ to: email, kind, status: "skipped", detail: "EmailJS keys not set yet (Settings → Welcome email)." });
    return { ok: false, reason: "not-configured" as const };
  }
  // SEND WELCOME EMAIL FROM EBH
  try {
    const emailjs = (await import("@emailjs/browser")).default;
    await emailjs.send(
      cfg.serviceId,
      cfg.templateId,
      {
        name: business || email,
        to_name: business || email,
        email,
        to_email: email,
        from_name: SENDER_NAME,
        reply_to: cfg.replyTo,
        app_url: APP_URL,
      },
      { publicKey: cfg.publicKey },
    );
    addEmailLog({ to: email, kind, status: "sent", detail: `Sent as "${SENDER_NAME}", reply-to ${cfg.replyTo}` });
    return { ok: true as const };
  } catch (e) {
    const detail =
      e && typeof e === "object" && "text" in e ? String((e as { text: unknown }).text) : String(e);
    addEmailLog({ to: email, kind, status: "failed", detail });
    return { ok: false, reason: "failed" as const, detail };
  }
}

export const WELCOME_SUBJECT = "Welcome to Eminent Business Hub, {{name}}!";

export const WELCOME_TEMPLATE_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <div style="background:#001a4d;padding:24px;text-align:center">
      <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:1px">EMINENT BUSINESS HUB</div>
      <div style="color:#ffcc00;font-size:13px;margin-top:6px">Build • Manage • Grow</div>
    </div>
    <div style="padding:28px;color:#001a4d;font-size:15px;line-height:1.6">
      <p>Welcome to the Eminent Business Hub family, {{name}}!</p>
      <p>Your account <b>{{email}}</b> has been successfully created.</p>
      <p>You can now add your products, take orders, track your customers and create marketing posts — all in one place. Build, Manage and Grow your business with us.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="https://eminentbusinesshub.com" style="background:#ffcc00;color:#001a4d;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Open Eminent Business Hub</a>
      </p>
      <p style="font-size:13px;color:#555">Launch. Grow. Succeed. — Built in Port Harcourt. Trusted across Nigeria.</p>
    </div>
  </div>
</div>`;
