import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import type { TrcTables } from './database-stack';

export interface EventsStackProps extends cdk.StackProps {
  stage: string;
  tables: TrcTables;
  mediaBucket: s3.Bucket;
}

/**
 * EventBridge rules + (later) Step Functions order lifecycle state machine.
 * Per architecture-plan.md §1/§5.
 *
 * TODO(lambdas): once backend functions are bundled (NodejsFunction),
 * attach targets to the scheduled rules below and define the
 * order-lifecycle Step Functions state machine:
 *   INQUIRY → QUOTED → DEPOSIT_PENDING → DEPOSIT_PAID →
 *   FLOWER_SOURCING? → IN_PRODUCTION → COMPLETION_PROCESSING →
 *   READY_FOR_PICKUP_OR_DELIVERY → COMPLETED | CANCELLED
 */
export class EventsStack extends cdk.Stack {
  public readonly orderEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);
    const { stage } = props;

    // Custom bus: order.created, order.completed, payment.received
    this.orderEventBus = new events.EventBus(this, 'OrderEventBus', {
      eventBusName: `${stage}-trc-orders`,
    });

    // Daily seasonal pricing check — 6am MST (13:00 UTC)
    new events.Rule(this, 'SeasonalPricingRule', {
      ruleName: `${stage}-trc-seasonal-pricing-daily`,
      schedule: events.Schedule.cron({ minute: '0', hour: '13' }),
      description: 'Daily seasonal pricing check (6am MST) — target: seasonal-pricing-job Lambda',
      enabled: false, // enable when Lambda target is attached
    });

    // 2-week-before-event reminder scan — daily 8am MST (15:00 UTC)
    new events.Rule(this, 'EventReminderRule', {
      ruleName: `${stage}-trc-event-reminder-daily`,
      schedule: events.Schedule.cron({ minute: '0', hour: '15' }),
      description: 'Daily reminder scan for upcoming orders — target: notification-sender Lambda',
      enabled: false,
    });

    new cdk.CfnOutput(this, 'OrderEventBusName', { value: this.orderEventBus.eventBusName });
  }
}
