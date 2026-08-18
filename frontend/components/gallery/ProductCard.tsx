import Image from "next/image";
import type { Product } from "@/api/products";

const CATEGORY_LABELS: Record<Product["category"], string> = {
  WEDDING: "Wedding",
  CHRYSANTHEMUM: "Chrysanthemum",
  ROSE: "Rose",
  CARNATION: "Carnation",
  ACCESSORY: "Accessory",
  FRUIT: "Fruit",
  BILLS: "Currency",
};

export function ProductCard({ product }: { product: Product }) {
  const primaryPhoto = product.photos?.find((p) => p.isPrimary) ?? product.photos?.[0];
  const priceLabel =
    product.pricingUnit === "PER_FOOT"
      ? `From $${product.basePrice}/ft`
      : `From $${product.basePrice}`;

  return (
    <div className="group overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-jasmine">
        {primaryPhoto ? (
          <Image
            src={primaryPhoto.cloudFrontUrl}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Photo coming soon
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-leaf">
          {CATEGORY_LABELS[product.category]}
        </span>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-leaf">{product.name}</h3>
        <p className="mt-1 text-sm text-gray-600">{priceLabel}</p>
      </div>
    </div>
  );
}
