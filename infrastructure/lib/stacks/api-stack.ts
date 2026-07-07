import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import type { TrcTables } from './database-stack';

export interface ApiStackProps extends cdk.StackProps {
  stage: string;
  tables: TrcTables;
}

/**
 * Auth (Cognito) + API. Per architecture-plan.md §1/§8:
 *  - Customer User Pool: self-sign-up
 *  - Admin (Muni) User Pool: invite-only, MFA required
 *
 * TODO(appsync): add AppSync GraphQL API wired to backend/graphql/schema.graphql
 * with Lambda resolvers; auth modes = API Key (public catalog reads) +
 * customer pool (mutations) + admin pool (admin fields).
 */
export class ApiStack extends cdk.Stack {
  public readonly customerPool: cognito.UserPool;
  public readonly adminPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { stage } = props;

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

    new cdk.CfnOutput(this, 'CustomerPoolId', { value: this.customerPool.userPoolId });
    new cdk.CfnOutput(this, 'AdminPoolId', { value: this.adminPool.userPoolId });
  }
}
