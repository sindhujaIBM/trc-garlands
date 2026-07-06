# AWS Architecture Delta & CMS Design

[../architecture-plan.md](../architecture-plan.md) remains the AWS reference: region `ca-west-1` (PIPEDA), AppSync + Cognito, Lambda business logic, Step Functions order lifecycle, Stripe, SES/SNS, S3/CloudFront, CDK, and the cost envelope (~$8–15/month at real scale). This doc lists only what the configurator adds or changes.

---

## 1. What's new

```
                         ┌────────────────────────────────────────┐
                         │  Next.js on Amplify Hosting            │
                         │  + /build configurator (client state)  │
                         │  + /occasions/* SSG/ISR SEO pages      │
                         │  + client-side estimator (pure fn)     │
                         └──────────────┬─────────────────────────┘
                                        │ AppSync (existing)
        ┌───────────────────────────────┼───────────────────────────────┐
        │ NEW resolvers                 │ EXTENDED                      │
        │  saveDesign        (DDB direct)  quote-engine Lambda          │
        │  getSharedDesign   (DDB direct)   ├ consumes GarlandConfig    │
        │  getCatalog        (DDB direct)   ├ shared pricing fn from    │
        │  getPricingContext (Lambda)       │   packages/shared         │
        │  submitCallback    (DDB+SNS)      └ writes trc-quotes         │
        │  admin CMS mutations (DDB direct, admin group)                │
        └───────────────────────────────┬───────────────────────────────┘
                                        │
          NEW tables: trc-catalog · trc-saved-designs · trc-quotes
                      trc-site-content · trc-leads     (all on-demand)
```

Component-by-component:

- **`quote-engine` Lambda (extended, not new)** — now imports the same pure pricing function the browser uses (from `packages/shared`), reads live catalog/rules/availability, writes `trc-quotes` with rule-version audit trail. Still the only source of authoritative prices.
- **Direct DynamoDB resolvers** wherever no logic is needed (`getCatalog`, `saveDesign`, shared-design reads, CMS upserts) — fewer Lambdas, fewer cold starts, zero cost.
- **`getPricingContext`** is a small Lambda (assembles rules + seasonal events + availability for a target month). Response cacheable.
- **AppSync caching** on the two public queries (`getCatalog`, `getPricingContext`), TTL 5 minutes, invalidated in practice by `catalogVersion` from admin saves. At this traffic the cache is about snappiness, not cost.
- **Amplify Hosting** — unchanged; occasion pages use ISR so "from $X" anchors refresh when Muni edits pricing without a redeploy.
- **CDK** — new tables join `database-stack.ts`; new resolvers join `api-stack.ts`. No new stacks.

**Model updates (supersedes prior doc's model names):** customer-facing chat uses the current Bedrock Claude Haiku-class model; multimodal image analysis and content generation use the current Sonnet-class model; Nova Micro stays for internal summaries. Model IDs are CDK context values, not code, so future swaps are config changes.

**Cost impact:** five on-demand tables at tens of writes/day, a few thousand extra resolver invocations/month — all inside free tier. AppSync cache is optional (adds fixed cost; skip at launch, revisit if preview traffic grows). Net change: **≈ $0/month.**

**Security carry-over:** new tables get the same per-function least-privilege IAM pattern; `trc-saved-designs` and `trc-leads` contain light PII → owner-or-admin field auth, TTL on anonymous designs, and inclusion in the existing PIPEDA data-deletion endpoint.

---

## 2. CMS design — Muni's admin

Requirement: flowers, prices, availability, product images, collections, seasonality, promotions, and festival banners manageable by a non-technical user, with zero developer involvement. Decision (locked): **extend the custom Cognito-protected admin** from ../architecture-plan.md § 11 rather than adding a headless CMS — pricing rules and availability already live in DynamoDB, and splitting content across two systems would guarantee drift.

### 2.1 Admin sitemap

```
/admin
├── /                    Dashboard: today's alerts, week calendar, pending payments,
│                        NEW: quote requests + callback leads queue
├── /orders              existing (status queue, mark-complete, cancellation calc)
├── /leads               NEW: callback requests + WhatsApp-originated designs,
│                        each with the customer's config + estimate they saw
├── /catalog             NEW: flowers · styles · add-ons · occasions
├── /pricing             NEW: rate matrix · pricing rules · seasonal events
├── /content             NEW: collections · festival banners · promotions
├── /media               existing media inbox (phone uploads, AI-tagged)
└── /conversations       existing AI chat summaries + follow-up queue
```

### 2.2 The screens that matter

**Catalog → Flowers.** Card per flower: photo, active toggle, "coming soon" toggle (this is how orchid launches — one tap), color chips (add/remove, hex picker), local names (ta/hi/te), stem weight. Rate editing intentionally lives on the pricing page, not here — one place where money changes.

**Pricing → Rate matrix.** The flower × thickness grid, inline-editable:

```
┌─────────────────────────────────────────────────────┐
│ Per-foot rates (CAD)      Standard  Premium  Royal  │
│ Chrysanthemum              [12]     [18]     [26]   │
│ Carnation                  [14]     [21]     [30]   │
│ Rose                       [18]     [27]     [42]✎  │
│ …                                                    │
│ Craft fee                  [20]     [28]     [40]   │
│─────────────────────────────────────────────────────│
│ Preview: "Royal wedding pair, rose+carnation, 5 ft,  │
│ pearl strings, June" → $629.20  (was $609.40)        │
│                              [Discard]  [Save rates] │
└─────────────────────────────────────────────────────┘
```

The preview pane runs the same shared pricing function against a pinned sample build, so Muni sees the customer-facing consequence *before* saving. Saves bump `catalogVersion`; live estimates refresh within minutes; locked quotes and in-flight orders are untouched (`pricingSnapshot`).

**Pricing → Rules.** List of adjustment rules (import, rush, promos) with toggle, percentage, validity window, and the customer-facing message field front and center — Muni writes the sentence customers will read. Every save writes a new version (existing `VERSION#<n>` pattern), and quotes record which version they used.

**Pricing → Seasonal events.** The existing seasonal-events editor, unchanged, now also feeding configurator warnings.

**Content → Collections.** "Create collection from a design": Muni picks a saved design (often one she built herself in the public configurator — the configurator doubles as her merchandising tool), attaches photos from the media inbox, writes a title. It appears on `/collections` with a working "Start from this design" button.

**Content → Banners & promotions.** Festival banner: message, link, start/end dates (auto on/off — no 2 a.m. Diwali-morning edits). Promotions bind a discount pricing rule to hero copy and a badge.

**Leads queue.** Callback requests and quote conversations, each showing the exact `GarlandConfiguration` and the estimate the customer saw — Muni opens WhatsApp already knowing the build.

### 2.3 Non-technical guardrails

- Numeric inputs validated (rates > 0, percentages capped) with plain-language errors.
- Preview-before-save anywhere money changes.
- Nothing deletes — items deactivate (`isActive: false`), consistent with quote/order snapshots.
- Every admin write is attributable (Cognito identity in resolver context → `updatedBy`), on top of CloudTrail.
- Mobile-friendly throughout — Muni runs this business from her phone, same as the media inbox flow already designed.
