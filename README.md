# TRC Garlands

AI-powered custom garland order platform for TRC Garlands (Calgary). Serverless-first on AWS, region `ca-west-1`.

See [architecture-plan.md](./architecture-plan.md) for the full design and [design/](./design/) for detailed specs.

## Workspaces

| Package | Purpose |
|---|---|
| `infrastructure/` | AWS CDK (TypeScript) — DynamoDB, Cognito, S3, EventBridge |
| `backend/` | Lambda functions, GraphQL schema, shared types |
| `frontend/` | Next.js 14 (App Router) — public site, customer portal, admin |

## Getting started

```bash
npm install
npm run build        # builds all workspaces
npm test             # runs all tests
```

### Deploy infrastructure (requires AWS credentials for ca-west-1)

```bash
cd infrastructure
npx cdk diff
npx cdk deploy --all
```

### Run frontend locally

```bash
cd frontend
npm run dev
```

## Status

MVP scaffold — compilable skeleton. Phase 2 features (image analysis, social posting, dynamic pricing) are documented in the architecture plan but not yet scaffolded.
