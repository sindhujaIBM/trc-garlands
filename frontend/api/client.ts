import { generateClient } from "aws-amplify/api";
import { configureAmplify } from "@/lib/amplify-config";

// configureAmplify() was defined but never called anywhere in the repo —
// this is the first real call site. Must run before generateClient().
configureAmplify();

// Hand-rolled CDK/AppSync schema (Definition.fromFile), not Amplify Gen2's
// data/resource.ts — there's no generated Schema type to pass here, so
// generateClient() stays untyped and each call site types its own response.
export const graphqlClient = generateClient();
