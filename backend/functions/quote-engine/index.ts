import type { GarlandItem, PricingSnapshot, RiskTag, SeasonalEvent } from '../../shared/types/index.js';
import { calculateQuote } from './pricing-calculator.js';
import { tagRisks } from './risk-tagger.js';

export interface QuoteRequest {
  items: GarlandItem[];
  eventDate: string;
}

export interface QuoteResult {
  pricingSnapshot: PricingSnapshot;
  riskTags: RiskTag[];
}

/**
 * quote-engine — calculates price + seasonal surcharges + risk tags.
 * Invoked directly by order-processor and ai-chat-handler (Lambda-to-Lambda
 * or shared import via bundling).
 */
export const handler = async (event: QuoteRequest): Promise<QuoteResult> => {
  // TODO: load active seasonal events from trc-seasonal-events for the
  // event-date year, filter surchargeActive
  const activeSeasonalEvents: SeasonalEvent[] = [];

  const pricingSnapshot = calculateQuote({
    items: event.items,
    eventDate: event.eventDate,
    activeSeasonalEvents,
  });

  const riskTags = tagRisks({
    eventDate: event.eventDate,
    flowerTypes: event.items.flatMap((i) => i.flowerTypes),
    activeSeasonalEvents,
  });

  return { pricingSnapshot, riskTags };
};
