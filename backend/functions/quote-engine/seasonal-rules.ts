import type { SeasonalEvent } from '../../shared/types/index.js';
import { round2 } from './pricing-calculator.js';

/**
 * Seasonal surcharge: highest active surcharge whose window contains the
 * event date wins (surcharges do not stack — design/03-pricing-engine.md).
 */
export function applySeasonalRules(
  basePrice: number,
  eventDate: string,
  activeEvents: SeasonalEvent[]
): number {
  const event = new Date(eventDate).getTime();

  const applicable = activeEvents.filter(
    (e) =>
      e.surchargeActive &&
      event >= new Date(e.startDate).getTime() &&
      event <= new Date(e.endDate).getTime()
  );

  if (applicable.length === 0) return 0;

  const maxPercent = Math.max(...applicable.map((e) => e.surchargePercent));
  return round2(basePrice * (maxPercent / 100));
}
