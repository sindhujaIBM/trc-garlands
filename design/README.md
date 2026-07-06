# TRC Garlands — Design Doc Suite

Product, UX, and technical design for the configurator-first rebuild of trcgarlands.com. These docs extend the AWS backbone in [../architecture-plan.md](../architecture-plan.md); they do not replace it. Where a new doc changes a prior decision, the change is called out explicitly in the [Superseded items](#superseded-items) list below.

## The problem being solved

Every TRC order is custom, so every customer asks "how much will this cost?" and every answer is a long WhatsApp conversation. The rebuild puts a garland configurator at the center of the site: customers assemble occasion → style → flowers → colors → length → thickness → add-ons and watch price, weight, availability, and lead time update live. Checkout offers three paths: a pre-structured WhatsApp quote, a full online order, or a callback request.

## Reading order

| Doc | Contents |
|---|---|
| [01-product-ux.md](01-product-ux.md) | Information architecture, sitemap, user flows, wireframes, UX principles, branding direction |
| [02-configurator-spec.md](02-configurator-spec.md) | The 9-step configurator, the `GarlandConfiguration` contract, component hierarchy, React component structure |
| [03-pricing-engine.md](03-pricing-engine.md) | Pricing model, configurable rule engine, worked examples |
| [04-data-and-api.md](04-data-and-api.md) | DynamoDB schema (new + extended tables), GraphQL API design |
| [05-aws-and-cms.md](05-aws-and-cms.md) | AWS architecture delta vs architecture-plan.md, CMS/admin design for Muni |
| [06-ai-roadmap-and-differentiators.md](06-ai-roadmap-and-differentiators.md) | Future AI architecture (image→estimate, invitation analysis, AI designer), differentiators |

## Locked decisions

- **Backend backbone**: architecture-plan.md stands — AppSync GraphQL, DynamoDB, Cognito, Lambda, Step Functions, Stripe, Bedrock, ca-west-1 (PIPEDA), cost-conscious serverless.
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind. Component *organization* follows the MaidLink frontend patterns (custom `ui/` primitives, feature folders, pure-function pricing calc, React Query data layer) — not its visual design.
- **API style**: AppSync GraphQL (confirmed over REST).
- **CMS**: extend Muni's custom admin over DynamoDB; no headless CMS.
- **Canonical flowers**: chrysanthemum, carnation, rose, baby's breath, hydrangea, orchid (coming soon). Nothing else is offered or imported.
- **Length convention**: always total length, with a drape guide (a 4 ft garland hangs 2 ft per side when worn).
- **Currency garlands**: offered occasionally; the client provides the currency notes. Priced as labor only.
- **The `GarlandConfiguration` contract**: one JSON object is the configurator state, pricing input, checkout payload, AI-feature output, and shareable design. Defined once in doc 02.

## Superseded items

Relative to [../architecture-plan.md](../architecture-plan.md):

1. **Flower catalog**: the canonical list above replaces all prior example flower references. Prior chat-example flowers and substitution pairs outside this list are void; the substitution mechanism itself survives for within-catalog swaps (e.g., rose → carnation).
2. **Bedrock model names**: prior "Claude 3 Haiku/Sonnet" references are replaced by current-generation Bedrock Claude models (Haiku-class for chat, Sonnet-class for multimodal/content). Nova Micro stays for internal summaries.
3. **Order entry point**: the inquiry form is no longer the primary entry; the configurator is. Inquiries and AI chat remain as secondary paths that feed the same order pipeline.

## Deliverable checklist

Mapping the twelve requested deliverables to sections:

| # | Deliverable | Where |
|---|---|---|
| 1 | Information architecture | 01-product-ux.md § Information Architecture |
| 2 | Sitemap | 01-product-ux.md § Sitemap |
| 3 | User flows | 01-product-ux.md § User Flows |
| 4 | Component hierarchy | 02-configurator-spec.md § Component Hierarchy |
| 5 | Wireframes | 01-product-ux.md § Wireframes |
| 6 | Database schema | 04-data-and-api.md § DynamoDB Schema |
| 7 | Pricing engine architecture | 03-pricing-engine.md (entire) |
| 8 | API design | 04-data-and-api.md § GraphQL API |
| 9 | AWS architecture | 05-aws-and-cms.md § AWS Architecture Delta (+ ../architecture-plan.md) |
| 10 | React component structure | 02-configurator-spec.md § React Component Structure |
| 11 | Future AI architecture | 06-ai-roadmap-and-differentiators.md § AI Roadmap |
| 12 | Differentiators | 06-ai-roadmap-and-differentiators.md § Differentiators |
