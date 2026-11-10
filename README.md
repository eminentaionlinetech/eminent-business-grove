# Eminent Business Hub — Restore & Transfer Runbook

Build • Manage • Grow. Business management for small businesses in Nigeria.

## How it works
- No database, no migrations. Every account, product, order and customer is saved in the browser (localStorage) on the device used.
- Sign-in is device-only (demo security). For real secure online accounts, add a proper sign-in server later.
- Admin: any email containing "admin" (e.g. admin@eminentbusinesshub.com) or the owner email.

## Backup / restore (do this often)
Settings → Backup & restore → **Download backup**. On a new phone: sign in, Settings → **Restore backup**, pick the file.

## Welcome email (EmailJS) — from your phone
1. emailjs.com → sign up → **Email Services** → add Gmail → copy the **Service ID**.
2. **Email Templates** → Create:
   - Subject: `Welcome to Eminent Business Hub, {{name}}!`
   - To Email: `{{email}}` • From Name: `Eminent Business Hub` • Reply To: `{{reply_to}}`
   - Content: in the app, Settings → **Copy email design**, paste it in the template's HTML/code view.
   - Copy the **Template ID**.
3. **Account → General** → copy the **Public Key**. Under **Security**, add your published app address to Allowed Origins.
4. In the app (signed in as admin): Settings → Welcome email → paste the 3 keys → Save → **Send test**.
Never put real keys or passwords in this README.

## Payments
Paystack is connected (owner's account). In the cart, shoppers choose "Pay now with Paystack" (card, transfer, USSD) or "Pay later". After paying, Paystack sends them back and the app checks the payment before marking orders "Paid online". See every payment, with customer and items, in your Paystack dashboard, then send sellers their share. To change the Paystack key: Lovable → Connectors → Paystack.

## Verification checklist
- Create account → lands on Home, "Welcome back, {Business}".
- Logout → sign-in screen shows email and password pre-filled.
- Admin email → Admin Dashboard with all users and email logs.
- Marketing Studio shows the blue "Eminent Marketing Engine Active" message.

## Troubleshooting
- Data missing on another phone: data is per device — use Backup & restore.
- Forgot password: on the sign-in screen tap "Forgot password?", enter the sign-up email, confirm the sign-up phone number, and choose a new password (works on the device where the account was created).
- Email not arriving: check Admin → Customers / Users → Email logs.
