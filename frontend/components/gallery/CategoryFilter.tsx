import type { ProductCategory } from "@/api/products";

const CATEGORIES: { value: ProductCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "WEDDING", label: "Wedding" },
  { value: "CHRYSANTHEMUM", label: "Chrysanthemum" },
  { value: "ROSE", label: "Rose" },
  { value: "CARNATION", label: "Carnation" },
  { value: "ACCESSORY", label: "Accessories" },
  { value: "FRUIT", label: "Fruit" },
  { value: "BILLS", label: "Currency" },
];

export function CategoryFilter({
  active,
  onChange,
}: {
  active: ProductCategory | "ALL";
  onChange: (category: ProductCategory | "ALL") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className={
            "rounded-full border px-3 py-1 text-sm transition " +
            (active === c.value
              ? "border-leaf bg-leaf text-white"
              : "border-gray-300 text-gray-700 hover:border-leaf hover:text-leaf")
          }
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
