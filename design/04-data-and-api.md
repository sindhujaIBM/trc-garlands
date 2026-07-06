# Data & API Design

DynamoDB schema additions and the AppSync GraphQL contract for the configurator. Tables defined in [../architecture-plan.md](../architecture-plan.md) § 3 (`trc-orders`, `trc-customers`, `trc-products`, `trc-chat-sessions`, `trc-seasonal-events`, `trc-flower-availability`, `trc-pricing-rules`, `trc-supplier-pricing-history`, `trc-media-uploads`) are reused unchanged except where noted.

---

## 1. DynamoDB schema

### 1.1 New: `trc-catalog` — all configurator reference data, one query

Everything the configurator needs to render options and compute estimates is small, read-together reference data. Single-table it so page load is **one Query**:

```
PK: CATALOG    SK: <entity>

SK: FLOWER#<flowerId>            # chrysanthemum | carnation | rose | babys-breath | hydrangea | orchid
  name, namesLocal: {ta, hi, te}          # cultural depth in the UI and AI chat
  colors: [{colorId, label, hex}]          # drives Step 4 swatches
  ratePerFoot: {standard, premium, royal}  # CAD — the pricing matrix row
  stemGrams                                # weight model
  isActive, comingSoon                     # orchid ships with comingSoon: true
  photoKeys: [s3Key]
  sortOrder

SK: STYLE#<styleId>              # traditional | modern | royal | temple-style | minimal | luxury
  name, description, complexityFactor      # 0.95 – 1.35
  suggestedForOccasions: [occasionId]
  suggestedAddons: [addonId]
  photoKeys, sortOrder, isActive

SK: ADDON#<addonId>              # peacock-feathers | pearl-strings | golden-lace |
  name, price, maxQty, photoKey  # decorative-ribbon | custom-initials | fresh-leaf-accents
  isActive, sortOrder

SK: OCCASION#<occasionId>        # wedding | temple | kalyanotsavam | engagement | housewarming |
  name, heroPhotoKey, seoSlug    # naming-ceremony | birthday | anniversary |
  suggestedStyle, suggestedFlowers[]       # religious-decoration | floral-decoration
  lengthPreset, copyTone, sortOrder

SK: SETTINGS#pricing
  craftFee: {standard: 20, premium: 28, royal: 40}
  stemsPerFoot: {standard: 14, premium: 20, royal: 28}
  currencyGarland: {laborRatePerFoot: 26, craftFee: 30}
  estimateBandPercent: 8
  backingGramsPerFoot: 40
  maxFlowerTypes: 3
  rushWindowBusinessDays: {min: 4, max: 7}, rushSurchargePercent: 20
```

Muni edits every item above from the admin (05-aws-and-cms.md). A `versionStamp` attribute on `SETTINGS#pricing` busts the frontend React Query cache via the catalog query's `catalogVersion` field.

### 1.2 New: `trc-saved-designs`

Every checkout path persists the design first; shared links and AI prefills land here too.

```
PK: DESIGN#<shareId>             # 8-char base58, embedded in trcgarlands.com/design/<shareId>
  configuration                  # the GarlandConfiguration JSON, verbatim
  source                         # configurator | ai-image | ai-invitation | ai-designer | shared-link
  customerId?                    # set when authenticated
  estimateAtSave: {low, high}    # what the customer saw (analytics + Muni context)
  createdAt
  ttl                            # anonymous designs: 180 days; authenticated: none

GSI1: CUSTOMER#<customerId> + createdAt      # "My Designs" page
```

### 1.3 New: `trc-quotes`

The authoritative, short-lived output of the quote-engine.

```
PK: QUOTE#<quoteId>
  designShareId, configuration             # config frozen at quote time
  lineItems: [{label, amount}]             # body, craft fee, style, add-ons, adjustments
  total, currency: "CAD"
  ruleVersionsApplied: [{ruleId, version}] # exact rule versions (auditability)
  seasonalEventIds[]
  status: ACTIVE | CONVERTED | EXPIRED
  createdAt, expiresAt                     # 48 h — matches QUOTED expiry in the order lifecycle
  ttl                                      # auto-cleanup 30 days after expiry
```

On order creation the quote's line items become the order's existing `pricingSnapshot`, and `status → CONVERTED`.

### 1.4 New: `trc-site-content`

CMS-managed marketing surfaces (see 05-aws-and-cms.md for the editing UX).

```
PK: CONTENT#<type>    SK: <itemId>         # type: BANNER | PROMOTION | COLLECTION

BANNER:      message, linkTo, startsAt, endsAt, isActive        # festival banners
PROMOTION:   pricingRuleId (→ trc-pricing-rules), heroCopy, badgeLabel
COLLECTION:  name, slug, description, photoKeys[],
             designShareId                 # → trc-saved-designs: "Start from this design"
             occasionIds[], sortOrder, isActive
```

### 1.5 New: `trc-leads`

Callback requests and non-chat lead capture (chat leads stay on `trc-chat-sessions.capturedLead`).

```
PK: LEAD#<leadId>
  name, phone, preferredTime, designShareId?, occasion?
  status: NEW | CONTACTED | CONVERTED | CLOSED
  createdAt
GSI1: STATUS#<status> + createdAt          # Muni's follow-up queue
```

### 1.6 Extensions to existing tables

- **`trc-orders`** — each entry of `garlandItems[]` gains `configuration` (the full `GarlandConfiguration`) and the order gains `quoteId` + `designShareId`. The existing `pricingSnapshot`, state machine, GSIs: unchanged.
- **`trc-flower-availability`** — no schema change; its `importRequired` + monthly `availabilityScore` now also drive the Step 3 availability pills and the import surcharge rule.
- **`trc-pricing-rules`** — no schema change; the configurator adds new rule instances (import surcharge, rush, promos), not new structure.
- **`trc-products`** — remains for gallery/catalog photos; collections in `trc-site-content` reference designs rather than duplicating product data.

---

## 2. GraphQL API (AppSync)

Auth modes as in ../architecture-plan.md: **API key** for public reads, **Cognito** for customer operations, Cognito **admin group** for CMS. Resolvers are Lambda or direct DynamoDB per operation.

```graphql
# ── Public (API key) ─────────────────────────────────────────────

type Query {
  # One call on configurator load: entire trc-catalog partition
  getCatalog: Catalog!                     # flowers, styles, addons, occasions,
                                           # pricingSettings, catalogVersion

  # Time-sensitive context for estimates, keyed by event month:
  # active pricing rules, seasonal events, per-flower availability + importRequired
  getPricingContext(eventMonth: AWSDate): PricingContext!

  getSharedDesign(shareId: ID!): SavedDesign      # /design/[shareId]
  listCollections(occasion: String): [Collection!]!
  getActiveBanners: [Banner!]!
}

type Mutation {
  # Persist a design before any checkout path (anonymous allowed)
  saveDesign(configuration: AWSJSON!, source: ConfigSource!): SavedDesign!

  # Authoritative quote — quote-engine Lambda, shared pricing function, live data
  requestQuote(shareId: ID!): Quote!

  submitCallbackRequest(input: CallbackInput!): Lead!

  # existing chat mutations from ../architecture-plan.md unchanged
}

# ── Customer (Cognito) ───────────────────────────────────────────

type Query {
  listMyDesigns: [SavedDesign!]!
  listMyOrders: [Order!]!                  # existing
  getOrder(orderId: ID!): Order            # existing, owner-checked
}

type Mutation {
  # Converts an ACTIVE quote into an order at INQUIRY→QUOTED→DEPOSIT_PENDING;
  # Stripe PaymentIntent for deposit; enters existing Step Functions lifecycle
  createOrderFromQuote(quoteId: ID!, delivery: DeliveryInput!): Order!
}

type Subscription {
  onOrderStatusChanged(orderId: ID!): Order   # existing — live status on /orders/[id]
}

# ── Admin (Cognito admin group) ──────────────────────────────────

type Mutation {
  upsertCatalogItem(item: CatalogItemInput!): CatalogItem!   # flower/style/addon/occasion
  updatePricingSettings(settings: PricingSettingsInput!): PricingSettings!
  upsertPricingRule(rule: PricingRuleInput!): PricingRule!   # writes new VERSION#<n>
  upsertSeasonalEvent(event: SeasonalEventInput!): SeasonalEvent!  # existing table
  upsertContent(content: ContentInput!): ContentItem!        # banners/promos/collections
  updateLeadStatus(leadId: ID!, status: LeadStatus!): Lead!
  # existing admin mutations (orders, media inbox, flower availability) unchanged
}
```

Notes:

- **`configuration` travels as `AWSJSON`** validated by the shared `packages/shared/validation/config.ts` inside resolvers — GraphQL doesn't re-model the config type, avoiding schema drift against the TypeScript source of truth.
- **No `estimate` query exists.** Estimation is deliberately client-side (pure function over `getCatalog` + `getPricingContext`); the server only ever issues real quotes. This keeps the preview at zero latency and the authority boundary sharp.
- **`getCatalog` + `getPricingContext` are cacheable** (AppSync caching or CloudFront on the API key endpoint) — they change only when Muni edits, signaled by `catalogVersion`.
- Field-level auth carries over from ../architecture-plan.md (customer PII owner-or-admin, `muniNotes` admin-only).

---

## 3. Access patterns → index check

| Pattern | Table / index |
|---|---|
| Configurator load (all options + settings) | `trc-catalog` Query PK=CATALOG |
| Estimate context by event month | `trc-pricing-rules` (active), `trc-seasonal-events` (by year), `trc-flower-availability` (FLOWER#x, AVAILABILITY#month) — existing keys suffice |
| Open shared design | `trc-saved-designs` get by shareId |
| My designs | `trc-saved-designs` GSI1 customer |
| Quote lookup at checkout | `trc-quotes` get by quoteId |
| Muni: new leads queue | `trc-leads` GSI1 STATUS#NEW |
| Muni: which quotes convert | `trc-quotes` scan-on-demand (volume ≈ tens/month — a scan is honest here) |
| Collections by occasion | `trc-site-content` Query PK=CONTENT#COLLECTION, filter occasionIds (small set) |

At 2–50 orders/month, every pattern above sits comfortably in DynamoDB free tier; no new GSIs beyond the two listed.
