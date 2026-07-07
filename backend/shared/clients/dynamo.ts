import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { REGION } from '../constants/index.js';

const client = new DynamoDBClient({ region: REGION });

/** Shared document client — reuse across invocations (module-level cache). */
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
