import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
}

export interface TrcTables {
  orders: dynamodb.Table;
  customers: dynamodb.Table;
  products: dynamodb.Table;
  chatSessions: dynamodb.Table;
  seasonalEvents: dynamodb.Table;
}

/**
 * Foundation stack: all MVP DynamoDB tables + GSIs.
 * Schema per architecture-plan.md §3. On-demand billing (zero cost when idle).
 * Phase 2 tables (flower-availability, pricing-rules, substitutions,
 * supplier-pricing-history) are added here when Phase 2 begins.
 */
export class DatabaseStack extends cdk.Stack {
  public readonly tables: TrcTables;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);
    const { stage } = props;

    const common: Partial<dynamodb.TableProps> = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy:
        stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    };

    // ── trc-orders ─────────────────────────────────────────────
    const orders = new dynamodb.Table(this, 'OrdersTable', {
      ...common,
      tableName: `${stage}-trc-orders`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // ORDER#<orderId>
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // METADATA
    });
    // Muni's work queue sorted by event date
    orders.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // STATUS#<status>
      sortKey: { name: 'eventDate', type: dynamodb.AttributeType.STRING },
    });
    // Customer order history
    orders.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING }, // CUSTOMER#<customerId>
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });
    // Monthly calendar view
    orders.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING }, // DATE#<YYYY-MM>
      sortKey: { name: 'eventDate', type: dynamodb.AttributeType.STRING },
    });

    // ── trc-customers ──────────────────────────────────────────
    const customers = new dynamodb.Table(this, 'CustomersTable', {
      ...common,
      tableName: `${stage}-trc-customers`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // CUSTOMER#<customerId>
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // PROFILE
    });
    customers.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // EMAIL#<email>
    });
    customers.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING }, // PHONE#<phone>
    });

    // ── trc-products ───────────────────────────────────────────
    const products = new dynamodb.Table(this, 'ProductsTable', {
      ...common,
      tableName: `${stage}-trc-products`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // PRODUCT#<productId>
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // METADATA
    });
    products.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // CATEGORY#<category>
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
    });
    products.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING }, // ACTIVE#true
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
    });

    // ── trc-chat-sessions (90-day TTL) ─────────────────────────
    const chatSessions = new dynamodb.Table(this, 'ChatSessionsTable', {
      ...common,
      tableName: `${stage}-trc-chat-sessions`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // SESSION#<sessionId>
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // METADATA
      timeToLiveAttribute: 'ttl',
    });
    chatSessions.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // CUSTOMER#<customerId>
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });
    chatSessions.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING }, // STATUS#ESCALATED
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // ── trc-seasonal-events ────────────────────────────────────
    const seasonalEvents = new dynamodb.Table(this, 'SeasonalEventsTable', {
      ...common,
      tableName: `${stage}-trc-seasonal-events`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // SEASON#<year>
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // EVENT#<eventId>
    });

    this.tables = { orders, customers, products, chatSessions, seasonalEvents };

    new cdk.CfnOutput(this, 'OrdersTableName', { value: orders.tableName });
    new cdk.CfnOutput(this, 'ProductsTableName', { value: products.tableName });
  }
}
