import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../../shared/clients/dynamo.js';
import { TABLES } from '../../shared/constants/index.js';

export interface CatalogProduct {
  productId: string;
  name: string;
  category: string;
  primaryFlowers: string[];
  basePrice: number;
  pricingUnit: string;
}

/**
 * Full active catalog for Pooja's grounding — customers reference designs by
 * number/name they saw on /collections ("I like #2001"), so the prompt needs
 * the real list rather than guessing. Catalog is small (~70 items, "REAL
 * SCALE: Max 2 orders/month" per architecture-plan.md §2) so no pagination.
 */
export async function fetchActiveProducts(): Promise<CatalogProduct[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.products,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': 'ACTIVE#true' },
    })
  );
  return (result.Items ?? []) as CatalogProduct[];
}

export function formatCatalogForPrompt(products: CatalogProduct[]): string {
  if (products.length === 0) return 'No products currently in the catalog.';
  return products
    .map((p) => {
      const flowers = p.primaryFlowers.length ? ` — ${p.primaryFlowers.join(', ')}` : '';
      const price =
        p.pricingUnit === 'PER_FOOT' ? `from $${p.basePrice}/ft` : `from $${p.basePrice}`;
      return `- ${p.name} [${p.productId}] (${p.category}${flowers}, ${price})`;
    })
    .join('\n');
}
