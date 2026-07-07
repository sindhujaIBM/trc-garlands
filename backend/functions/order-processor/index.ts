import type { AppSyncResolverEvent } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { ddb } from '../../shared/clients/dynamo.js';
import { TABLES } from '../../shared/constants/index.js';
import type { Order, OrderStatus, OrderType, GarlandItem } from '../../shared/types/index.js';

interface CreateOrderArgs {
  input: {
    orderType: OrderType;
    eventDate: string;
    deliveryMethod: 'PICKUP' | 'DELIVERY';
    deliveryAddress?: string;
    items: Array<Pick<GarlandItem, 'productId' | 'length' | 'flowerTypes' | 'colors' | 'qty'>>;
  };
}

interface SubmitInquiryArgs {
  input: {
    name: string;
    email?: string;
    phone?: string;
    occasion: string;
    eventDate?: string;
    message: string;
  };
}

interface UpdateOrderStatusArgs {
  orderId: string;
  status: OrderStatus;
  note?: string;
}

type Args = CreateOrderArgs | SubmitInquiryArgs | UpdateOrderStatusArgs;

/**
 * order-processor — AppSync resolver for order mutations.
 * Dispatches on event.info.fieldName:
 *   createOrder (customer), submitInquiry (public), updateOrderStatus (admin)
 */
export const handler = async (event: AppSyncResolverEvent<Args>): Promise<unknown> => {
  switch (event.info.fieldName) {
    case 'submitInquiry':
      return submitInquiry(event.arguments as SubmitInquiryArgs);
    case 'createOrder':
      return createOrder(event as AppSyncResolverEvent<CreateOrderArgs>);
    case 'updateOrderStatus':
      return updateOrderStatus(event.arguments as UpdateOrderStatusArgs);
    default:
      throw new Error(`Unknown field: ${event.info.fieldName}`);
  }
};

async function submitInquiry(args: SubmitInquiryArgs) {
  const { input } = args;
  if (!input.email && !input.phone) {
    throw new Error('Please provide an email or phone number so Muni can reach you.');
  }

  const inquiryId = ulid();
  const now = new Date().toISOString();

  await ddb.send(
    new PutCommand({
      TableName: TABLES.orders,
      Item: {
        PK: `ORDER#${inquiryId}`,
        SK: 'METADATA',
        GSI1PK: 'STATUS#INQUIRY',
        GSI3PK: `DATE#${(input.eventDate ?? now).slice(0, 7)}`,
        orderId: inquiryId,
        status: 'INQUIRY',
        orderType: 'GENERAL', // refined when Muni follows up
        eventDate: input.eventDate ?? '',
        inquiry: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          occasion: input.occasion,
          message: input.message,
        },
        createdAt: now,
        updatedAt: now,
      },
    })
  );

  // TODO: emit order.created on the trc-orders event bus → notification-sender
  //       alerts Muni (SNS) about the new inquiry

  return {
    inquiryId,
    message: `Thank you, ${input.name}! Muni will personally follow up within 1 business day.`,
  };
}

async function createOrder(event: AppSyncResolverEvent<CreateOrderArgs>): Promise<Order> {
  const orderId = ulid();
  const { input } = event.arguments;

  // TODO: validate eventDate is in the future and beyond product leadTimeDays
  // TODO: load products from trc-products, verify isActive, compute unitPrice
  // TODO: invoke quote-engine for pricingSnapshot + riskTags
  // TODO: resolve customerId from event.identity (Cognito sub → trc-customers)
  // TODO: PutItem with GSI keys; emit order.created (starts Step Functions)

  throw new Error(`Not implemented — order ${orderId} for ${input.orderType} not created`);
}

async function updateOrderStatus(args: UpdateOrderStatusArgs): Promise<Order> {
  // TODO: verify caller is in admin pool (event.identity)
  // TODO: UpdateCommand: status + GSI1PK, append note to muniNotes
  // TODO: status → COMPLETED triggers invoice + balance payment (Step Functions)
  throw new Error(`Not implemented — cannot set ${args.orderId} to ${args.status}`);
}
