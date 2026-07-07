import type {
  AppSyncAuthorizerEvent,
  AppSyncAuthorizerResult,
} from 'aws-lambda';
import { verifySession } from '../../shared/auth/session.js';

interface ResolverContext extends Record<string, string> {
  customerId: string;
  email: string;
  name: string;
  isAdmin: string; // 'true' | 'false' — resolverContext values are strings
}

/**
 * AppSync Lambda authorizer — validates our 15-minute session JWTs
 * (minted by auth-handler after Google sign-in). Sets resolverContext
 * that resolvers read via shared/auth/identity.getCaller().
 */
export const handler = async (
  event: AppSyncAuthorizerEvent
): Promise<AppSyncAuthorizerResult<ResolverContext>> => {
  try {
    const token = event.authorizationToken.replace(/^Bearer\s+/i, '');
    const claims = await verifySession(token);
    return {
      isAuthorized: true,
      resolverContext: {
        customerId: claims.sub,
        email: claims.email,
        name: claims.name,
        isAdmin: String(claims.isAdmin),
      },
      // AppSync may cache authorizer results; keep it short of token TTL
      ttlOverride: 300,
    };
  } catch {
    return { isAuthorized: false };
  }
};
