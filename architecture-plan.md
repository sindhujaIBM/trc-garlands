# TRC Garlands — AWS Architecture Plan

## Context

TRC Garlands is a Calgary-based artisan flower garland business run by Muni. Every order is custom, pre-order only, and culturally significant. The existing website (trcgarlands.com) has basic pages: Home, About, Our Collection, Pre-Order, Contact, Testimonials — no pricing, no payments, no order management. It needs to be rebuilt as a scalable, AI-powered custom-order platform on AWS. The architecture must be startup-cost-conscious (low traffic: 5–50 orders/month), serverless-first with pay-per-use billing, and include deep AI integration for customer experience, operations, and content automation.

**Existing site facts:** Phone (587) 889-7282 · Email [email protected] · WhatsApp available · Instagram @trcgarlands · Facebook trcgarlands

Canadian data residency (PIPEDA) is required. All services deploy in **`ca-west-1` (Calgary)** — same region as other TRC sites.

---

## 1. End-to-End Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER-FACING LAYER                           │
│   CloudFront CDN → Next.js (React) on Amplify Hosting                  │
│   ├── Public: Catalog, Gallery, About, Contact, FAQ                     │
│   ├── Order Flow: Inquiry → Quote → Booking → Checkout                  │
│   └── AI Chat Widget (floating, embedded)                               │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ HTTPS / GraphQL / WebSocket
┌───────────────────────────▼─────────────────────────────────────────────┐
│                          API LAYER                                      │
│   AWS AppSync (GraphQL API)                                             │
│   ├── Queries: catalog, orders, quotes, availability                    │
│   ├── Mutations: createOrder, updateStatus, submitInquiry               │
│   ├── Subscriptions: real-time order status updates                     │
│   └── Auth: Cognito (customers) + API Key (public catalog)              │
│   Amazon Cognito                                                        │
│   ├── Customer User Pool (self-sign-up)                                 │
│   └── Muni Admin Pool (invite-only, MFA required)                      │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ Lambda Resolvers / Direct integrations
┌───────────────────────────▼─────────────────────────────────────────────┐
│                        BUSINESS LOGIC LAYER                             │
│   AWS Lambda (Node.js 20)                                               │
│   ├── order-processor       validates + creates orders in DynamoDB      │
│   ├── quote-engine          calculates price + seasonal surcharges      │
│   ├── ai-chat-handler       Bedrock Claude invocation + session mgmt    │
│   ├── image-analyzer        Rekognition + Bedrock multimodal            │
│   ├── payment-handler       Stripe webhook + PaymentIntent management   │
│   ├── notification-sender   SES / SNS / WhatsApp dispatcher             │
│   ├── seasonal-pricing-job  EventBridge-triggered demand checks         │
│   ├── procurement-advisor   flower need prediction + Muni alerts        │
│   ├── invoice-generator     PDF via pdf-lib Lambda layer                │
│   ├── conversation-summarizer Bedrock Nova Micro summary for Muni       │
│   └── social-poster         AI captions + Instagram/Facebook posting    │
│                                                                         │
│   AWS Step Functions (Order Lifecycle State Machine)                    │
│   └── Inquiry → Quoted → Deposit → In-Production → Complete → Done     │
│                                                                         │
│   Amazon EventBridge                                                    │
│   ├── Scheduled: daily pricing check, 2-week reminder, weekly digest    │
│   └── Event bus: order.created, order.completed, payment.received       │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│                           AI / ML LAYER                                 │
│   Amazon Bedrock                                                        │
│   ├── Nova Micro         conversation summaries (cheapest option)       │
│   ├── Claude 3 Haiku     chat assistant (low cost, conversational)      │
│   ├── Claude 3 Sonnet    complex quotes, content generation             │
│   └── Titan Embeddings   semantic search on catalog (Phase 2)           │
│   Amazon Rekognition     auto-tag flower photos by type/color/occasion  │
│   Amazon OpenSearch Serverless  semantic catalog search (Phase 2 only)  │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│                          DATA LAYER                                     │
│   Amazon DynamoDB (on-demand billing)                                   │
│   ├── trc-orders            full order lifecycle + risk tags            │
│   ├── trc-products          catalog, pricing tiers, AI tags             │
│   ├── trc-customers         profiles, preferences, order history        │
│   ├── trc-chat-sessions     AI conversation history (90-day TTL)        │
│   ├── trc-seasonal-events   demand calendar, surcharge rules            │
│   ├── trc-flower-availability supplier stock by flower + month         │
│   ├── trc-pricing-rules     dynamic pricing rule configs                │
│   ├── trc-flower-substitutions  flower → substitution mappings         │
│   └── trc-supplier-pricing-history  price trends per flower            │
│   Amazon S3                                                             │
│   ├── trcgarlands-media     garland + inspiration photos                │
│   ├── trcgarlands-invoices  generated PDF invoices                      │
│   └── trcgarlands-assets    frontend static assets backup               │
│   AWS Secrets Manager       Stripe keys, WhatsApp token, social APIs    │
└─────────────────────────────────────────────────────────────────────────┘

COMMUNICATIONS LAYER (cross-cutting)
  SES        → transactional emails (booking confirm, invoice, reminders)
  SNS        → SMS for order updates, payment links
  Pinpoint   → campaign messaging, delivery tracking (Phase 2)
  WhatsApp Cloud API → rush order escalation (via Lambda webhook)

ADMIN LAYER
  Amplify Admin UI (Muni's dashboard, Cognito-protected)
  ├── Order management + mark-complete trigger
  ├── Flower inventory + procurement inputs
  ├── Seasonal pricing overrides
  └── AI-generated content approval queue
```

---

## 2. AWS Services — Justification and Cost

| Service | Use | Monthly Estimate (MVP) |
|---|---|---|
| Amplify Hosting | Next.js SSR | $2-5 |
| CloudFront | CDN + SSL | $0 (free tier) |
| AppSync | GraphQL API | $0 (free tier) |
| Cognito | Auth (customers + Muni) | $0 (< 50k MAU free) |
| Lambda | All business logic | **$0** (1M free/month; ~hundreds used) |
| DynamoDB | All structured data (on-demand) | **$0** (free tier exceeds usage) |
| S3 | Media + invoices + phone uploads | $0.50-2 |
| Bedrock Nova Micro | Summaries (cheapest model) | $0.10-0.50 |
| Bedrock Haiku | AI chat (few sessions/month) | $0.50-2 |
| Bedrock Sonnet | Content generation (Phase 2) | $1-3 |
| Rekognition | Photo tagging | $0 (first 5k images/month free) |
| EventBridge | Scheduling | $0 (scheduled rules free) |
| Step Functions | Order state machine | $0 (< 2000 transitions/month free) |
| SES | Email | $0 (< 1000 emails free) |
| SNS | SMS (Canadian rates) | $0.03-0.20 |
| Secrets Manager | API keys | $2-4 |
| CloudWatch | Logs + monitoring | $1-2 |
| MediaConvert | Video transcoding | $0.01/min — negligible |
| OpenSearch Serverless | Semantic search | **NEVER for this scale** — deferred indefinitely |

**REAL SCALE: Max 2 orders/month** — cost picture changes dramatically at this volume.

**MVP Total: ~$8-15/month** (mostly fixed infra; compute and AI costs near zero)
**Phase 2 (with more AI features): ~$15-25/month**

At 2 orders/month reality check:
- Lambda invocations: ~hundreds/month vs 1M free tier → **$0**
- DynamoDB reads/writes: ~thousands/month vs free tier → **$0**
- Bedrock (chat): maybe 10-20 conversations/month, ~$0.50-2 total
- S3: a few GB of photos → **$0.10-0.50**
- SES: ~20 emails/month → **$0.002**
- SNS SMS: ~5 messages/month → **$0.03**
- **Main fixed costs:** Amplify hosting ($2-5), Secrets Manager ($2-4), CloudWatch ($1-2)

Key cost decisions:
- **Lambda, DynamoDB, SES, SNS are effectively free** at 2 orders/month
- **Nova Micro** for non-customer-facing tasks (summaries, tagging) — cheapest Bedrock option
- **No reserved concurrency** — Lambda scales from 0; zero cost on idle days (most days)
- **CloudWatch alarm if Bedrock spend > $5/month** (raise as business grows)
- OpenSearch permanently deferred unless catalog grows past 100 items
- Single AWS account, `ca-west-1`, env-prefixed resources (dev/prod)
- DynamoDB on-demand only (zero cost when idle)
- S3 Standard for active photos; Glacier after 1 year

---

## 3. Database Schema (DynamoDB)

### `trc-orders`
```
PK: ORDER#<orderId>   SK: METADATA

Key fields:
  orderId, customerId, status (INQUIRY|QUOTED|DEPOSIT_PENDING|DEPOSIT_PAID|
    FLOWER_SOURCING|IN_PRODUCTION|READY|COMPLETED|CANCELLED|REFUNDED)
  orderType (WEDDING|POOJA|TEMPLE|GRADUATION|GENERAL)
  eventDate, deliveryMethod, deliveryAddress
  garlandItems: [{productId, length, flowerTypes[], colors[], qty, unitPrice, subtotal}]
  pricingSnapshot: {basePrice, seasonalSurcharge, rushSurcharge, total, currency: "CAD"}
  riskTags: [HIGH_FLOWER_DEMAND, PRICE_VOLATILITY_RISK, IMPORT_FLOWER_RISK, RUSH_ORDER]
  depositAmount, depositPaidAt, depositPaymentId (Stripe)
  balanceAmount, balancePaidAt, balancePaymentId
  reminderSentAt, completedAt, invoiceS3Key, invoiceUrl
  cancellationPolicy (snapshot at booking), cancelledAt, refundAmount
  chatSessionId

GSI1: STATUS#<status> + eventDate  (Muni's work queue sorted by date)
GSI2: CUSTOMER#<customerId> + createdAt  (customer order history)
GSI3: DATE#<YYYY-MM> + eventDate  (monthly calendar view)
```

### `trc-customers`
```
PK: CUSTOMER#<customerId>   SK: PROFILE

  cognitoSub, name, email, phone (E.164: +14035551234)
  whatsappOptIn, smsOptIn, emailOptIn
  preferredLanguage (en|pa|hi|ta), culturalBackground
  orderIds[], totalLifetimeValue
  tags: [RETURNING, VIP, WEDDING_FAMILY]

GSI1: EMAIL#<email>   GSI2: PHONE#<phone>
```

### `trc-products`
```
PK: PRODUCT#<productId>   SK: METADATA

  name, slug, category (WEDDING|CHRYSANTHEMUM|ROSE|CARNATION|ACCESSORY|FRUIT|BILLS)
  occasion[], basePrice (CAD), pricingUnit (PER_FOOT|PER_UNIT)
  primaryFlowers[], alternateFlowers[]
  leadTimeDays, availableSeasons[], isActive, isSeasonalOnly
  photos: [{s3Key, cloudFrontUrl, isPrimary, aiTags{}, rekognitionLabels[]}]
  semanticEmbedding (Titan, base64, Phase 2)
  aiTags: {colors[], flowerTypes[], occasion[], complexity, style}
  instagramCaption, facebookCaption (AI-generated, approved by Muni)
  aiGeneratedDescription

GSI1: CATEGORY#<category> + name   GSI2: ACTIVE#true + name
```

### `trc-chat-sessions`
```
PK: SESSION#<sessionId>   SK: METADATA

  customerId, channel (WEB|WHATSAPP), status (ACTIVE|ESCALATED|COMPLETED)
  messages: [{role, content, timestamp, tokensUsed}]  (last 20)
  capturedLead: {name, email, phone, occasion, eventDate, notes}
  linkedOrderId, escalatedToWhatsApp, escalatedAt
  muniSummary (AI-generated conversation summary)
  totalTokensUsed, modelUsed
  ttl (Unix epoch, 90-day auto-cleanup)

GSI1: CUSTOMER#<customerId> + createdAt
GSI2: STATUS#ESCALATED + createdAt
```

### `trc-seasonal-events`
```
PK: SEASON#<year>   SK: EVENT#<eventId>

  name (e.g., "Diwali 2025"), type (RELIGIOUS|CULTURAL|WESTERN|CALGARY_LOCAL)
  startDate, endDate, peakDate
  affectedFlowers[], expectedDemandMultiplier (1.0 = normal, 2.0 = doubled)
  surchargePercent (0-50), surchargeActive, surchargeMessage
  leadTimeExtensionDays, flowerRiskLevel (LOW|MEDIUM|HIGH|CRITICAL)
  procurementAdvanceDays

Pre-loaded: Diwali (surcharge 25%, multiplier 2.0), Valentine's Day (20%),
  Navratri (15%), Mother's Day (20%), Calgary Wedding Season May-Sep (10%)
```

### `trc-flower-availability`
```
PK: FLOWER#<flowerId>   SK: AVAILABILITY#<YYYY-MM>

  flowerName, flowerNameTamil, flowerNameHindi, flowerNameTelugu
  availabilityScore (0-100), locallySourceable, importRequired
  wholesalePrice (CAD/bunch), priceVolatilityIndex
  supplierIds[]
```

### `trc-pricing-rules`
```
PK: RULE#<ruleId>   SK: VERSION#<n>

  name, isActive, priority
  conditions: {orderType[], flowerTypes[], seasonalEventIds[], isRush,
               daysTillEvent, riskTags[]}
  adjustmentType (PERCENT|FIXED|MULTIPLIER), adjustmentValue, adjustmentCap
  customerMessage, validFrom, validUntil
```

### `trc-flower-substitutions`
```
PK: FLOWER#<flowerId>   SK: SUBSTITUTION#<substituteFlowerId>

  similarityScore, priceDifferential (CAD), occasions[]
  customerMessage, muniApproved, colorMatch, fragranceMatch
  seasonalWindow: {months[]}

Key pairs: Jasmine→Mogra (95%), Marigold→Chrysanthemum (85%),
  Rose→Carnation (70%), Kanakambaram→Crossandra (90%)
```

### `trc-supplier-pricing-history`
```
PK: SUPPLIER#<supplierId>   SK: PRICE#<flowerId>#<YYYY-MM-DD>

  supplierName, location (Calgary local or import origin)
  flowerId, pricePerUnit, unit (bunch|kg|stem), minimumOrder

GSI1: FLOWER#<flowerId> + date  (price history across suppliers)
```

---

## 4. AI Workflow Design

### 4A. AI Chat Assistant ("Pooja")

```
Customer message → AppSync mutation (sendChatMessage)
  → Lambda: ai-chat-handler
    1. Load session (trc-chat-sessions, last 20 messages)
    2. Load context: matching products, active pricing rules, seasonal events
    3. Build prompt: system persona + business rules + seasonal context
                     + conversation history + relevant catalog
    4. Invoke Bedrock Claude 3 Haiku
    5. Parse response for intents:
       - LEAD_CAPTURE: save to capturedLead in session
       - RUSH_ESCALATION: event < 4 days → WhatsApp link + Muni SNS alert
       - QUOTE_REQUEST: invoke quote-engine Lambda inline
       - ORDER_INTENT: flag session for Muni follow-up
    6. Update DynamoDB session
    7. Return via AppSync subscription to browser

System prompt key elements:
  - Persona: "Pooja, warm AI assistant for TRC Garlands Calgary"
  - Use occasional Tamil/Hindi/Telugu flower names (malli=jasmine, samandhi/chamanthi=marigold)
  - Current date, active surcharges, high-risk flowers
  - Lead capture fields: name, email/phone, event date, occasion, preferences
  - Rush escalation: warmly explain and give Muni's WhatsApp
  - Tone: never transactional, always culturally respectful
```

### 4B. Image Analysis Pipeline

```
Trigger: Customer or Muni uploads photo → S3 PUT event
  → Lambda: image-analyzer
    1. Rekognition DetectLabels → flower types, composition
    2. Rekognition DetectImageProperties → dominant color palette (hex)
    3. Bedrock Claude 3 Sonnet (multimodal):
       → flowers identified, color palette, occasion suitability,
         length estimate, style (South Indian/North Indian/fusion),
         complexity, top 5 catalog matches
    4. Store structured tags in DynamoDB (product or customer upload)
    5. Generate Titan embedding → store for semantic search (Phase 2)
    6. If linked to chat session → inject recommendations into next response
```

### 4C. Phone Upload — Photos & Videos from Sindhuja and Muni

Both Sindhuja and Muni accumulate photos/videos on their phones. The platform needs a frictionless way to upload from mobile and auto-organize them.

```
Architecture: Mobile-Friendly Upload PWA (works from Safari/Chrome on iPhone)

Option A — Direct S3 Pre-signed Upload (MVP, simplest)
  Admin UI has a "Upload from Phone" button (mobile-optimized)
  → Amplify Storage generates pre-signed S3 PUT URL (valid 1 hr)
  → Phone browser uploads directly to S3 (no Lambda in the critical path)
  → S3 ObjectCreated event → Lambda: media-ingestor
      1. Detect file type: image (JPEG/HEIC/PNG) or video (MOV/MP4)
      2. If video: trigger MediaConvert job → transcode to MP4 + generate thumbnail
      3. If image: run Rekognition + Bedrock image-analyzer (as in 4B)
      4. Store metadata in DynamoDB (trc-media-uploads table)
      5. Place in "Inbox" queue in admin dashboard (unreviewed uploads)
  → Muni tags + approves from admin: assign to order, catalog, or archive

trc-media-uploads DynamoDB table:
  PK: MEDIA#<mediaId>
  uploadedBy: MUNI | SINDHUJA
  fileType: IMAGE | VIDEO
  s3Key, cloudFrontUrl, thumbnailUrl
  status: INBOX | ASSIGNED_TO_ORDER | CATALOG | ARCHIVED
  linkedOrderId (optional)
  aiTags (from Rekognition/Bedrock)
  approvedForSocial: Boolean
  approvedAt, uploadedAt

Admin Inbox view (mobile-friendly):
  Grid of thumbnails from INBOX queue
  Each card: one-tap options → "Add to Catalog", "Link to Order", "Post to Social", "Archive"
  Bulk select available
```

**HEIC conversion note:** iPhones default to HEIC format. Lambda layer `sharp` handles HEIC → JPEG conversion server-side before Rekognition analysis.

### 4E. Content Generation Pipeline

```
Trigger: Muni uploads new garland photo in admin UI
  → Step Functions: ContentGenerationWorkflow
    Step 1: image-analyzer Lambda (as above)
    Step 2: content-generator Lambda
      → Bedrock Sonnet: Instagram caption (150-220 chars + 6-10 hashtags),
        Facebook caption (250-350 chars), product description (100 words SEO),
        alt text, suggested pricing tier
    Step 3: Store in trc-products (aiGeneratedContent)
    Step 4: SNS → Muni: "New content ready for review"
    Step 5: Muni approves/edits in admin UI
    Step 6 (on approval): social-poster Lambda
      → Instagram Graph API: POST /media → POST /media_publish
      → Facebook Graph API: POST /page/photos
      → EventBridge optimal time: Tue-Thu 10am-12pm MST
```

### 4F. Operations Intelligence

```
Lambda: procurement-advisor (EventBridge daily 8am MST)
  → Aggregate flower needs from upcoming orders (next 30 days)
  → Cross-reference trc-flower-availability scores
  → Check trc-seasonal-events for upcoming peaks
  → Bedrock Haiku: generate procurement plan summary for Muni
  → Email/SNS to Muni with actionable items
  → Update HIGH_FLOWER_DEMAND risk tags on affected orders

Lambda: late-risk-detector (EventBridge daily)
  → Scan IN_PRODUCTION + FLOWER_SOURCING orders
  → Flag LATE_RISK if < 3 days buffer to event
  → Suggest substitutions from trc-flower-substitutions
  → Alert Muni via SNS

Lambda: conversation-summarizer
  Trigger: chat session → COMPLETED or 2hr idle
  → Bedrock Nova Micro (cheapest model — summaries don't need reasoning power):
    extract name, contact, occasion, date, requests, next action
  → Store in ChatSessions.muniSummary
  → Unconverted leads → Muni's follow-up queue in admin dashboard

Model selection rationale:
  Nova Micro  → internal summaries (Muni never sees the prompt, just the output)
  Haiku       → "Pooja" customer chat (needs warmth + fluency)
  Sonnet      → content generation + complex multi-flower quotes (Phase 2)
```

### 4G. Seasonal Pricing Engine

```
EventBridge scheduled rule (daily 6am MST)
  → Lambda: seasonal-pricing-job
    1. Check today's date against trc-seasonal-events
    2. For events starting in next 30 days: activate surchargeActive = true
    3. Update trc-pricing-rules accordingly
    4. For all QUOTED/DEPOSIT_PENDING orders with eventDate in risk window:
       → Apply risk tags, log price adjustment
    5. Feed updated context into chat assistant system prompt cache
```

---

## 5. Order Lifecycle — Step Functions State Machine

```
INQUIRY → (quote-engine runs) → QUOTED
  [48hr expiry timer; customer accepts + pays deposit]
    ↓
DEPOSIT_PENDING → (Stripe PaymentIntent created, link sent)
  [Stripe webhook: payment_intent.succeeded]
    ↓
DEPOSIT_PAID → (booking confirmed; check if special flowers needed)
  [flowers not in stock] → FLOWER_SOURCING
  [flowers available] → IN_PRODUCTION
    ↓
FLOWER_SOURCING → (EventBridge: 2-week-before-event reminder to Muni)
  [Muni marks flowers secured] → IN_PRODUCTION
    ↓
IN_PRODUCTION → [Muni marks complete in admin]
    ↓
COMPLETION_PROCESSING
  → invoice-generator Lambda: PDF → S3, pre-signed URL
  → Stripe PaymentIntent for balance
  → notification-sender: email (PDF attached) + SMS + WhatsApp
    ↓
READY_FOR_PICKUP_OR_DELIVERY → [Muni marks delivered/picked up]
    ↓
COMPLETED (terminal)
  → Thank you email + review request
  → Tag customer RETURNING, update lifetime value
  → Trigger content pipeline if photo approved

CANCELLED (terminal)
  → CancellationPolicyEngine Lambda: calculate refund by days-to-event
  → Stripe refund, confirmation sent, Muni alerted if flowers ordered

Error catch → MANUAL_REVIEW → SNS alert to Muni
```

---

## 6. Cancellation Policy

| Timing | Refund |
|---|---|
| > 3 weeks before event | Full deposit refund |
| 14–21 days before | 50% of deposit returned |
| 7–14 days before | Deposit non-refundable |
| < 7 days before | Deposit non-refundable + 25% of balance if flowers sourced |
| < 48 hours / same day | Full order amount owed if work begun |

- Rescheduling preferred: free if > 3 weeks notice; $25 CAD fee if < 3 weeks
- Compassionate exceptions at Muni's discretion (medical, venue cancellation, death)
- Policy snapshot stored on each order at booking
- Customer must check acknowledgment checkbox during checkout
- `CancellationPolicyEngine` Lambda calculates refund from order snapshot at time of cancellation

---

## 7. MVP vs Phase 2 Roadmap

### MVP (Months 1–3, ~$25-40/month)
- CDK infrastructure, DynamoDB core tables (orders, customers, products, seasonal-events)
- AppSync + Cognito + Lambda + Step Functions order state machine
- Stripe deposit + balance payments
- SES email + SNS SMS notifications
- Next.js frontend: catalog, inquiry form, customer auth
- Muni admin dashboard: order management, mark-complete (auto-triggers invoice + payment link)
- Basic Bedrock Haiku chat (FAQ + lead capture only)
- Seasonal events table (manually maintained by Muni)

### Phase 2 (Months 3–6, ~$15-30/month)
- Full "Pooja" AI chat with product recommendations + seasonal pricing awareness
- Rekognition + Bedrock image analysis + customer photo upload
- AI content generation pipeline + content approval queue
- Instagram + Facebook auto-posting
- Dynamic pricing engine (EventBridge-driven, all pricing rule tables)
- Procurement advisor + late-risk detector
- WhatsApp Cloud API integration
- OpenSearch Serverless for semantic search
- All remaining DynamoDB tables (FlowerAvailability, PricingRules, Substitutions, SupplierHistory)

### Phase 3 (Month 6+, ~$150-300/month)
- Amazon Q Business knowledge base for Muni
- Pinpoint targeted campaigns + customer segmentation
- Multi-language support (Tamil, Hindi, Telugu via Bedrock)
- React Native mobile app (same AppSync backend)
- Amazon Forecast for ML-based seasonal demand prediction
- Subscription pooja flower boxes (Stripe Billing)
- Multi-artisan support (capacity tracking)

---

## 8. Security Recommendations

### PIPEDA Compliance
- All resources in `ca-west-1` (Calgary) — Canadian data residency, consistent with other TRC sites
- DynamoDB encryption at rest (AWS managed key, no cost)
- All APIs HTTPS-only, TLS 1.2+ enforced by AppSync
- No credit card numbers stored — Stripe handles all PCI scope
- Chat sessions TTL 90 days; orders retained 7 years (CRA requirement)
- Customer data deletion endpoint (`/api/delete-my-data` Lambda)
- Privacy policy page + cookie consent banner on site
- Email opt-in explicit only (unchecked by default)

### AppSync Authorization
- API Key: public catalog reads only
- Cognito User Pool: customer mutations
- IAM: Lambda → DynamoDB, Lambda → Bedrock (least-privilege per function)
- Lambda Authorizer: Stripe webhook HMAC signature validation
- Field-level: `muniNotes` → admin group only; customer PII → owner or admin

### Lambda Security
- Each function has its own IAM role (no shared roles)
- Roles grant minimum DynamoDB actions on specific tables only
- Bedrock access: specific model ARNs, not `bedrock:*`
- Secrets from Secrets Manager at cold start, cached in memory (not env vars)
- No VPC needed at this scale (adds cost, no benefit)

### Admin Security
- Muni's Cognito pool: MFA required (TOTP)
- Admin UI: separate CloudFront path with Auth@Edge
- All admin actions logged to CloudTrail

---

## 9. Example Conversational AI Flows

### Flow 1: Wedding Inquiry → Lead Capture
```
Customer: Hi! Getting married August 23rd and want jasmine garlands. Can you help?

Pooja: Congratulations! Jasmine varamala is such a beautiful, traditional
       choice — that fragrance will fill the whole mandap! 💐

       August gives us wonderful lead time for fresh, fragrant jasmine.
       Are you looking for just the bridal varamala pair, or also garlands
       for the mandap and vedi decoration?

Customer: Both! Maybe the vedi too.

Pooja: Perfect — we can create a full coordinated set! Many families choose:
       • Bridal varamala pair: Fresh jasmine with rose accents (~3-4 ft each)
       • Mandap pillars: Marigold and jasmine swags
       • Vedi decoration: Mixed flower backdrop

       To give you an accurate quote, could I get your name and best contact?
       Muni will personally follow up with pricing and portfolio photos.

[System: capturedLead → DynamoDB, Muni SNS notification triggered]
```

### Flow 2: Rush Order Escalation
```
Customer: I need garlands for my mom's birthday THIS Saturday — is that possible?

Pooja: What a special milestone — a 60th birthday deserves beautiful flowers!
       I want to be honest: Saturday is 3 days away, and our standard minimum
       is 4 business days to source the freshest blooms for you.

       For rush requests, I want to connect you directly with Muni so she can
       personally assess what's possible. She's worked miracles for last-minute
       celebrations before!

       📱 WhatsApp Muni: +1 (403) XXX-XXXX
       Message: "Birthday rush — Saturday" and she'll prioritize you.
       Rush orders may carry a small additional fee depending on availability.

[System: RUSH_ORDER flag set, Muni SNS alert triggered, session → ESCALATED]
```

### Flow 3: Seasonal Pricing Education (Diwali)
```
Customer: I want marigold garlands for Diwali. How much?

Pooja: Diwali garlands are one of my favorite orders — samandhi (marigold)
       is so auspicious! 🪔

       I want to be upfront: Diwali is our highest-demand period. Marigold
       prices from suppliers typically rise 20-30% in October due to national
       festival demand across North America.

       Current status: HIGH_FLOWER_DEMAND for marigold in October.
       Booking 3-4 weeks before Diwali locks in your order at the best rate.

       For a beautiful alternative at more stable pricing: golden chrysanthemum
       achieves the same warm, festive look and is often locally sourced in
       Calgary. Muni has done stunning combinations — want to see photos?
```

### Flow 4: Completion → Balance Payment (automated)
```
[Step Functions triggers Lambda: send-completion-notification]

Email subject: "Your garlands are ready, Pooja! 🌸"

  Bridal Varamala Pair          $180.00
  Mandap Pillar Garlands × 4   $240.00
  Vedi Decoration Set           $120.00
  ─────────────────────────────────────
  Total                         $540.00
  Deposit Paid (50%)           -$270.00
  Balance Due                   $270.00

  [PAY BALANCE NOW — $270.00]  ← Stripe link
  Invoice attached as PDF.

SMS: "TRC Garlands: Your wedding garlands are ready!
     Balance $270: [link] WhatsApp Muni to arrange pickup: +1403XXXXXXX"
```

---

## 10. Social Media Automation Strategy

- Muni uploads photo via admin UI → S3 → ContentGenerationWorkflow
- Rekognition tags → Bedrock Sonnet generates captions + hashtags
- Muni reviews + approves in one-click admin UI
- EventBridge queues for optimal posting: Tue–Thu, 10am–12pm MST
- Instagram Graph API: `/media` → `/media_publish`
- Facebook Graph API: `/page/photos`
- Always include: `#TRCGarlands #CalgaryWedding #HandcraftedWithLove`
- Occasion-specific: wedding → `#CalgaryIndianWedding #VaramalaCalgary`; Diwali → `#CalgaryDiwali #FestivalFlowers`
- Max 3 posts/week (avoid over-posting)
- Content mix: 70% product photos, 20% behind-the-scenes, 10% customer celebrations (with permission)

---

## 11. Admin Workflow for Muni

**Dashboard home:** Today's alerts, this week's calendar, pending payments, procurement reminders

**Order completion (< 30 seconds):**
1. Find order → Click "Mark Complete"
2. Optional internal note
3. Confirm → system auto-generates PDF invoice, sends payment link to customer

**Rush inquiry response:**
1. SNS push notification to phone
2. Admin shows AI conversation summary
3. One-tap customer WhatsApp button

**Adding new garland to catalog:**
1. Upload photo → AI auto-analyzes (tags, description, captions)
2. Review + edit in approval card
3. Approve → live on site + queued for social post

**Phone photo/video upload (Muni and Sindhuja):**
1. Open admin on phone browser → tap "Upload from Phone"
2. Select photos/videos from camera roll (multi-select supported)
3. Direct upload to S3 via pre-signed URL (no server bottleneck)
4. AI automatically tags + puts in Media Inbox
5. Tap each item: "Add to Catalog" / "Link to Order" / "Post to Social" / "Archive"

**Key admin modules:**
- Orders: filterable by status/date; status updater dropdown; cancellation calculator
- Media Inbox: phone uploads from Muni + Sindhuja, AI-tagged, one-tap routing
- Flower Inventory: update availability scores, log supplier prices, view AI forecast
- Seasonal Events: activate/deactivate surcharges, edit customer-facing message
- Content Queue: pending AI captions, scheduled posts, engagement summary
- Conversations: all escalated chats with AI summary, follow-up queue

---

## 12. Tech Stack

```
Frontend:    Next.js 14 (App Router), React 18, TypeScript,
             Tailwind CSS + shadcn/ui, AWS Amplify v6, Framer Motion
Backend:     Lambda (Node.js 20), AppSync, Step Functions, EventBridge
Data:        DynamoDB (on-demand), S3, OpenSearch Serverless (Phase 2)
AI/ML:       Bedrock (Nova Micro + Haiku + Sonnet, Titan Embeddings), Rekognition,
             MediaConvert (video transcoding from MOV/HEIC)
Auth:        Cognito User Pools + Identity Pools
Payments:    Stripe (PaymentIntents + Webhooks)
Comms:       SES, SNS, Pinpoint (Phase 2), WhatsApp Cloud API
IaC:         AWS CDK (TypeScript)
CI/CD:       GitHub Actions
Monitoring:  CloudWatch + X-Ray tracing
Social:      Instagram Graph API, Facebook Graph API
```

---

## 13. Folder Structure

```
trc-garlands/
├── infrastructure/                    # AWS CDK
│   └── lib/stacks/
│       ├── database-stack.ts          ★ foundation: all DynamoDB tables + GSIs
│       ├── api-stack.ts               AppSync schema + Cognito pools
│       ├── lambda-stack.ts            all Lambda functions
│       ├── storage-stack.ts           S3 buckets + lifecycle policies
│       ├── events-stack.ts            EventBridge rules + Step Functions
│       └── frontend-stack.ts          Amplify + CloudFront
│
├── backend/
│   ├── functions/
│   │   ├── order-processor/           validate + create orders
│   │   ├── quote-engine/              ★ pricing-calculator.ts + seasonal-rules.ts + risk-tagger.ts
│   │   ├── ai-chat-handler/           ★ bedrock-client.ts + prompt-builder.ts + intent-parser.ts
│   │   ├── image-analyzer/            rekognition-client.ts + bedrock-vision.ts
│   │   ├── payment-handler/           stripe-client.ts + webhook-validator.ts
│   │   ├── notification-sender/       email-templates/ + ses + sns + whatsapp
│   │   ├── invoice-generator/         pdf-builder.ts (pdf-lib Lambda layer)
│   │   ├── seasonal-pricing-job/      demand-calendar.ts
│   │   ├── procurement-advisor/       flower-aggregator.ts
│   │   ├── conversation-summarizer/   Nova Micro summarization
│   │   ├── media-ingestor/            HEIC→JPEG (sharp layer), Rekognition, DynamoDB inbox
│   │   └── social-poster/             instagram-client.ts + facebook-client.ts
│   ├── graphql/
│   │   ├── schema.graphql             ★ entire API contract
│   │   └── resolvers/
│   └── shared/types/ + clients/ + constants/
│
├── frontend/
│   ├── app/
│   │   ├── (public)/catalog/, about/, gallery/, inquiry/, faq/
│   │   ├── (auth)/orders/, profile/
│   │   └── (admin)/admin/ [orders, catalog, flowers, seasonal, content, conversations, media-inbox]
│   ├── components/
│   │   ├── catalog/, chat/, order/, admin/, layout/
│   └── lib/amplify-config.ts + graphql/ + utils/
│
└── .github/workflows/
    ├── deploy-backend.yml             CDK diff → deploy → integration tests
    ├── deploy-frontend.yml            build → Amplify deploy → CF invalidation
    └── test.yml                       unit tests + schema validation + npm audit
```

**Critical files:**
- `infrastructure/lib/stacks/database-stack.ts` — foundation, all GSIs
- `backend/graphql/schema.graphql` — defines entire API contract
- `backend/functions/ai-chat-handler/index.ts` — most complex Lambda
- `backend/functions/quote-engine/pricing-calculator.ts` — core pricing logic
- `infrastructure/lib/stacks/stepfunctions-stack.ts` — order lifecycle orchestration

---

## 14. CI/CD

```
Branch strategy:  feature/* → develop (staging) → main (production)
Amplify:          auto-deploy on main push
CDK:              deploy after tests pass on main push

deploy-backend.yml:
  TypeScript compile → Jest unit tests → CDK diff → CDK deploy → integration tests

deploy-frontend.yml:
  npm ci → ESLint + TS check → Next.js build → Amplify deploy → CloudFront invalidation

test.yml (all PRs):
  Unit tests + GraphQL schema validation + npm audit security scan

CloudWatch alarms → SNS → dev email:
  Lambda error rate > 5%, DynamoDB throttles, AppSync 5xx spike, Step Functions failures
  Bedrock spend alarm at $15/month (raise threshold as revenue grows)

X-Ray: enabled on Lambda + AppSync for latency debugging
```

---

## 15. Implementation Timeline

**Week 1-2:** CDK scaffolding, DynamoDB tables, Cognito, AppSync schema
**Week 3-4:** order-processor, quote-engine, notification-sender Lambdas
**Week 5-6:** Step Functions state machine + Stripe integration
**Week 7-8:** Next.js frontend (catalog, inquiry form, customer auth)
**Week 9-10:** Muni admin dashboard (order management, mark-complete flow)
**Week 11-12:** AI chat (Bedrock Haiku + session management)
**Month 4:** Image analysis, content generation, social posting pipeline
**Month 5:** Dynamic pricing engine, procurement advisor
**Month 6:** OpenSearch, semantic search, full Phase 2

---

## 16. Verification Strategy

1. **Unit tests:** Each Lambda tested with Jest; mock DynamoDB client + Bedrock client
2. **Integration tests:** AppSync queries/mutations against staging endpoint post-deploy
3. **Order lifecycle E2E:** Create order → pay deposit → mark complete → verify invoice PDF generated + payment link sent
4. **AI chat:** Seed test conversations for lead capture, rush escalation, seasonal pricing flows
5. **Stripe webhooks:** Use Stripe CLI (`stripe listen --forward-to`) to test payment flow locally
6. **Cost monitoring:** CloudWatch billing alarm at $100/month; Bedrock token usage dashboard
7. **Social posting:** Test Instagram/Facebook API with sandbox account before enabling auto-post
8. **PIPEDA:** Verify ca-west-1 (Calgary) residency, test customer data deletion endpoint, confirm opt-in checkboxes
