# Configurator Specification

The configurator is the product. Everything else on the site funnels into it, and everything downstream (pricing, orders, AI features, sharing) consumes its output. This doc defines that output (`GarlandConfiguration`), the nine steps that build it, and the React component structure that renders it.

---

## 1. The `GarlandConfiguration` contract

One serializable object. It is at once:

- the configurator's wizard state,
- the input to the pricing engine (client estimate and server quote — see [03-pricing-engine.md](03-pricing-engine.md)),
- the payload of all three checkout paths (WhatsApp, online order, callback),
- the output format of every future AI feature (see [06-ai-roadmap-and-differentiators.md](06-ai-roadmap-and-differentiators.md)),
- a shareable, saveable design.

```typescript
// packages/shared — single source of truth, imported by frontend and Lambdas

export interface GarlandConfiguration {
  version: 1;                       // schema version for forward migration

  occasion: OccasionId | null;      // step 1
  style: StyleId | null;            // step 2
  flowers: FlowerSelection[];       // step 3 (+ colors in step 4)
  lengthFt: LengthFt | null;        // step 5 — TOTAL length; drapes lengthFt/2 per side
  thickness: ThicknessId | null;    // step 6
  addons: AddonSelection[];         // step 7
  special?: SpecialOptions;         // currency garland, custom initials

  quantity: number;                 // identical garlands (default 1; weddings often 2)
  eventDate?: string;               // ISO date — drives lead-time + rush + seasonal checks
  notes?: string;                   // free text carried into quote/order

  source: ConfigSource;             // provenance — see § 1.1
}

export type OccasionId =
  | 'wedding' | 'temple' | 'kalyanotsavam' | 'engagement'
  | 'housewarming' | 'naming-ceremony' | 'birthday' | 'anniversary'
  | 'religious-decoration' | 'floral-decoration';

export type StyleId =
  | 'traditional' | 'modern' | 'royal' | 'temple-style' | 'minimal' | 'luxury';

export interface FlowerSelection {
  flowerId: FlowerId;
  colorIds: string[];               // constrained to that flower's available colors
  proportion?: number;              // 0–1, share of the garland body; omitted = equal split
}

export type FlowerId =
  | 'chrysanthemum' | 'carnation' | 'rose'
  | 'babys-breath' | 'hydrangea' | 'orchid';   // orchid: comingSoon flag in catalog

export type LengthFt = 3 | 4 | 5 | 6;
export type ThicknessId = 'standard' | 'premium' | 'royal';

export interface AddonSelection {
  addonId: string;                  // 'peacock-feathers' | 'pearl-strings' | 'golden-lace'
                                    // | 'decorative-ribbon' | 'custom-initials' | 'fresh-leaf-accents'
  qty: number;
}

export interface SpecialOptions {
  currencyGarland?: {
    clientSuppliedMaterials: true;  // always true — TRC never supplies currency
    notesDescription?: string;      // e.g. "40 × $5 CAD bills, client drops off Tuesday"
  };
  customInitials?: string;          // max 4 chars, paired with 'custom-initials' addon
}

export type ConfigSource =
  | 'configurator'    // built by hand on the site
  | 'ai-image'        // Phase 2: photo upload → prefill
  | 'ai-invitation'   // Phase 2: wedding invitation → prefill
  | 'ai-designer'     // Phase 2: text prompt → prefill
  | 'shared-link';    // opened from a ?config= URL
```

Rules that keep the contract honest:

- **Partial configs are legal.** Any field except `version`, `quantity`, and `source` may be null/empty. AI features emit partials; the configurator opens at the first unfilled step.
- **Validation lives in `packages/shared/validation/config.ts`** and runs identically in the browser (instant feedback) and in the quote-engine Lambda (authority). Never two implementations.
- **URL encoding**: `?config=<base64url(JSON)>`. Compact enough for the enum-based fields; validated on load, invalid params fall back to a fresh configurator with a toast.
- **Currency garland** disables the flowers/colors steps' *required* status (flower accents remain optional) and forces the labor-only pricing path. The client-supplies-currency disclaimer renders in the step UI, the live preview, and every quote/order summary.

### 1.1 Provenance matters

`source` is kept through to the order record. It answers, six months in: do people actually use the AI entry points, do shared links convert, is the configurator the funnel we think it is.

---

## 2. The nine steps

Steps are linear with free back-navigation; completed steps show as chips that jump back. Each step writes one field of `GarlandConfiguration`. Defaults are pre-selected wherever a sensible default exists — a customer who just clicks "Next" through every step still ends with a valid, priceable garland (progressive disclosure: the fastest path is the default path).

| # | Step | Writes | Default | Depends on |
|---|---|---|---|---|
| 1 | Occasion | `occasion` | — (must choose) | — |
| 2 | Style | `style` | suggested by occasion | occasion |
| 3 | Flowers | `flowers[].flowerId` | occasion+style suggestion | style |
| 4 | Colors | `flowers[].colorIds` | flower's signature colors | flowers |
| 5 | Length | `lengthFt` | 4 ft | occasion (garland vs decoration presets) |
| 6 | Thickness | `thickness` | premium | — |
| 7 | Add-ons | `addons`, `special` | none | style (suggestions) |
| 8 | Review + live preview | `quantity`, `eventDate`, `notes` | qty 1 | all |
| 9 | Checkout | — (dispatches) | WhatsApp quote highlighted | all |

### Step 1 — Occasion

Card grid with photography per occasion (wedding, temple, kalyanotsavam, engagement, housewarming, naming ceremony, birthday, anniversary, religious decoration, floral decoration). Occasion drives:

- style suggestion (wedding → royal, temple → temple-style, housewarming → traditional…),
- flower suggestions and default palette,
- length presets (kalyanotsavam garlands run longer; decoration flows to a different length picker),
- copy tone throughout the flow.

### Step 2 — Style

Six styles: Traditional, Modern, Royal, Temple, Minimal, Luxury. Each card shows a real TRC photo, one line of description, and a "typically from $X" anchor price (computed from the pricing matrix, kept honest automatically). The occasion-suggested style is pre-selected and labeled "Recommended for weddings" etc.

Style sets the **labor complexity factor** in pricing and filters add-on suggestions.

### Step 3 — Flowers

Multi-select chips with photos. Catalog comes from `trc-flowers` (see [04-data-and-api.md](04-data-and-api.md)):

- **Chrysanthemum, Carnation, Rose, Baby's Breath, Hydrangea** — selectable.
- **Orchid** — visible but flagged "Coming soon"; selectable only when Muni flips `isActive` in the admin.

Each chip shows a live availability pill from `trc-flower-availability` for the event month: **In season · Limited · Import required**. Import-required selection is allowed but immediately shows the import surcharge in the preview — seasonality honesty is a feature, not a warning buried in checkout.

Max 3 flower types (craft constraint, Muni-configurable). Proportion defaults to equal split; a simple drag/stepper on the review step adjusts it for customers who care.

### Step 4 — Colors

Rendered *per selected flower*, constrained to that flower's real colors (from catalog, Muni-managed):

| Flower | Colors |
|---|---|
| Chrysanthemum | white, yellow, purple, green |
| Carnation | red, pink, white, peach, purple |
| Rose | red, white, pink, yellow, orange |
| Baby's Breath | white |
| Hydrangea | white, blue, pink, green |
| Orchid | white, purple (when live) |

Single-flower selections skip straight past this step with the signature color pre-picked (visible as a completed chip, tappable to change). Baby's-breath-only never shows a color question. Dynamic color choices are exactly where competitor sites make people phone in; here it's two taps.

### Step 5 — Length

Options 3 / 4 / 5 / 6 ft, shown against a **drape diagram**: a neck silhouette with the garland overlaid and a caption per option — "4 ft total · hangs 2 ft on each side · classic wedding length". Length is *always total*; the per-side figure is always shown beside it. This single diagram eliminates the most common sizing mistake and the WhatsApp back-and-forth it causes.

Decoration occasions (housewarming toran, religious decoration) swap this step for a running-length picker (per-foot, min 3 ft) — same field, different UI.

### Step 6 — Thickness

Standard / Premium / Royal, as three cross-section illustrations with stems-per-foot and a relative price signal (+$, ++$). Thickness drives flower quantity, weight, and price more than any other choice, so the preview delta is shown right on the option cards ("Royal: +$65 on your current build" — the true delta for the 4 ft rose+carnation royal-style example in 03-pricing-engine.md).

### Step 7 — Add-ons

Checklist with qty steppers where relevant: peacock feathers, pearl strings, golden lace, decorative ribbon, custom initials (opens a 4-char input → `special.customInitials`), fresh leaf accents.

**Currency garland** lives here as a distinct toggle with its own card: "You provide the currency notes; we weave them. Priced for craftsmanship only." Toggling it sets `special.currencyGarland`, relaxes the flower requirement, and pins the disclaimer into the preview panel.

### Step 8 — Review + live preview

Full-page summary: every choice as an editable row, quantity stepper, event date picker, notes field. The date picker immediately reflects:

- **lead time** (base days + seasonal extension from `trc-seasonal-events`),
- **rush flag** if the date is inside the rush window (shows rush fee, links to WhatsApp for < 4 business days per the escalation policy in ../architecture-plan.md),
- **seasonal surcharge** if the date falls in an active event window, with the event's customer message ("Wedding-season demand affects flower pricing in June…").

### Step 9 — Checkout (three doors)

1. **WhatsApp quote** (primary for launch) — opens `https://wa.me/15878897282?text=<summary>` where the summary is a human-readable rendering of the config + estimate range + a short link back to the config URL. Muni receives a *structured* request instead of a twenty-message interview; the customer stays in the channel they trust.
2. **Online order** — Cognito sign-in → server-side quote (authoritative) → Stripe deposit → the existing order pipeline (`garlandItems` on `trc-orders` maps 1:1 from the config; state machine unchanged).
3. **Request callback** — name + phone + preferred time → lead record + SNS ping to Muni.

All three persist the config (`trc-saved-designs`) first, so nothing a customer built is ever lost.

---

## 3. The live preview panel

Persistent across steps 2–8. Desktop: sticky right column. Mobile: collapsed bottom bar (price + "details" chevron) expanding to a drawer — the MaidLink estimator's summary pattern.

Contents, updated on every state change via the pure client-side estimator (no network call):

```
┌──────────────────────────────┐
│  Your garland                │
│  Rose + Carnation · Royal    │
│  style · Premium thickness   │
│  4 ft total (2 ft per side)  │
│                              │
│  Estimated  $151 – $177 CAD  │
│  Weight     ~1.9 kg          │
│  Lead time  5 business days  │
│                              │
│  ⚠ June is wedding season —  │
│    flower demand adds 10%    │
│    (included above)          │
└──────────────────────────────┘
```

(Numbers above are the real output of the seed pricing data in [03-pricing-engine.md](03-pricing-engine.md): body 4 × $24 = $96, craft fee $28, × 1.20 royal style = $148.80, +10% June season = $163.68, ±8% band → $151–$177.)

- **Price is a range** until the server quote at checkout (see 03-pricing-engine.md § estimate vs quote).
- Availability and seasonality warnings surface *the moment the cause is selected*, never at checkout.
- Weight matters culturally (a royal kalyanotsavam garland is heavy; temples ask) and signals substance for the price.

---

## 4. Component hierarchy

```
ConfiguratorPage (app/build/page.tsx)
└── ConfiguratorProvider            ← reducer + context owning GarlandConfiguration
    ├── ConfiguratorShell           ← step routing, progress chips, back/next
    │   ├── StepProgress            ← chips for steps 1–9, tap-to-jump-back
    │   ├── StepOccasion            ← OccasionCard grid
    │   ├── StepStyle               ← StyleCard grid (photo + anchor price)
    │   ├── StepFlowers             ← FlowerChip multi-select + AvailabilityPill
    │   ├── StepColors              ← ColorSwatchGroup per selected flower
    │   ├── StepLength              ← LengthOption cards + DrapeDiagram
    │   ├── StepThickness           ← ThicknessCard trio with live price delta
    │   ├── StepAddons              ← AddonRow list + CurrencyGarlandToggle
    │   ├── StepReview              ← ConfigSummary (editable rows) + EventDatePicker
    │   └── StepCheckout            ← WhatsAppQuoteButton | OnlineOrderButton | CallbackForm
    └── LivePreviewPanel            ← sticky panel / mobile drawer
        ├── EstimateDisplay         ← price range, weight, lead time
        └── ConfigWarnings          ← availability, seasonal, rush, currency disclaimer
```

State: a single `useReducer` in `ConfiguratorProvider` with actions like `SET_OCCASION`, `TOGGLE_FLOWER`, `SET_COLORS`, `APPLY_PREFILL` (used by shared links now, AI features later). Catalog + active pricing rules arrive once via React Query and feed both the option renderers and the estimator. No Redux — this mirrors MaidLink's local-feature-state pattern.

---

## 5. React component structure (full app)

MaidLink's frontend organization mapped onto Next.js App Router:

```
frontend/
├── app/
│   ├── layout.tsx                    # Layout: nav + footer (≈ maidlink Layout.tsx)
│   ├── page.tsx                      # Home
│   ├── build/page.tsx                # THE CONFIGURATOR
│   ├── collections/page.tsx          # gallery grid
│   ├── collections/[slug]/page.tsx   # collection detail → "Start from this design"
│   ├── occasions/[occasion]/page.tsx # SEO landing pages → prefilled configurator
│   ├── design/[shareId]/page.tsx     # shared design resolver → /build?config=
│   ├── about/page.tsx  faq/page.tsx  contact/page.tsx
│   ├── (auth)/orders/page.tsx        # customer order history + status
│   ├── (auth)/orders/[id]/page.tsx
│   └── (admin)/admin/...             # Muni's CMS — see 05-aws-and-cms.md
│
├── components/
│   ├── ui/                           # custom Tailwind primitives — NO shadcn
│   │   ├── Button.tsx  Badge.tsx  Modal.tsx  Spinner.tsx  Toast.tsx
│   │   ├── Stepper.tsx               # qty/length increment control (≈ maidlink FormControls Stepper)
│   │   ├── ChipGroup.tsx             # exclusive + multi-select chips (≈ maidlink ChipGroup)
│   │   ├── OptionCard.tsx            # photo card w/ selected state — steps 1/2/6 all use it
│   │   └── PricePill.tsx  AvailabilityPill.tsx
│   ├── configurator/                 # feature folder (≈ maidlink estimator/)
│   │   └── ...                       # everything in § 4
│   ├── catalog/                      # CollectionCard, GalleryGrid, OccasionHero
│   ├── chat/                         # AI chat widget (Phase 2, from ../architecture-plan.md)
│   ├── layout/                       # Navbar, Footer, Wordmark, FestivalBanner
│   └── admin/                        # admin tables/editors — see 05-aws-and-cms.md
│
├── api/                              # data layer (≈ maidlink api/) — AppSync GraphQL
│   ├── client.ts                     # Amplify v6 generateClient + auth mode selection
│   ├── catalog.ts                    # getCatalog, getPricingContext (public API key)
│   ├── quotes.ts                     # requestQuote, saveDesign, getSharedDesign
│   ├── orders.ts                     # createOrderFromConfig, listMyOrders (Cognito)
│   └── admin.ts                      # CMS mutations (admin group)
│
├── contexts/
│   └── AuthContext.tsx               # Cognito session (≈ maidlink AuthContext)
├── hooks/
│   ├── useCatalog.ts                 # React Query wrapper, staleTime 5 min
│   ├── useEstimate.ts                # config + catalog + rules → memoized estimate
│   └── useIsMobile.ts
├── lib/
│   ├── pricing/
│   │   ├── estimate.ts               # PURE: estimate(config, catalog, rules) → EstimateResult
│   │   └── __tests__/estimate.test.ts   # (≈ maidlink estimatorCalc + test)
│   ├── configEncoding.ts             # config ⇄ base64url, whatsappSummary(config, estimate)
│   └── validation.ts                 # re-export from packages/shared
└── constants/
    └── business.ts                   # phone, WhatsApp number, rush threshold, socials
```

What is deliberately inherited from MaidLink: `ui/` primitives built with Tailwind `@layer components` classes instead of a component library; feature folders per domain; a **pure, unit-tested pricing function with zero I/O**; React Query as the only async-state tool; one context for auth, feature state kept local. What is deliberately *not* inherited: the color palette, Vite/React Router (Next.js App Router instead, for SEO-critical occasion pages), and the REST/Axios layer (AppSync GraphQL instead, per locked decision).
