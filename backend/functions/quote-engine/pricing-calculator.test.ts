import { calculateQuote, isRush } from './pricing-calculator';
import type { GarlandItem, SeasonalEvent } from '../../shared/types/index.js';

const item = (subtotal: number): GarlandItem => ({
  productId: 'p1',
  flowerTypes: ['marigold'],
  colors: ['orange'],
  qty: 1,
  unitPrice: subtotal,
  subtotal,
});

const diwali: SeasonalEvent = {
  eventId: 'diwali-2026',
  name: 'Diwali 2026',
  type: 'RELIGIOUS',
  startDate: '2026-10-25',
  endDate: '2026-11-12',
  peakDate: '2026-11-08',
  affectedFlowers: ['marigold'],
  expectedDemandMultiplier: 2.0,
  surchargePercent: 25,
  surchargeActive: true,
  leadTimeExtensionDays: 7,
  flowerRiskLevel: 'HIGH',
};

describe('calculateQuote', () => {
  it('sums item subtotals with no surcharges', () => {
    const q = calculateQuote({
      items: [item(100), item(50)],
      eventDate: '2026-09-01',
      activeSeasonalEvents: [],
      quoteDate: '2026-07-01',
    });
    expect(q).toEqual({
      basePrice: 150,
      seasonalSurcharge: 0,
      rushSurcharge: 0,
      total: 150,
      currency: 'CAD',
    });
  });

  it('applies Diwali surcharge when event date is in window', () => {
    const q = calculateQuote({
      items: [item(200)],
      eventDate: '2026-11-08',
      activeSeasonalEvents: [diwali],
      quoteDate: '2026-09-01',
    });
    expect(q.seasonalSurcharge).toBe(50); // 25% of 200
    expect(q.total).toBe(250);
  });

  it('adds rush surcharge inside the rush window', () => {
    const q = calculateQuote({
      items: [item(100)],
      eventDate: '2026-07-08',
      activeSeasonalEvents: [],
      quoteDate: '2026-07-06',
    });
    expect(q.rushSurcharge).toBe(15);
  });
});

describe('isRush', () => {
  it('is rush under 4 days out', () => {
    expect(isRush('2026-07-08', '2026-07-06')).toBe(true);
  });
  it('is not rush at 10 days out', () => {
    expect(isRush('2026-07-16', '2026-07-06')).toBe(false);
  });
  it('is not rush for past dates', () => {
    expect(isRush('2026-07-01', '2026-07-06')).toBe(false);
  });
});
