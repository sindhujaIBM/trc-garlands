import type { AppSyncResolverEvent } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../../shared/clients/dynamo.js';
import { TABLES } from '../../shared/constants/index.js';
import {
  verifyGoogleIdToken,
  signSession,
  isAdminEmail,
  SESSION_TTL_MINUTES,
} from '../../shared/auth/session.js';

interface SignInArgs {
  idToken: string;
}

interface AuthSession {
  token: string;
  expiresAt: string;
  customerId: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

/**
 * auth-handler — resolves Mutation.signInWithGoogle.
 * Verifies the Google ID token (JWKS + audience), upserts the customer,
 * and mints a 15-minute session JWT. Admins come from the ADMIN_EMAILS
 * allowlist (MaidLink pattern).
 */
export const handler = async (
  event: AppSyncResolverEvent<SignInArgs>
): Promise<AuthSession> => {
  const profile = await verifyGoogleIdToken(event.arguments.idToken);

  // customerId = stable Google sub
  const customerId = profile.sub;
  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.customers,
      Key: { PK: `CUSTOMER#${customerId}`, SK: 'PROFILE' },
      UpdateExpression:
        'SET customerId = :id, #n = :name, email = :email, GSI1PK = :emailKey, ' +
        'lastSignInAt = :now, createdAt = if_not_exists(createdAt, :now)',
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: {
        ':id': customerId,
        ':name': profile.name,
        ':email': profile.email,
        ':emailKey': `EMAIL#${profile.email.toLowerCase()}`,
        ':now': now,
      },
    })
  );

  const isAdmin = isAdminEmail(profile.email);
  const token = await signSession({
    sub: customerId,
    email: profile.email,
    name: profile.name,
    isAdmin,
  });

  return {
    token,
    expiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString(),
    customerId,
    name: profile.name,
    email: profile.email,
    isAdmin,
  };
};
