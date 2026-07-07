import { Amplify } from 'aws-amplify';

/**
 * Amplify v6 configuration — values from CDK outputs (TrcApi-<stage>).
 *
 * Auth model (no Cognito): sign in with Google via Google Identity Services,
 * exchange the Google ID token through the signInWithGoogle mutation (apiKey
 * auth) for a 15-minute session JWT, then make authed calls with
 * `authMode: 'lambda', authToken: sessionJwt`.
 *
 * TODO: session store (in-memory + silent Google re-auth on expiry) and a
 * <GoogleSignInButton> using NEXT_PUBLIC_GOOGLE_CLIENT_ID.
 */
export function configureAmplify() {
  Amplify.configure({
    API: {
      GraphQL: {
        endpoint: process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT ?? '',
        region: 'ca-west-1',
        defaultAuthMode: 'apiKey',
        apiKey: process.env.NEXT_PUBLIC_APPSYNC_API_KEY ?? '',
      },
    },
  });
}
