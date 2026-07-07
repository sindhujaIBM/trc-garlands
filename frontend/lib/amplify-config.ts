import { Amplify } from 'aws-amplify';

/**
 * Amplify v6 configuration — values come from CDK outputs via env vars.
 * Call configureAmplify() once in a client-side provider component.
 */
export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_CUSTOMER_POOL_ID ?? '',
        userPoolClientId: process.env.NEXT_PUBLIC_CUSTOMER_POOL_CLIENT_ID ?? '',
      },
    },
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
