# TRC Garlands — Ideas Backlog

Raw ideas captured live, not yet spec'd or prioritized. Promote to a numbered design doc when ready to build.

---

## Brand / positioning

- **The weave, not sew, technique is THE differentiator — needs to be everywhere, not just About.** Muni weaves garlands using dried banana bark fiber instead of needle-and-thread, so the flower is never pierced. Confirmed (2026-08-10) this should show up in: the About page (done), catalog/product descriptions (`aiGeneratedDescription` on `Product`), and likely the chat assistant's talking points too (`prompt-builder.ts` doesn't mention it yet — Pooja should be able to explain this if a customer asks what makes TRC different).

## Gallery / social proof

- **Gallery page: link making-videos from other platforms.** When a garland is shown in the gallery with its model/product number, show the corresponding "making of" video posted on YouTube/Instagram/Facebook for that model — ties the catalog entry to the existing social content instead of it living disconnected on other platforms. Needs: a way to map product ID → video URL(s) across 3 platforms (manual field on the product record is probably enough to start, no need for API integration).

## Admin / operations

- **Admin dashboard for Muni: manage models, photos, making-videos.** A real CMS-lite UI (not direct DynamoDB edits) so Muni can add new garland models, upload photos, and attach the making-video links above, without needing Sindhuja or a code change. This is the missing piece behind the "Conversations · Media Inbox" nav items already stubbed as TODOs in `app/(admin)/admin/layout.tsx`.
- **EventBridge reminder: order flowers 3 weeks before an event.** A scheduled rule that fires an email to Muni 3 weeks ahead of any order's event date, reminding him to place the flower order in time. `TrcEvents-dev` already has an `EventReminderRule` and an `OrderEventBus` deployed — check whether this is already what that rule does, or if it's a placeholder that needs the actual 3-week-lead-time logic and email step built in.
- **Auto-generate and send the invoice when Muni marks an order done.** When `updateOrderStatus` moves an order to `COMPLETED`, generate an invoice, email it to the client, and CC Muni. The schema already has `invoiceUrl` on `Order` and `TrcStorage-dev` already has an `InvoicesBucket` deployed — so the storage half exists, but nothing generates a PDF, sends email, or hooks into the status-change mutation yet. `notification-sender` (already a Lambda in the repo) is the natural place for the send step.
- **Payment collection once the invoice goes out.** Options, roughly cheapest/fastest to most automated:
  1. Manual mark-as-paid — Muni confirms an Interac e-Transfer arrived, clicks "Mark Paid" in the admin dashboard (see above). Zero payment-processor integration, fits how the business likely already collects payment.
  2. Same as #1, but the invoice includes a scannable QR/link for e-Transfer so the client doesn't have to look up an email address.
  3. Stripe Payment Link generated per invoice, webhook auto-flips order to `PAID` instead of a manual click. More setup (Stripe account + webhook handler), but matches the existing `depositAmount`/`balanceAmount` split on `Order` — could do separate links per stage.
  4. Reminder if unpaid after N days — same EventBridge pattern as the flower-order reminder, nudges the client automatically.
  Leaning toward starting with #1 (no new infra) and layering #3 later if manual confirmation becomes the bottleneck.
