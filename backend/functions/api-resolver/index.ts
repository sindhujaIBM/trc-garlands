import type { AppSyncResolverEvent } from 'aws-lambda';
import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../../shared/clients/dynamo.js';
import { TABLES } from '../../shared/constants/index.js';

/**
 * api-resolver — AppSync resolver for read queries.
 * Dispatches on event.info.fieldName:
 *   listProducts, getProduct (public)
 *   myOrders, getOrder (customer)
 *   ordersByStatus, ordersByMonth (admin)
 */
export const handler = async (
  event: AppSyncResolverEvent<Record<string, unknown>>
): Promise<unknown> => {
  const args = event.arguments;

  switch (event.info.fieldName) {
    case 'listProducts':
      return listProducts(args as { category?: string; limit?: number; nextToken?: string });

    case 'getProduct':
      return getProduct(args as { slug: string });

    case 'ordersByStatus':
      return ordersByStatus(args as { status: string; limit?: number; nextToken?: string });

    case 'ordersByMonth':
      return ordersByMonth(args as { month: string });

    case 'myOrders':
      // TODO: query GSI2 with CUSTOMER#<customerId> from event.identity (Cognito sub)
      return { items: [], nextToken: null };

    case 'getOrder':
      // TODO: GetItem + ownership check (customer owns order OR admin caller)
      return null;

    default:
      throw new Error(`Unknown field: ${event.info.fieldName}`);
  }
};

async function listProducts(args: { category?: string; limit?: number; nextToken?: string }) {
  const useCategory = Boolean(args.category);
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.products,
      IndexName: useCategory ? 'GSI1' : 'GSI2',
      KeyConditionExpression: useCategory ? 'GSI1PK = :pk' : 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': useCategory ? `CATEGORY#${args.category}` : 'ACTIVE#true',
      },
      Limit: args.limit ?? 24,
      ExclusiveStartKey: decodeToken(args.nextToken),
    })
  );
  return { items: result.Items ?? [], nextToken: encodeToken(result.LastEvaluatedKey) };
}

async function getProduct(args: { slug: string }) {
  // Slug is stored on the item; MVP catalog is small enough to resolve via
  // GSI2 scan-by-query. TODO: add a SLUG#<slug> GSI if catalog grows.
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.products,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      FilterExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':pk': 'ACTIVE#true', ':slug': args.slug },
    })
  );
  return result.Items?.[0] ?? null;
}

async function ordersByStatus(args: { status: string; limit?: number; nextToken?: string }) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.orders,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `STATUS#${args.status}` },
      Limit: args.limit ?? 50,
      ExclusiveStartKey: decodeToken(args.nextToken),
    })
  );
  return { items: result.Items ?? [], nextToken: encodeToken(result.LastEvaluatedKey) };
}

async function ordersByMonth(args: { month: string }) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.orders,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: { ':pk': `DATE#${args.month}` },
    })
  );
  return { items: result.Items ?? [], nextToken: null };
}

function encodeToken(key?: Record<string, unknown>): string | null {
  return key ? Buffer.from(JSON.stringify(key)).toString('base64') : null;
}

function decodeToken(token?: string): Record<string, unknown> | undefined {
  return token ? JSON.parse(Buffer.from(token, 'base64').toString()) : undefined;
}
