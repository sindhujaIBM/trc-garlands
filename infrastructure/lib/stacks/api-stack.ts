import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as path from 'node:path';
import { Construct } from 'constructs';
import type { TrcTables } from './database-stack';
import type { TrcFunctions } from './lambda-stack';

export interface ApiStackProps extends cdk.StackProps {
  stage: string;
  tables: TrcTables;
  functions: TrcFunctions;
}

/**
 * Cognito auth + AppSync GraphQL API (architecture-plan.md §1/§8).
 *  - Customer User Pool: self-sign-up
 *  - Admin (Muni) User Pool: invite-only, MFA required
 *  - AppSync auth: API Key (public catalog reads) + customer pool (mutations)
 *
 * TODO(admin-auth): AppSync allows one Cognito auth provider — admin calls
 * currently need a Lambda authorizer against the admin pool, or move Muni
 * into an "admin" group on the customer pool. Decision pending; until then
 * admin fields resolve but are not reachable with admin credentials.
 */
export class ApiStack extends cdk.Stack {
  public readonly customerPool: cognito.UserPool;
  public readonly adminPool: cognito.UserPool;
  public readonly api: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { stage, functions } = props;

    const removalPolicy =
      stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ── Customer pool (self-sign-up) ───────────────────────────
    this.customerPool = new cognito.UserPool(this, 'CustomerPool', {
      userPoolName: `${stage}-trc-customers`,
      selfSignUpEnabled: true,
      signInAliases: { email: true, phone: true },
      autoVerify: { email: true },
      standardAttributes: {
        fullname: { required: true, mutable: true },
        phoneNumber: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy,
    });

    this.customerPool.addClient('CustomerWebClient', {
      userPoolClientName: `${stage}-trc-customer-web`,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
    });

    // ── Admin pool (invite-only, MFA required) ─────────────────
    this.adminPool = new cognito.UserPool(this, 'AdminPool', {
      userPoolName: `${stage}-trc-admin`,
      selfSignUpEnabled: false, // invite-only
      signInAliases: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true }, // TOTP
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy,
    });

    this.adminPool.addClient('AdminWebClient', {
      userPoolClientName: `${stage}-trc-admin-web`,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
    });

    // ── AppSync GraphQL API ────────────────────────────────────
    this.api = new appsync.GraphqlApi(this, 'Api', {
      name: `${stage}-trc-garlands`,
      definition: appsync.Definition.fromFile(
        path.join(__dirname, '../../../backend/graphql/schema.graphql')
      ),
      authorizationConfig: {
        // Public catalog reads + inquiry/chat
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            description: 'Public catalog + inquiry',
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: { userPool: this.customerPool },
          },
        ],
      },
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ERROR },
      xrayEnabled: true,
    });

    // ── Data sources + resolvers ───────────────────────────────
    const apiResolverDs = this.api.addLambdaDataSource(
      'ApiResolverDs',
      functions.apiResolver
    );
    const orderProcessorDs = this.api.addLambdaDataSource(
      'OrderProcessorDs',
      functions.orderProcessor
    );
    const chatDs = this.api.addLambdaDataSource(
      'AiChatHandlerDs',
      functions.aiChatHandler
    );

    // Read queries → api-resolver
    for (const fieldName of [
      'listProducts',
      'getProduct',
      'myOrders',
      'getOrder',
      'ordersByStatus',
      'ordersByMonth',
    ]) {
      apiResolverDs.createResolver(`Query${fieldName}`, {
        typeName: 'Query',
        fieldName,
      });
    }

    // Order mutations → order-processor
    for (const fieldName of ['createOrder', 'submitInquiry', 'updateOrderStatus']) {
      orderProcessorDs.createResolver(`Mutation${fieldName}`, {
        typeName: 'Mutation',
        fieldName,
      });
    }

    // Chat → ai-chat-handler
    chatDs.createResolver('MutationsendChatMessage', {
      typeName: 'Mutation',
      fieldName: 'sendChatMessage',
    });

    new cdk.CfnOutput(this, 'CustomerPoolId', { value: this.customerPool.userPoolId });
    new cdk.CfnOutput(this, 'AdminPoolId', { value: this.adminPool.userPoolId });
    new cdk.CfnOutput(this, 'GraphqlUrl', { value: this.api.graphqlUrl });
    new cdk.CfnOutput(this, 'GraphqlApiKey', { value: this.api.apiKey ?? '' });
  }
}
