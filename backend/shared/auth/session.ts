import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { REGION } from '../constants/index.js';

/**
 * Session JWTs — MaidLink-style auth:
 * Google ID token verified once at sign-in → we mint our own short-lived
 * HS256 session JWT with admin flag from an email allowlist.
 */

export const SESSION_TTL_MINUTES = 15;
const ISSUER = 'trc-garlands';

export interface SessionClaims {
  sub: string; // customerId (Google sub)
  email: string;
  name: string;
  isAdmin: boolean;
}

// ── Signing secret (Secrets Manager, cached at cold start) ────
const sm = new SecretsManagerClient({ region: REGION });
let cachedSecret: Uint8Array | undefined;

async function getSecret(): Promise<Uint8Array> {
  if (!cachedSecret) {
    const res = await sm.send(
      new GetSecretValueCommand({ SecretId: process.env.JWT_SECRET_ARN })
    );
    if (!res.SecretString) throw new Error('JWT secret not found');
    cachedSecret = new TextEncoder().encode(res.SecretString);
  }
  return cachedSecret;
}

// ── Our session tokens ────────────────────────────────────────
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name, isAdmin: claims.isAdmin })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_MINUTES}m`)
    .sign(await getSecret());
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, await getSecret(), { issuer: ISSUER });
  return {
    sub: payload.sub ?? '',
    email: String(payload.email ?? ''),
    name: String(payload.name ?? ''),
    isAdmin: payload.isAdmin === true,
  };
}

// ── Google ID token verification ──────────────────────────────
const googleJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');

  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });

  if (payload.email_verified !== true) {
    throw new Error('Google account email is not verified');
  }
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name ?? payload.email),
  };
}

// ── Admin allowlist ───────────────────────────────────────────
export function isAdminEmail(email: string): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
