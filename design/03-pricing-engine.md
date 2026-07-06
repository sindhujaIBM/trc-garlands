# Pricing Engine Architecture

The pricing engine answers "how much will this cost?" instantly, honestly, and without Muni touching code. It consumes a [`GarlandConfiguration`](02-configurator-spec.md) and produces either an **estimate range** (client-side, instant) or an **authoritative quote** (server-side, locked). Same math, same shared code, different guarantees.

---

## 1. Estimate vs quote

| | Estimate | Quote |
|---|---|---|
| Where | Browser — pure function `lib/pricing/estimate.ts` | `quote-engine` Lambda (exists in ../architecture-plan.md, extended) |
| Inputs | Config + catalog/rules cached at page load (≤ 5 min stale) | Config + live DynamoDB reads |
| Output | Range: point ± 8%, rounded to whole CAD | Exact figure + line items, locked 48 h (`quoteId`) |
| Shown | Live preview panel, every keystroke | Checkout, WhatsApp summary footer, order record |

The ±8% band absorbs wholesale price drift between page load and checkout, and honestly reflects that fresh-flower costs move. The band's width is itself a configurable value (`estimateBandPercent` in `trc-pricing-rules` defaults).

The pure function is the MaidLink `estimatorCalc.ts` pattern: no I/O, no dates read from the system clock (event date and "today" are parameters), fully unit-tested with the worked examples below as fixtures. The quote-engine Lambda imports the *same function* from `packages/shared` and feeds it live data — one implementation, two callers.

---

## 2. Price composition

Applied in a fixed, deterministic order:

```
1. bodyPrice     = lengthFt × Σ over flowers( ratePerFoot[flowerId][thickness] × proportion )
2. craftFee      = fixed handcraft fee by thickness
3. styledPrice   = (bodyPrice + craftFee) × styleComplexityFactor
4. addonsPrice   = Σ ( addonPrice × qty )
5. subtotal      = styledPrice + addonsPrice
6. adjustments   = pricing rules matched against config + context,
                   applied in priority order (import, seasonal, rush, promo…)
7. perGarland    = round(subtotal after adjustments, 2)
8. total         = perGarland × quantity
```

**Currency garlands** replace steps 1–2: `bodyPrice = lengthFt × currencyLaborRatePerFoot`, `craftFee = currencyCraftFee`, and no flower material cost is charged (client supplies the notes). Optional flower accents are priced as add-ons. Steps 3–8 apply unchanged.

### 2.1 Seed data (launch values — all Muni-editable, nothing hardcoded)

Per-foot rates, CAD:

| Flower | Standard | Premium | Royal |
|---|---|---|---|
| Chrysanthemum | 12 | 18 | 26 |
| Carnation | 14 | 21 | 30 |
| Rose | 18 | 27 | 39 |
| Baby's Breath | 10 | 15 | 22 |
| Hydrangea | 20 | 30 | 44 |
| Orchid *(coming soon)* | 26 | 39 | 56 |

Craft fee by thickness: Standard **$20** · Premium **$28** · Royal **$40**.
Stems per foot (drives weight + procurement, shown on thickness cards): Standard **14** · Premium **20** · Royal **28**.

Style complexity factors: Minimal **0.95** · Traditional **1.00** · Modern **1.05** · Temple **1.10** · Royal **1.20** · Luxury **1.35**.

Add-ons (per garland): peacock feathers **$18** · pearl strings **$22** · golden lace **$16** · decorative ribbon **$8** · custom initials **$25** · fresh leaf accents **$10**.

Currency garland: labor rate **$26/ft**, craft fee **$30**, materials **$0** (client-supplied — disclaimer travels with every price display).

Weight model (for the preview): `lengthFt × Σ(stemsPerFoot × proportion × stemGrams) + lengthFt × 40 g backing`. Stem grams: chrysanthemum 22, carnation 18, rose 25, baby's breath 8, hydrangea 30, orchid 15.

### 2.2 Adjustment rules

Stored in `trc-pricing-rules` (schema already defined in ../architecture-plan.md § 3; reused as-is). Each rule: conditions → adjustment (PERCENT | FIXED | MULTIPLIER, with optional cap), priority, validity window, and a `customerMessage` that the preview panel shows verbatim — every surcharge explains itself.

Launch rules:

| Rule | Condition | Adjustment | Message shown |
|---|---|---|---|
| Import surcharge | selected flower has `importRequired` for event month | +15% on that flower's share of bodyPrice | "Hydrangea needs to be imported for January (+15%)" |
| Seasonal surcharge | eventDate inside active `trc-seasonal-events` window | event's `surchargePercent` on subtotal | event's own message |
| Rush | eventDate 4–7 business days out | +20% on subtotal | "Rush timeline (+20%) — flowers sourced on priority" |
| Too-rushed gate | eventDate < 4 business days | no self-serve price — route to WhatsApp | "This close to your date, Muni will confirm personally" |
| Promo | admin-defined (e.g., festival launch discount) | −N% with cap | promo's own message |

Rules never chain multiplicatively by accident: percent adjustments are computed against the step-5 subtotal, then summed, matching how Muni reasons about pricing ("wedding season plus rush is +30 points, not ×1.1×1.2").

---

## 3. Worked examples (unit-test fixtures)

### Example A — Wedding pair, 5 ft Royal, rose + carnation, pearl strings, wedding season

Config: rose+carnation equal split, 5 ft, royal, pearl strings, style royal, qty 2, event in June (Calgary wedding season, +10%).

```
bodyPrice   = 5 × (0.5 × 39 + 0.5 × 30)        = 5 × 34.50   = 172.50
craftFee    (royal)                                           =  40.00
styledPrice = (172.50 + 40.00) × 1.20                         = 255.00
addons      = pearl strings                                    =  22.00
subtotal    = 255.00 + 22.00                                   = 277.00
seasonal    = +10% × 277.00                                    = +27.70
perGarland  =                                                   304.70
total (×2)  =                                                   609.40
estimate    = ±8% → $561 – $659 for the pair ($280 – $330 each)
weight      = 5 × (28 × 0.5 × 25g + 28 × 0.5 × 18g) + 5 × 40g
            = 5 × 602g + 200g ≈ 3.2 kg each
```

### Example B — Temple garland, 4 ft Premium chrysanthemum, no add-ons, off-season

```
bodyPrice   = 4 × 18                                           =  72.00
craftFee    (premium)                                          =  28.00
styledPrice = (72.00 + 28.00) × 1.10 (temple)                  = 110.00
subtotal    =                                                    110.00
perGarland  =                                                    110.00
estimate    = ±8% → $101 – $119
weight      = 4 × (20 × 22g) + 4 × 40g = 1760g + 160g ≈ 1.9 kg
```

### Example C — Currency garland, 4 ft, traditional, fresh leaf accents

Client supplies the currency notes (e.g., forty $5 CAD bills, dropped off in advance).

```
bodyPrice   = 4 × 26 (labor only, no materials)                = 104.00
craftFee    (currency)                                         =  30.00
styledPrice = (104.00 + 30.00) × 1.00 (traditional)            = 134.00
addons      = fresh leaf accents                                =  10.00
subtotal    =                                                    144.00
perGarland  =                                                    144.00
estimate    = ±8% → $132 – $156
note        = "Craftsmanship only — currency notes provided by you"
```

### Example D — Import case, 4 ft Premium hydrangea + baby's breath, January event

```
bodyPrice   = 4 × (0.5 × 30 + 0.5 × 15)        = 4 × 22.50    =  90.00
  hydrangea share of body                       = 4 × 15.00    =  60.00
craftFee    (premium)                                          =  28.00
styledPrice = (90.00 + 28.00) × 1.05 (modern)                  = 123.90
subtotal    =                                                    123.90
import      = +15% × 60.00 (hydrangea body share only)         =  +9.00
perGarland  =                                                    132.90
estimate    = ±8% → $122 – $144
```

These four are the canonical test fixtures for `lib/pricing/__tests__/estimate.test.ts` and for the quote-engine Lambda's unit tests. If seed data changes, fixtures regenerate from the same tables — the tests assert the *formula*, with data injected.

---

## 4. Configurability without code

Every number in § 2.1 and every rule in § 2.2 lives in DynamoDB and is edited from Muni's admin (see [05-aws-and-cms.md](05-aws-and-cms.md)):

- **Rate matrix editor** — the flower × thickness grid, inline-editable, with a "preview a sample build" pane so Muni sees the effect before saving.
- **Rules list** — toggle, edit percentages, set validity windows; every save writes a new `VERSION#<n>` item (the versioned-rule pattern already in `trc-pricing-rules`), so quotes reference the exact rule version they used.
- **Seasonal events** — already designed in ../architecture-plan.md; the daily `seasonal-pricing-job` keeps `surchargeActive` current.

Because a locked quote stores its own `pricingSnapshot` (existing field on `trc-orders`), Muni can change prices any day without corrupting in-flight quotes or orders.

---

## 5. Failure honesty

- Catalog/rules fetch fails in the browser → configurator still works, preview shows "price on request" instead of a fabricated number, checkout routes to WhatsApp/callback.
- Estimate and server quote disagree beyond the band (stale cache, mid-session rule change) → checkout shows the quote with a one-line explanation, never silently swaps the number.
