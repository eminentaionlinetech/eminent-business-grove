<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Accounts, products, orders, customers live online in Lovable Cloud so every shopper sees every seller's products. `src/lib/cloud.ts` loads them into the in-memory `db` (with live updates); pages read it through `useCollection`/`useApp`, and all writes go through `src/lib/actions.ts`.
- Signed-in pages live under `src/routes/_authenticated/`; the layout guards the session and renders the shared shell.
- Pure business rules (revenue, stock, analytics) stay in `src/lib/business.ts` so they are unit-tested in `src/test/rules.test.ts`.
- Welcome emails go through EmailJS in the browser; keys are entered by the admin in Settings, never committed.
- The public shop lives under `src/routes/shop/` (outside the signed-in area) and only shows vendor business name and phone, never emails or passwords — shoppers are anonymous.
- Phone photos are shrunk to small JPEG data in the `product_photos` table and products point to them as `photo:<productId>`; `ProductImage` loads them in batches. (Public storage buckets are blocked in this workspace.)
- The shopper's cart stays on the shopper's phone (`ebh_cart`); checkout calls the `place_shop_order` database function, which makes one Pending order per line, takes stock atomically and is all-or-nothing.
- Sellers control their public store with `shopOpen`/`shopBio` on their user and `hidden` on each product; `shopListing` is the single filter every shop page and order action goes through.
- Paystack runs only on the server (`src/lib/paystack.functions.ts` → connector gateway `udc_paystack`); the server reads the order total itself, and only `verifyPaystackPayment` (service role) can mark orders paid — a trigger blocks payment-field edits by anyone else.
- Pay-now orders are created unpaid with a checkout `paymentRef`; Paystack attempts use that code plus `-r…` for retries (`paymentBase`), and the attempt is kept in `ebh_pending_payment` for `/shop/payment`.
- The logo PNGs are bundled from `src/assets/` (plain image imports, not CDN pointers) so the logo also shows when the app is hosted outside Lovable, e.g. on Vercel.
- Admin is a row in `user_roles`, granted by a database trigger only to the owner emails after the email is confirmed; never decide admin from the browser.
- Password recovery uses the email reset link and `/reset-password`; accounts from the old on-phone version move online on first sign-in (`src/lib/migrate.ts`).
