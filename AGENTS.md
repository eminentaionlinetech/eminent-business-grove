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
- All app data lives in browser localStorage via `src/lib/storage.ts` (no database) — the owner requires on-device storage only. The only server code is the Paystack calls.
- Signed-in pages live under `src/routes/_authenticated/`; the layout guards the session and renders the shared shell.
- Pure business rules (revenue, stock, analytics) stay in `src/lib/business.ts` so they are unit-tested in `src/test/rules.test.ts`.
- Welcome emails go through EmailJS in the browser; keys are entered by the admin in Settings, never committed.
- The public shop lives under `src/routes/shop/` (outside the signed-in area) and only shows vendor business name and phone, never emails or passwords — shoppers are anonymous.
- Product photos uploaded from a phone are shrunk to small JPEG data and stored on the product itself — keeps everything on-device.
- The shopper's cart is saved on the shopper's phone (`ebh_cart`); checkout turns each cart line into its own Pending order for that line's seller, all-or-nothing — orders stay one product each so stock and revenue rules keep working.
- Sellers control their public store with `shopOpen`/`shopBio` on their user and `hidden` on each product; `shopListing` is the single filter every shop page and order action goes through.
- Paystack runs only on the server (`src/lib/paystack.functions.ts` → connector gateway `udc_paystack`); the browser never sees the key, and orders turn "paid" only after `verifyPaystackPayment` confirms the exact amount (`paymentMatches`).
- Pay-now orders are created first as unpaid with a `paymentRef`, and the attempt is kept in `ebh_pending_payment` so the `/shop/payment` return page can confirm or retry it.
