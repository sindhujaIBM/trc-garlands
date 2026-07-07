import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path';
import { Construct } from 'constructs';
import type { TrcTables } from './database-stack';

export interface LambdaStackProps extends cdk.StackProps {
  stage: string;
  tables: TrcTables;
}

export interface TrcFunctions {
  orderProcessor: NodejsFunction;
  quoteEngine: NodejsFunction;
  aiChatHandler: NodejsFunction;
  apiResolver: NodejsFunction;
}

const BACKEND = path.join(__dirname, '../../../backend/functions');

/**
 * All Lambda functions (architecture-plan.md §1 business logic layer).
 * Each function gets its own IAM role with minimum table actions (§8).
 */
export class LambdaStack extends cdk.Stack {
  public readonly functions: TrcFunctions;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);
    const { stage, tables } = props;

    const defaults: Partial<NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      bundling: { minify: true, sourceMap: true, target: 'node20' },
      environment: {
        ORDERS_TABLE: tables.orders.tableName,
        CUSTOMERS_TABLE: tables.customers.tableName,
        PRODUCTS_TABLE: tables.products.tableName,
        CHAT_SESSIONS_TABLE: tables.chatSessions.tableName,
        SEASONAL_EVENTS_TABLE: tables.seasonalEvents.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
    };

    const orderProcessor = new NodejsFunction(this, 'OrderProcessor', {
      ...defaults,
      functionName: `${stage}-trc-order-processor`,
      entry: path.join(BACKEND, 'order-processor/index.ts'),
    });
    tables.orders.grantReadWriteData(orderProcessor);
    tables.products.grantReadData(orderProcessor);
    tables.customers.grantReadData(orderProcessor);

    const quoteEngine = new NodejsFunction(this, 'QuoteEngine', {
      ...defaults,
      functionName: `${stage}-trc-quote-engine`,
      entry: path.join(BACKEND, 'quote-engine/index.ts'),
    });
    tables.seasonalEvents.grantReadData(quoteEngine);
    tables.products.grantReadData(quoteEngine);

    const aiChatHandler = new NodejsFunction(this, 'AiChatHandler', {
      ...defaults,
      functionName: `${stage}-trc-ai-chat-handler`,
      timeout: cdk.Duration.seconds(30), // Bedrock latency headroom
      entry: path.join(BACKEND, 'ai-chat-handler/index.ts'),
    });
    tables.chatSessions.grantReadWriteData(aiChatHandler);
    tables.products.grantReadData(aiChatHandler);
    tables.seasonalEvents.grantReadData(aiChatHandler);
    // Specific model ARNs, not bedrock:* (§8)
    aiChatHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-*`,
        ],
      })
    );

    const apiResolver = new NodejsFunction(this, 'ApiResolver', {
      ...defaults,
      functionName: `${stage}-trc-api-resolver`,
      entry: path.join(BACKEND, 'api-resolver/index.ts'),
    });
    tables.orders.grantReadData(apiResolver);
    tables.products.grantReadData(apiResolver);
    tables.customers.grantReadData(apiResolver);

    // TODO: notification-sender (EventBridge target), payment-handler (Stripe
    // webhook via Lambda URL or API GW), invoice-generator — added with the
    // Step Functions order lifecycle.

    this.functions = { orderProcessor, quoteEngine, aiChatHandler, apiResolver };
  }
}
