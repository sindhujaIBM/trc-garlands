import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import type { Order, OrderType, GarlandItem } from '../../shared/types/index.js';

interface CreateOrderArgs {
  input: {
    orderType: OrderType;
    eventDate: string;
    deliveryMethod: 'PICKUP' | 'DELIVERY';
    deliveryAddress?: string;
    items: Array<Pick<GarlandItem, 'productId' | 'length' | 'flowerTypes' | 'colors' | 'qty'>>;
  };
}

/**
 * order-processor — validates + creates orders in trc-orders.
 * Invoked by AppSync `createOrder` mutation (Cognito customer auth).
 */
export const handler = async (
  event: AppSyncResolverEvent<CreateOrderArgs>
): Promise<Order> => {
  const { input } = event.arguments;
  const orderId = ulid();

  // TODO: validate eventDate is in the future and beyond product leadTimeDays
  // TODO: load products from trc-products, verify isActive, compute unitPrice
  // TODO: invoke quote-engine for pricingSnapshot (seasonal + rush surcharges)
  // TODO: resolve customerId from event.identity (Cognito sub → trc-customers)
  // TODO: PutItem into trc-orders with PK=ORDER#<orderId>, SK=METADATA + GSI keys
  // TODO: emit order.created on the trc-orders event bus (starts Step Functions)

  throw new Error(`Not implemented — order ${orderId} for ${input.orderType} not created`);
};
