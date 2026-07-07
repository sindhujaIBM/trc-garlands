import type { RiskTag, SeasonalEvent } from '../../shared/types/index.js';
import { isRush } from './pricing-calculator.js';

/**
 * Assign risk tags to an order (architecture-plan.md §3 trc-orders.riskTags).
 * TODO(phase2): PRICE_VOLATILITY_RISK + IMPORT_FLOWER_RISK from
 * trc-flower-availability once that table exists.
 */
export function tagRisks(params: {
  eventDate: string;
  flowerTypes: string[];
  activeSeasonalEvents: SeasonalEvent[];
}): RiskTag[] {
  const tags = new Set<RiskTag>();

  if (isRush(params.eventDate)) tags.add('RUSH_ORDER');

  const event = new Date(params.eventDate).getTime();
  for (const se of params.activeSeasonalEvents) {
    const inWindow =
      event >= new Date(se.startDate).getTime() &&
      event <= new Date(se.endDate).getTime();
    const affectsOrder = se.affectedFlowers.some((f) =>
      params.flowerTypes.map((t) => t.toLowerCase()).includes(f.toLowerCase())
    );
    if (inWindow && affectsOrder && se.expectedDemandMultiplier >= 1.5) {
      tags.add('HIGH_FLOWER_DEMAND');
    }
  }

  return [...tags];
}
