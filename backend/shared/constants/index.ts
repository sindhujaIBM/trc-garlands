/** Shared constants. Table names come from env vars set by CDK. */

export const TABLES = {
  orders: process.env.ORDERS_TABLE ?? '',
  customers: process.env.CUSTOMERS_TABLE ?? '',
  products: process.env.PRODUCTS_TABLE ?? '',
  chatSessions: process.env.CHAT_SESSIONS_TABLE ?? '',
  seasonalEvents: process.env.SEASONAL_EVENTS_TABLE ?? '',
} as const;

export const REGION = process.env.AWS_REGION ?? 'ca-west-1';

/** Deposit is 50% of total (architecture-plan.md §9 flow 4). */
export const DEPOSIT_PERCENT = 0.5;

/** Rush order threshold — under this many days to event, escalate to Muni. */
export const RUSH_THRESHOLD_DAYS = 4;

/** Quote expiry (architecture-plan.md §5). */
export const QUOTE_EXPIRY_HOURS = 48;

/** Chat session TTL — 90 days (PIPEDA retention policy). */
export const CHAT_SESSION_TTL_DAYS = 90;

// Anthropic models aren't natively hosted in ca-west-1 — `global.` is a
// Bedrock cross-region inference profile, routing the inference call across
// AWS regions rather than pinning to Calgary. This is a real, deliberate
// exception to the PIPEDA data-residency comment in infrastructure/bin/app.ts,
// confirmed acceptable (already done for other Bedrock usage), not an
// accidental workaround. Verified against the account's actual available
// profiles via `aws bedrock list-inference-profiles` — the old Claude 3
// Haiku (20240307) has no inference profile in this account; Haiku 4.5 does.
export const BEDROCK_MODELS = {
  /** "Pooja" customer chat — warmth + fluency at low cost */
  chat: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  /** Internal summaries — cheapest option */
  summarizer: 'amazon.nova-micro-v1:0',
  /** Content generation + complex quotes (Phase 2) */
  content: 'us.anthropic.claude-3-sonnet-20240229-v1:0',
} as const;
