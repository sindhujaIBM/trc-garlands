import type { EventBridgeEvent } from 'aws-lambda';

export type NotificationDetailType =
  | 'order.created'
  | 'order.quoted'
  | 'payment.received'
  | 'order.completed'
  | 'order.reminder';

export interface NotificationDetail {
  orderId: string;
  customerId: string;
  channel?: Array<'EMAIL' | 'SMS' | 'WHATSAPP'>;
}

/**
 * notification-sender — SES / SNS / WhatsApp dispatcher.
 * Triggered by EventBridge events on the trc-orders bus.
 *
 * Channel rules (PIPEDA): only send to channels the customer opted into
 * (trc-customers emailOptIn / smsOptIn / whatsappOptIn).
 */
export const handler = async (
  event: EventBridgeEvent<NotificationDetailType, NotificationDetail>
): Promise<void> => {
  const { orderId, customerId } = event.detail;

  // TODO: load customer contact prefs from trc-customers
  // TODO: pick template by event.detail-type (see email-templates/)
  // TODO: SES send for email (booking confirm, invoice, reminders)
  // TODO: SNS publish for SMS (Canadian rates)
  // TODO(phase2): WhatsApp Cloud API for rush escalation

  console.log(`TODO notify: ${event['detail-type']} order=${orderId} customer=${customerId}`);
};
