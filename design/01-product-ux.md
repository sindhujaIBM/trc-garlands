# Product & UX Design

Information architecture, sitemap, user flows, and wireframes for the configurator-first TRC Garlands site. The design goal, verbatim from the brief: *"This is the easiest flower ordering experience I've ever had."*

---

## 1. UX principles

1. **The configurator is the homepage's job.** Every page exists to move someone into `/build` with as much pre-filled as possible. Occasion pages pre-fill occasion; collection items pre-fill the whole design.
2. **Defaults are the fast path.** A customer who accepts every suggestion still ends with a beautiful, correctly priced garland. Choice is available, never demanded (progressive disclosure).
3. **Price is never a surprise.** The estimate appears from step 2 and updates with every tap. Surcharges explain themselves the moment their cause is selected.
4. **Mobile-first, thumb-first.** The audience finds TRC on Instagram and WhatsApp on their phones. Every step is completable one-handed; the preview lives in a bottom drawer.
5. **Honesty as luxury.** Seasonality warnings, import notices, lead times, and drape diagrams are presented as expertise, not friction. That is what a premium artisan sounds like.
6. **WhatsApp is a feature, not a failure.** The goal is not to eliminate WhatsApp — it's to make every WhatsApp conversation start with a structured design instead of twenty questions.

---

## 2. Information architecture

Three zones, three audiences:

```
PUBLIC (anyone)                    CUSTOMER (Cognito)          ADMIN (Muni, MFA)
─────────────────────────         ────────────────────        ─────────────────────
Discover                          My Orders                   Dashboard (alerts, week)
  Home                              order list + status         Orders + calendar
  Collections (gallery)             order detail + balance      Quotes & leads queue
  Occasion pages (SEO)              pay link                    Catalog manager
  About / Story                   My Designs                     flowers · colors ·
  FAQ                               saved configurations         styles · add-ons
  Contact                           reorder / share            Pricing
Decide                                                           rate matrix · rules ·
  /build  ← THE CONFIGURATOR                                     seasonal events
  /design/[shareId]                                            Site content
Commit                                                           collections · banners ·
  WhatsApp quote                                                 promotions
  Online order (auth)                                          Media inbox (phone uploads)
  Callback request                                             Conversations (AI chat)
```

Content hierarchy on every public page: photograph → price anchor → one action. Photography carries the brand; the configurator carries the conversion.

---

## 3. Sitemap

```
/
├── /build                        Configurator (steps 1–9, single route, client state)
├── /collections                  Gallery grid, filterable by occasion/style
│   └── /collections/[slug]       Design detail → "Start from this design" → /build?config=
├── /occasions/[occasion]         SEO landing pages (wedding-garlands-calgary,
│                                 kalyanotsavam-garlands, housewarming-torans, …)
│                                 → hero, 3 sample builds with prices, FAQ, → /build
├── /design/[shareId]             Shared design → resolves → /build?config=
├── /about                        Muni's story, handcraft process, Calgary roots
├── /faq                          Lead times, care, delivery/pickup, cancellation policy
├── /contact                      Phone, WhatsApp, email, Instagram, callback form
├── /orders            (auth)     Order history + live status (AppSync subscription)
│   └── /orders/[id]   (auth)     Detail, invoice PDF, balance payment
├── /designs           (auth)     Saved configurations
├── /privacy · /terms             PIPEDA-required pages (per ../architecture-plan.md § 8)
└── /admin/…           (admin)    Muni's CMS — full map in 05-aws-and-cms.md
```

Occasion pages are the SEO workhorses: "indian wedding garlands calgary", "kalyanotsavam garland canada" have almost zero structured competition. Next.js SSG renders them static with live "from $X" anchors regenerated on catalog change (ISR).

---

## 4. User flows

### Flow 1 — First-time visitor → WhatsApp quote (the core loop)

```
Instagram post → /collections/[slug]
  → "Start from this design" (config pre-filled, source: shared-link)
  → /build opens at Review step, everything editable
  → tweaks colors, sets event date
  → preview: $280–$330 each · 3.2 kg · 5 business days · "June wedding season +10%"
  → Checkout → [WhatsApp Quote]
  → saveDesign() persists config → wa.me opens:

      "Hi TRC! I'd like a quote for:
       💐 Royal wedding garland pair (2)
       🌹 Rose (red) + Carnation (pink)
       📏 5 ft total (2.5 ft per side) · Royal thickness
       ✨ Pearl strings
       📅 June 20, 2027
       Estimated $561–$659 for the pair
       Design: trcgarlands.com/design/8kQ2mR"

  → Muni opens the link, sees the exact build, replies with a firm quote.
     One message each way. Was: 20+ messages.
```

### Flow 2 — Configure from scratch → online order

```
/ → "Build your garland" → /build
Step 1 Occasion: Wedding → Step 2 Style: Royal (pre-suggested, accepted)
→ Step 3 Flowers: Rose + Carnation (suggested; availability pills all green)
→ Step 4 Colors: red roses, pink carnations
→ Step 5 Length: 4 ft (drape diagram: "hangs 2 ft each side")
→ Step 6 Thickness: Royal ("+$65 on your current build")
→ Step 7 Add-ons: pearl strings
→ Step 8 Review: qty 2, event date → rush check, seasonal check
→ Step 9: [Order Online] → Cognito sign-in (or create account)
→ server quote (exact, locked 48 h) → Stripe deposit (50%)
→ order enters existing Step Functions lifecycle (../architecture-plan.md § 5)
→ /orders shows live status; balance link arrives when Muni marks complete
```

### Flow 3 — Date too close (rush gate)

```
Step 8: event date = 2 days away
→ preview swaps price for: "This close to your date, Muni will confirm
   what's possible personally — she's worked miracles before."
→ single CTA: WhatsApp with config summary + RUSH flag
→ (SNS alert to Muni per existing rush escalation)
```

### Flow 4 — Currency garland

```
Step 7: toggles "Currency garland"
→ card explains: "You provide the currency notes; we weave them.
   Priced for craftsmanship only."
→ flowers become optional accents; preview relabels price as
   "Craftsmanship: $132–$156 · currency notes provided by you"
→ disclaimer rides along into WhatsApp summary / order record
```

### Flow 5 — Muni updates pricing (admin, no developer)

```
/admin/pricing → rate matrix → bumps Rose/Royal 39 → 42
→ preview pane: "Sample wedding pair: $609 → $629"
→ Save → new rule/rate version written; site estimates update on next
   catalog fetch (≤ 5 min); locked quotes and in-flight orders untouched
   (pricingSnapshot on order)
```

---

## 5. Wireframes (mobile-first)

### Home

```
┌─────────────────────────────┐
│ TRC GARLANDS            ☰   │
│─────────────────────────────│
│ [full-bleed hero photo:     │
│  royal wedding pair]        │
│                             │
│  Handcrafted Indian         │
│  garlands, in Calgary.      │
│                             │
│  ┌───────────────────────┐  │
│  │  Build your garland → │  │
│  └───────────────────────┘  │
│  See price as you design    │
│─────────────────────────────│
│ SHOP BY OCCASION            │
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │Wedd-│ │Temp-│ │Kaly-│ →  │
│ │ing  │ │le   │ │anot.│    │
│ └─────┘ └─────┘ └─────┘    │
│─────────────────────────────│
│ RECENT WORK  (IG grid)      │
│ ┌────┐┌────┐┌────┐         │
│ └────┘└────┘└────┘         │
│ every design → "Start from  │
│ this design"                │
│─────────────────────────────│
│ 🪔 Diwali orders open —     │
│ book by Oct 12   [banner,   │
│ admin-managed]              │
└─────────────────────────────┘
```

### Configurator — step (mobile)

```
┌─────────────────────────────┐
│ ← Back      Build     ✕     │
│ ●●●○○○○○○  Step 3 of 9      │
│─────────────────────────────│
│ Choose your flowers         │
│ Pick up to 3 — we'll        │
│ suggest amounts             │
│                             │
│ ┌───────────┐ ┌───────────┐ │
│ │ 🌹 photo  │ │  photo    │ │
│ │ Rose    ✓ │ │ Carnation✓│ │
│ │ In season │ │ In season │ │
│ └───────────┘ └───────────┘ │
│ ┌───────────┐ ┌───────────┐ │
│ │  photo    │ │  photo    │ │
│ │ Hydrangea │ │ Chrysanth.│ │
│ │ ⚠ Import  │ │ In season │ │
│ │  for Jan  │ │           │ │
│ └───────────┘ └───────────┘ │
│ ┌───────────┐               │
│ │ Orchid    │  Baby's      │
│ │ Coming    │  Breath …    │
│ │  soon     │               │
│ └───────────┘               │
│─────────────────────────────│
│ Est. $151–$177  ▲   [Next →]│  ← collapsed preview bar
└─────────────────────────────┘
```

### Preview drawer (expanded, mobile)

```
┌─────────────────────────────┐
│ ─────  (drag handle)        │
│ Your garland                │
│ Rose + Carnation · Royal    │
│ style · Premium thickness   │
│ 4 ft total (2 ft per side)  │
│                             │
│ Estimated   $151–$177 CAD   │
│ Weight      ~1.9 kg         │
│ Lead time   5 business days │
│                             │
│ ⚠ June is wedding season —  │
│   flower demand adds 10%    │
│                             │
│ [Continue building]         │
└─────────────────────────────┘
```

### Review step (desktop, two-column)

```
┌───────────────────────────────────────────────────────────────┐
│  TRC GARLANDS      Collections  Occasions  About      Sign in │
│───────────────────────────────────────────────────────────────│
│  Review your design                    │  YOUR GARLAND        │
│                                        │  [composite photo]   │
│  Occasion   Wedding            edit ›  │                      │
│  Style      Royal              edit ›  │  Estimated           │
│  Flowers    Rose + Carnation   edit ›  │  $561 – $659 (pair)  │
│  Colors     Red · Pink         edit ›  │                      │
│  Length     5 ft (2.5 ft/side) edit ›  │  Weight   ~3.2 kg ea │
│  Thickness  Royal              edit ›  │  Lead     5 biz days │
│  Add-ons    Pearl strings      edit ›  │                      │
│                                        │  June wedding season │
│  Quantity   [−] 2 [+]                  │  adds 10% — booking  │
│  Event date [Jun 20, 2027  📅]         │  early locks rates   │
│  Notes      [________________]         │                      │
│                                        │                      │
│  ┌──────────────────────────────────┐  │                      │
│  │ 💬 Get exact quote on WhatsApp   │  │                      │
│  └──────────────────────────────────┘  │                      │
│  [ Order online ]  [ Request a call ]  │                      │
└───────────────────────────────────────────────────────────────┘
```

### Length step — the drape diagram

```
┌─────────────────────────────┐
│ Choose length               │
│ Lengths are total — a 4 ft  │
│ garland hangs 2 ft on each  │
│ side when worn.             │
│                             │
│        ╭───╮                │
│       ╱ ⌒ ⌒ ╲   ← neckline │
│      │       │              │
│      ┃       ┃              │
│      ┃  4ft  ┃  2 ft per    │
│      ┃ total ┃  side        │
│      ╰──┄┄┄──╯              │
│                             │
│ (3 ft) (4 ft✓) (5 ft) (6 ft)│
│  petite classic full  grand │
│─────────────────────────────│
│ Est. $151–$177 ▲    [Next →]│
└─────────────────────────────┘
```

---

## 6. Branding direction

To communicate: premium · traditional · elegant · trustworthy · handcrafted · Indian heritage · modern technology. Explicitly **not** MaidLink's palette.

- **Palette direction**: deep maroon/kumkum red as the primary, antique gold as the accent, warm ivory backgrounds, deep green as the supporting neutral (foliage). Dark, saturated, ceremonial — closer to a wedding invitation than a SaaS dashboard. (Final tokens chosen during visual design; this doc fixes direction only.)
- **Typography**: a high-contrast serif for headings (heritage, invitation-like), a clean humanist sans for UI and body. No decorative "Indian-flavor" display fonts — the photography provides the culture; the type provides the calm.
- **Photography over illustration**: real garlands, macro texture shots, hands weaving. The handcraft *is* the brand. Illustrations only where photos can't work (drape diagram, thickness cross-sections).
- **Motifs, sparingly**: a single thin gold rule, a subtle paisley or temple-arch corner device on section breaks. One motif used consistently beats five used loudly.
- **Voice**: warm, expert, unhurried. Surcharges and constraints delivered as craftsman's honesty ("fresh hydrangea travels a long way in January") rather than system warnings.
