# Future AI Architecture & Differentiators

The AI roadmap is architecturally cheap because of one decision made now: **every AI feature emits a partial [`GarlandConfiguration`](02-configurator-spec.md)**. No AI feature gets its own result page, its own pricing path, or its own order flow — each one is just a smarter way to arrive at the configurator with fields pre-filled (`source` tagged accordingly). The configurator, pricing engine, and checkout are built once and shared.

```
  photo upload ─────┐
  invitation ───────┼──► AI Lambda ──► partial GarlandConfiguration
  text prompt ──────┘                        │
                                             ▼
                              /build (prefilled, editable, priced)
                                             │
                              WhatsApp · order · callback  (existing)
```

All three features are Phase 2+. Nothing in MVP blocks them; the contracts below are what MVP must respect so they slot in later.

---

## 1. Feature 1 — Photo → estimate ("Will you make this? What would it cost?")

Customer uploads a Pinterest/Instagram screenshot of a garland they love.

```
Browser → saveDesign-style presigned S3 upload (pattern exists: media pipeline)
  → S3 ObjectCreated → Lambda: inspiration-analyzer
      1. Rekognition DetectLabels + DetectImageProperties
         → candidate flower labels, dominant color palette (hex)
      2. Bedrock (Sonnet-class, multimodal) with the TRC catalog in context:
         → map to CATALOG flowers only (closest match within
           chrysanthemum/carnation/rose/babys-breath/hydrangea/orchid,
           with "closest we offer" honesty when the photo shows something else)
         → estimate total length (reference cues: neck drape, doorway) and
           thickness class; flag lowConfidence per field
         → style classification, difficulty score
      3. Emit: partial GarlandConfiguration (source: 'ai-image')
              + confidences + top-3 closest collection designs
              (catalog photo similarity via existing aiTags; embeddings later
               per ../architecture-plan.md Phase 2)
      4. Persist to trc-saved-designs; return shareId
  → /build opens prefilled: "Here's our take on your photo — rose + baby's
     breath, about 4 ft total (2 ft per side), Premium. Adjust anything."
     Low-confidence fields open their step instead of skipping it.
```

The price shown is the *configurator's* estimate of the *mapped TRC build* — never a claimed price of the photo itself. That framing ("closest we offer") turns an impossible-promise feature into an honest one.

## 2. Feature 2 — Wedding invitation → matched design

Upload the invitation (image or PDF page).

```
Same ingestion path → Lambda: invitation-analyzer
  Bedrock multimodal extraction targets:
    palette (hex from artwork), tradition signals (script, iconography,
    ceremony names — e.g., a kalyanotsavam or muhurtham mention),
    formality/theme, event date if printed
  → partial GarlandConfiguration (source: 'ai-invitation'):
      occasion, suggested style, flower colors mapped to nearest
      catalog colors, eventDate (→ seasonal/rush checks fire immediately)
  → plus a "palette card" UI: invitation colors ↔ chosen flower colors
     side by side — the "it will match" reassurance is the feature
```

Privacy note: invitations carry names/venues. Uploads TTL after 30 days, are never used for anything but the session, and the page says so — consistent with the PIPEDA posture in ../architecture-plan.md § 8.

## 3. Feature 3 — AI designer ("Describe it, we'll design it")

Free-text box: *"Something elegant with white flowers and peacock feathers for my engagement."*

```
AppSync mutation → Lambda: ai-designer
  Bedrock (Sonnet-class) with tool use; the tool schema IS GarlandConfiguration
  (validated by the same packages/shared validator — the model cannot emit
   an impossible design: catalog flowers only, real colors, valid lengths)
  Context: catalog, availability for the stated timeframe, style factors
  → returns 2–3 candidate configurations + one-line rationale each
     ("White hydrangea + baby's breath reads most elegant; carnation
       version keeps it under $150")
  → cards render with real estimates from the same client-side pricing fn
  → "Open in configurator" (source: 'ai-designer')
```

Guardrails: candidates are always priced by the deterministic engine, never by the model; availability warnings apply; the too-rushed gate applies. The model proposes, the engine prices, Muni disposes.

### Shared plumbing (why this stays cheap)

- One ingestion path (presigned S3 + analyzer Lambdas) — already designed for the media inbox.
- One output contract — `GarlandConfiguration` + `trc-saved-designs`.
- One validator — `packages/shared`, browser and Lambda alike.
- One pricing engine, one checkout. New AI feature ≈ one Lambda + one prompt.
- Bedrock cost at this scale: single-digit dollars/month, inside the existing Bedrock spend alarm.

---

## 4. Differentiators

What makes this the most modern Indian garland site in North America — none of it generic florist e-commerce:

1. **Live pricing on handcrafted custom work.** No garland business on the continent shows a price that updates as you design. This alone retires the "how much will this cost?" conversation the business drowns in.
2. **The WhatsApp bridge.** Competitors treat WhatsApp as the fallback when the website fails. Here checkout *produces* a structured WhatsApp message with the full design and a link back. Customers keep the channel they trust; Muni gets specifications instead of interviews. Nobody else does this handoff deliberately.
3. **Seasonality honesty as brand.** "Hydrangea travels a long way in January (+15%)" said upfront, with a locally-sourced alternative suggested. Every competitor hides this in the final invoice; TRC makes expertise visible at selection time.
4. **The drape diagram.** Total length vs per-side drape is the most common ordering mistake in this business. One diagram on the length step (4 ft = 2 ft per side) removes it — tiny feature, outsized trust.
5. **Occasion-first, culturally fluent IA.** Kalyanotsavam and naming ceremonies as first-class occasions with their own SEO pages and Tamil/Hindi/Telugu flower names in the catalog — near-zero search competition, and the diaspora customer immediately feels understood.
6. **Designs are shareable objects.** A wedding is a committee decision. `?config=` links let the bride send the exact build to her mother; collections are just designs Muni curates in her own configurator. Same primitive powers merchandising, sharing, and reorders.
7. **Currency garlands, done properly.** A niche cultural specialty priced transparently as craftsmanship (client supplies the notes) — a service competitors handle awkwardly off-menu, presented here as a designed feature.
8. **AI that lands in a real flow.** Photo, invitation, and text entry points all exit into the same priced, orderable configurator — not a chatbot cul-de-sac. The AI is an on-ramp, never a dead end.
9. **An admin built for one artisan's phone.** Rate changes with preview-before-save, banners that turn themselves off after the festival, leads that arrive with the customer's exact design attached. The operational side is a differentiator the customer never sees but always feels: fast, confident answers.
