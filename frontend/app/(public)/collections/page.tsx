"use client";

import { useEffect, useState } from "react";
import { listProducts, type Product, type ProductCategory } from "@/api/products";
import { ProductCard } from "@/components/gallery/ProductCard";
import { CategoryFilter } from "@/components/gallery/CategoryFilter";

export default function CollectionsPage() {
  const [category, setCategory] = useState<ProductCategory | "ALL">("ALL");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listProducts({ category: category === "ALL" ? undefined : category, limit: 48 })
      .then((result) => {
        if (!cancelled) setProducts(result.items);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the gallery right now — please try again shortly.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-leaf">Our Collection</h1>
      <p className="mt-2 text-gray-600">
        Every piece handcrafted to order — woven, not sewn. Use a design here as your starting
        point, or build your own.
      </p>

      <div className="mt-6">
        <CategoryFilter active={category} onChange={setCategory} />
      </div>

      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}

      {isLoading && !error && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-jasmine" />
          ))}
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <p className="mt-8 text-gray-600">No designs in this category yet — check back soon.</p>
      )}

      {!isLoading && !error && products.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
