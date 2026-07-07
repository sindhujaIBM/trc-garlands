import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as path from 'node:path';
import { Construct } from 'constructs';
import type { TrcFunctions } from './lambda-stack';

export interface ApiStackProps extends cdk.StackProps {
  stage: string;
  functions: TrcFunctions;
}

/**
 * AppSync GraphQL API (architecture-plan.md §1/§8).
 *
 * Auth — MaidLink pattern, no Cognito:
 *  - API Key: public catalog reads, inquiry, chat, and signInWithGoogle
 *  - Lambda authorizer: validates our 15-min session JWTs (minted by
 *    auth-handler after verifying the Google ID token). Admin access is an
 *    email allowlist (ADMIN_EMAILS) baked into the JWT's isAdmin claim and
 *    enforced in resolvers via requireAdmin().
 */
export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { stage, functions } = props;

    this.api = new appsync.GraphqlApi(this, 'Api', {
      name: `${stage}-trc-garlands`,
      definition: appsync.Definition.fromFile(
        path.join(__dirname, '../../../backend/graphql/schema.graphql')
      ),
      authorizationConfig: {
        // Public: catalog + inquiry + chat + sign-in
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            description: 'Public catalog + inquiry + sign-in',
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.LAMBDA,
            lambdaAuthorizerConfig: {
              handler: functions.authorizer,
              resultsCacheTtl: cdk.Duration.minutes(5),
            },
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
    const authDs = this.api.addLambdaDataSource('AuthHandlerDs', functions.authHandler);

    // Read queries → api-resolver (admin/customer checks inside the handler)
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

    // Google sign-in → auth-handler
    authDs.createResolver('MutationsignInWithGoogle', {
      typeName: 'Mutation',
      fieldName: 'signInWithGoogle',
    });

    new cdk.CfnOutput(this, 'GraphqlUrl', { value: this.api.graphqlUrl });
    new cdk.CfnOutput(this, 'GraphqlApiKey', { value: this.api.apiKey ?? '' });
  }
}
