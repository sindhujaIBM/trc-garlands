import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../shared/clients/dynamo.js';
import { TABLES } from '../shared/constants/index.js';
import type { ProductCategory } from '../shared/types/index.js';

/**
 * One-time seed of the 70 real products currently live on trcgarlands.com
 * (WordPress). Photos already uploaded to S3 + served via the new
 * MediaDistribution CloudFront domain (see storage-stack.ts).
 *
 * Pricing/occasion/primaryFlowers below are first-pass defaults derived from
 * design/03-pricing-engine.md's Standard-tier per-foot rates, NOT numbers
 * Muni has confirmed for these specific gallery pieces — flag for his review
 * once the admin dashboard (design/07-ideas-backlog.md) exists.
 *
 * Run: npx tsx backend/scripts/seed-products.ts
 */

const CLOUDFRONT_DOMAIN = 'd3e728s2xlauop.cloudfront.net';

interface CategoryConfig {
  category: ProductCategory;
  namePrefix: string;
  occasion: string[];
  primaryFlowers: string[];
  basePrice: number;
  pricingUnit: 'PER_FOOT' | 'PER_UNIT';
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  WED: {
    category: 'WEDDING',
    namePrefix: 'Wedding Garland',
    occasion: ['wedding'],
    primaryFlowers: ['rose', 'carnation'],
    basePrice: 18,
    pricingUnit: 'PER_FOOT',
  },
  MUM: {
    category: 'CHRYSANTHEMUM',
    namePrefix: 'Chrysanthemum Garland',
    occasion: ['pooja', 'festival'],
    primaryFlowers: ['chrysanthemum'],
    basePrice: 12,
    pricingUnit: 'PER_FOOT',
  },
  ROS: {
    category: 'ROSE',
    namePrefix: 'Rose Garland',
    occasion: ['pooja', 'festival'],
    primaryFlowers: ['rose'],
    basePrice: 18,
    pricingUnit: 'PER_FOOT',
  },
  CRN: {
    category: 'CARNATION',
    namePrefix: 'Carnation Garland',
    occasion: ['pooja', 'festival'],
    primaryFlowers: ['carnation'],
    basePrice: 14,
    pricingUnit: 'PER_FOOT',
  },
  ACC: {
    category: 'ACCESSORY',
    namePrefix: 'Flower Accessory',
    occasion: ['everyday', 'festival'],
    primaryFlowers: ['mixed'],
    basePrice: 25,
    pricingUnit: 'PER_UNIT',
  },
  FRT: {
    category: 'FRUIT',
    namePrefix: 'Fruit Garland',
    occasion: ['pooja', 'festival'],
    primaryFlowers: [],
    basePrice: 24,
    pricingUnit: 'PER_FOOT',
  },
  BIL: {
    category: 'BILLS',
    namePrefix: 'Currency Garland',
    occasion: ['wedding', 'festival'],
    primaryFlowers: [],
    basePrice: 26,
    pricingUnit: 'PER_FOOT',
  },
};

const CODES: Array<{ code: string; ext: string }> = [
  ...range('WED', 1001, 1024, 'png', { 1017: 'webp', 1020: 'webp', 1021: 'webp' }),
  ...range('MUM', 2001, 2016, 'png', { 2008: 'webp', 2013: 'webp', 2014: 'webp' }),
  ...range('ROS', 3001, 3008, 'png'),
  ...range('CRN', 4001, 4008, 'png', { 4007: 'webp', 4008: 'webp' }),
  ...range('ACC', 5001, 5008, 'png'),
  ...range('FRT', 6001, 6004, 'png'),
  ...range('BIL', 7001, 7002, 'png'),
];

function range(
  prefix: string,
  start: number,
  end: number,
  defaultExt: string,
  overrides: Record<number, string> = {}
): Array<{ code: string; ext: string }> {
  const items = [];
  for (let n = start; n <= end; n++) {
    items.push({ code: `TRC-${prefix}-${n}`, ext: overrides[n] ?? defaultExt });
  }
  return items;
}

async function seed() {
  let count = 0;
  for (const { code, ext } of CODES) {
    const prefix = code.split('-')[1];
    const config = CATEGORY_CONFIG[prefix];
    if (!config) throw new Error(`No category config for ${code}`);

    const slug = code.toLowerCase();
    const number = code.split('-')[2];

    const item = {
      PK: `PRODUCT#${code}`,
      SK: 'METADATA',
      GSI1PK: `CATEGORY#${config.category}`,
      GSI1SK: `${config.namePrefix} #${number}`,
      GSI2PK: 'ACTIVE#true',
      GSI2SK: `${config.namePrefix} #${number}`,

      productId: code,
      name: `${config.namePrefix} #${number}`,
      slug,
      category: config.category,
      occasion: config.occasion,
      basePrice: config.basePrice,
      pricingUnit: config.pricingUnit,
      primaryFlowers: config.primaryFlowers,
      alternateFlowers: [],
      leadTimeDays: 4,
      isActive: true,
      isSeasonalOnly: false,
      photos: [
        {
          cloudFrontUrl: `https://${CLOUDFRONT_DOMAIN}/products/${slug}/primary.${ext}`,
          isPrimary: true,
        },
      ],
      aiGeneratedDescription: null,
    };

    await ddb.send(new PutCommand({ TableName: TABLES.products, Item: item }));
    count++;
  }
  console.log(`Seeded ${count} products into ${TABLES.products}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
