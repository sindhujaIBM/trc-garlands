import type { GarlandItem, PricingSnapshot, SeasonalEvent } from '../../shared/types/index.js';
import { applySeasonalRules } from './seasonal-rules.js';
import { RUSH_THRESHOLD_DAYS } from '../../shared/constants/index.js';

export interface QuoteInput {
  items: GarlandItem[];
  eventDate: string; // ISO date
  activeSeasonalEvents: SeasonalEvent[];
  quoteDate?: string; // defaults to today; injectable for tests
}

/**
 * Core pricing logic (architecture-plan.md §4G, design/03-pricing-engine.md).
 * total = base + seasonal surcharge + rush surcharge, CAD.
 */
export function calculateQuote(input: QuoteInput): PricingSnapshot {
  const basePrice = input.items.reduce((sum, item) => sum + item.subtotal, 0);

  const seasonalSurcharge = applySeasonalRules(
    basePrice,
    input.eventDate,
    input.activeSeasonalEvents
  );

  const rushSurcharge = isRush(input.eventDate, input.quoteDate)
    ? round2(basePrice * 0.15) // TODO: confirm rush % with Muni / pricing rules table
    : 0;

  return {
    basePrice: round2(basePrice),
    seasonalSurcharge,
    rushSurcharge,
    total: round2(basePrice + seasonalSurcharge + rushSurcharge),
    currency: 'CAD',
  };
}

export function isRush(eventDate: string, quoteDate?: string): boolean {
  const now = quoteDate ? new Date(quoteDate) : new Date();
  const event = new Date(eventDate);
  const days = (event.getTime() - now.getTime()) / 86_400_000;
  return days >= 0 && days < RUSH_THRESHOLD_DAYS;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
