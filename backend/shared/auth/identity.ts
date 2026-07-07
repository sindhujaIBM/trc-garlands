import type { AppSyncResolverEvent, AppSyncIdentityLambda } from 'aws-lambda';

export interface CallerContext {
  customerId?: string;
  email?: string;
  isAdmin: boolean;
}

/**
 * Extract the caller context set by the Lambda authorizer's resolverContext.
 * Unauthenticated (API key) callers get { isAdmin: false }.
 */
export function getCaller(event: AppSyncResolverEvent<unknown>): CallerContext {
  const identity = event.identity as AppSyncIdentityLambda | null | undefined;
  const ctx = identity?.resolverContext as Record<string, string> | undefined;
  if (!ctx) return { isAdmin: false };
  return {
    customerId: ctx.customerId,
    email: ctx.email,
    isAdmin: ctx.isAdmin === 'true',
  };
}

export function requireAdmin(event: AppSyncResolverEvent<unknown>): CallerContext {
  const caller = getCaller(event);
  if (!caller.isAdmin) throw new Error('Unauthorized: admin access required');
  return caller;
}

export function requireCustomer(event: AppSyncResolverEvent<unknown>): CallerContext {
  const caller = getCaller(event);
  if (!caller.customerId) throw new Error('Unauthorized: sign-in required');
  return caller;
}
