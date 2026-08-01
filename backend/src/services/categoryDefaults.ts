import type { Category } from "../types/seasoning";

interface CategoryDefault {
  icon: string;
  color: string;
}

const CATEGORY_DEFAULTS: Record<Category, CategoryDefault> = {
  液体: { icon: "liquid", color: "#5B3714" },
  チューブ: { icon: "tube", color: "#8A9A3B" },
  瓶: { icon: "jar", color: "#B23A2E" },
  粉: { icon: "powder", color: "#E4D6A7" },
  スパイス: { icon: "spice", color: "#C97A2B" },
};

export function getCategoryDefaults(category: Category): CategoryDefault {
  return CATEGORY_DEFAULTS[category];
}
