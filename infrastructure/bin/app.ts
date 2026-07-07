#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { EventsStack } from '../lib/stacks/events-stack';

const app = new cdk.App();

// PIPEDA: Canadian data residency — all resources in Calgary
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ca-west-1',
};

// Env prefix (dev/prod) — single AWS account, env-prefixed resources
const stage = app.node.tryGetContext('stage') ?? 'dev';

const database = new DatabaseStack(app, `TrcDatabase-${stage}`, { env, stage });
const storage = new StorageStack(app, `TrcStorage-${stage}`, { env, stage });

const lambdas = new LambdaStack(app, `TrcLambda-${stage}`, {
  env,
  stage,
  tables: database.tables,
});

const api = new ApiStack(app, `TrcApi-${stage}`, {
  env,
  stage,
  functions: lambdas.functions,
});

new EventsStack(app, `TrcEvents-${stage}`, {
  env,
  stage,
  tables: database.tables,
  mediaBucket: storage.mediaBucket,
});

app.synth();
