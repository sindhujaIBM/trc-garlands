import { graphqlClient } from "./client";

const LIST_PRODUCTS = /* GraphQL */ `
  query ListProducts($category: ProductCategory, $limit: Int, $nextToken: String) {
    listProducts(category: $category, limit: $limit, nextToken: $nextToken) {
      items {
        productId
        name
        slug
        category
        basePrice
        pricingUnit
        primaryFlowers
        photos {
          cloudFrontUrl
          isPrimary
        }
      }
      nextToken
    }
  }
`;

export type ProductCategory =
  | "WEDDING"
  | "CHRYSANTHEMUM"
  | "ROSE"
  | "CARNATION"
  | "ACCESSORY"
  | "FRUIT"
  | "BILLS";

export interface Product {
  productId: string;
  name: string;
  slug: string;
  category: ProductCategory;
  basePrice: number;
  pricingUnit: "PER_FOOT" | "PER_UNIT";
  primaryFlowers: string[];
  photos: { cloudFrontUrl: string; isPrimary: boolean }[] | null;
}

export interface ProductConnection {
  items: Product[];
  nextToken: string | null;
}

// Same mock-mode seam as sendChatMessage (api/chat.ts) — lets the gallery
// render in local dev before frontend/.env.local is populated.
function mockListProducts(): Promise<ProductConnection> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        items: [],
        nextToken: null,
      });
    }, 300);
  });
}

export async function listProducts(input: {
  category?: ProductCategory;
  limit?: number;
  nextToken?: string;
}): Promise<ProductConnection> {
  if (!process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT) {
    return mockListProducts();
  }

  const result = await graphqlClient.graphql({
    query: LIST_PRODUCTS,
    variables: {
      category: input.category ?? null,
      limit: input.limit ?? 24,
      nextToken: input.nextToken ?? null,
    },
  });

  if (!("data" in result) || !result.data) {
    throw new Error("listProducts returned no data");
  }
  return result.data.listProducts;
}
