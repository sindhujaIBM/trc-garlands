import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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
  authorizer: NodejsFunction;
  authHandler: NodejsFunction;
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
    // Specific model ARNs, not bedrock:* (§8). Claude isn't natively hosted
    // in ca-west-1, so the handler calls the `global.anthropic.claude-haiku-4-5`
    // cross-region inference profile — verified via `aws bedrock
    // get-inference-profile`, which requires permission on both the
    // inference-profile resource itself and the underlying foundation
    // model ARNs it routes to (returned by that same call).
    aiChatHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/global.anthropic.claude-haiku-4-5-*`,
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-haiku-4-5-*`,
          `arn:aws:bedrock:::foundation-model/anthropic.claude-haiku-4-5-*`,
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

    // ── Auth (MaidLink pattern: Google sign-in → 15-min session JWT) ──
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `${stage}-trc-jwt-secret`,
      description: 'HS256 signing secret for session JWTs',
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });

    // TODO: create the OAuth client in Google Cloud Console and pass via
    // `cdk deploy --context googleClientId=...` (or set a default here)
    const googleClientId = this.node.tryGetContext('googleClientId') ?? '';
    const adminEmails =
      this.node.tryGetContext('adminEmails') ?? 'sindhujakalisrinivasan@gmail.com';

    const authorizer = new NodejsFunction(this, 'Authorizer', {
      ...defaults,
      functionName: `${stage}-trc-authorizer`,
      entry: path.join(BACKEND, 'authorizer/index.ts'),
      timeout: cdk.Duration.seconds(5),
      environment: { ...defaults.environment, JWT_SECRET_ARN: jwtSecret.secretArn },
    });
    jwtSecret.grantRead(authorizer);

    const authHandler = new NodejsFunction(this, 'AuthHandler', {
      ...defaults,
      functionName: `${stage}-trc-auth-handler`,
      entry: path.join(BACKEND, 'auth-handler/index.ts'),
      environment: {
        ...defaults.environment,
        JWT_SECRET_ARN: jwtSecret.secretArn,
        GOOGLE_CLIENT_ID: googleClientId,
        ADMIN_EMAILS: adminEmails,
      },
    });
    jwtSecret.grantRead(authHandler);
    tables.customers.grantReadWriteData(authHandler);

    // TODO: notification-sender (EventBridge target), payment-handler (Stripe
    // webhook via Lambda URL or API GW), invoice-generator — added with the
    // Step Functions order lifecycle.

    this.functions = {
      orderProcessor,
      quoteEngine,
      aiChatHandler,
      apiResolver,
      authorizer,
      authHandler,
    };
  }
}
