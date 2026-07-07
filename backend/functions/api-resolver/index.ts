import type { AppSyncResolverEvent } from 'aws-lambda';
import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../../shared/clients/dynamo.js';
import { TABLES } from '../../shared/constants/index.js';
import { getCaller, requireAdmin, requireCustomer } from '../../shared/auth/identity.js';

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
      requireAdmin(event);
      return ordersByStatus(args as { status: string; limit?: number; nextToken?: string });

    case 'ordersByMonth':
      requireAdmin(event);
      return ordersByMonth(args as { month: string });

    case 'myOrders':
      return myOrders(requireCustomer(event).customerId!, args as { limit?: number });

    case 'getOrder':
      return getOrder(event, args as { orderId: string });

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

async function myOrders(customerId: string, args: { limit?: number }) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.orders,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `CUSTOMER#${customerId}` },
      ScanIndexForward: false, // newest first
      Limit: args.limit ?? 20,
    })
  );
  return { items: result.Items ?? [], nextToken: null };
}

async function getOrder(
  event: AppSyncResolverEvent<Record<string, unknown>>,
  args: { orderId: string }
) {
  const caller = getCaller(event);
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLES.orders,
      Key: { PK: `ORDER#${args.orderId}`, SK: 'METADATA' },
    })
  );
  const order = result.Item;
  if (!order) return null;
  // Ownership check: customer owns it, or caller is admin
  if (!caller.isAdmin && order.customerId !== caller.customerId) {
    throw new Error('Unauthorized');
  }
  return order;
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
