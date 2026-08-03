import type { Category } from "../types/seasoning";

export type IconShape = "bottle" | "squeeze" | "jar" | "shaker";

export interface SeasoningIconConfig {
  shape: IconShape;
  color: string;
  accent: string;
}

/**
 * Real-world container shape/color per common seasoning name, so e.g. ketchup
 * (red squeeze bottle) and mayonnaise (cream bottle, red cap) look distinct
 * instead of sharing one generic per-category glyph.
 */
const ICON_BY_NAME: Record<string, SeasoningIconConfig> = {
  醤油: { shape: "bottle", color: "#3D2612", accent: "#1F1209" },
  みりん: { shape: "bottle", color: "#C9A227", accent: "#8A6D1B" },
  酒: { shape: "bottle", color: "#F5F1E8", accent: "#B8B0A0" },
  酢: { shape: "bottle", color: "#E8D9A0", accent: "#A89B6E" },
  ごま油: { shape: "bottle", color: "#8A5A1E", accent: "#5C3B12" },
  オリーブオイル: { shape: "bottle", color: "#8A9A3B", accent: "#5C6626" },
  味噌: { shape: "jar", color: "#8A6238", accent: "#5C4023" },
  甜麺醤: { shape: "jar", color: "#4A2E14", accent: "#2E1B0C" },
  豆板醤: { shape: "jar", color: "#B23A2E", accent: "#7A251C" },
  コチュジャン: { shape: "jar", color: "#C13A2A", accent: "#8A2A1F" },
  ケチャップ: { shape: "squeeze", color: "#D62E1F", accent: "#8A1F14" },
  マヨネーズ: { shape: "squeeze", color: "#F5F0DC", accent: "#D62E1F" },
  ソース: { shape: "bottle", color: "#2E1E12", accent: "#1A110A" },
  ポン酢: { shape: "bottle", color: "#D9A441", accent: "#9C7A2E" },
  白だし: { shape: "bottle", color: "#C9A96A", accent: "#8A6D40" },
  コンソメ: { shape: "jar", color: "#D9C48A", accent: "#A88A4E" },
  鶏ガラスープ: { shape: "jar", color: "#E8D9B0", accent: "#B8A26E" },
  塩: { shape: "shaker", color: "#F5F5F0", accent: "#8A8A8A" },
  砂糖: { shape: "jar", color: "#FFFFFF", accent: "#D9D9D0" },
  胡椒: { shape: "shaker", color: "#3A3A3A", accent: "#8A8A8A" },
};

const CATEGORY_FALLBACK: Record<Category, SeasoningIconConfig> = {
  液体: { shape: "bottle", color: "#5B3714", accent: "#3A230D" },
  チューブ: { shape: "squeeze", color: "#8A9A3B", accent: "#5C6626" },
  瓶: { shape: "jar", color: "#B23A2E", accent: "#7A251C" },
  粉: { shape: "shaker", color: "#E4D6A7", accent: "#8A8A8A" },
  スパイス: { shape: "shaker", color: "#C97A2B", accent: "#8A8A8A" },
};

export function getSeasoningIconConfig(name: string, category: Category): SeasoningIconConfig {
  return ICON_BY_NAME[name] ?? CATEGORY_FALLBACK[category];
}
