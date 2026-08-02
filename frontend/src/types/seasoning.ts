export type Category = "液体" | "チューブ" | "瓶" | "粉" | "スパイス";

export type AmountLevel = 0 | 25 | 50 | 75 | 100;

export interface Seasoning {
  id: string;
  name: string;
  category: Category;
  icon: string;
  color: string;
  amountLevel: AmountLevel;
  needsPurchase: boolean;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeasoningInput {
  name: string;
  category: Category;
  memo?: string;
}

export interface UpdateSeasoningInput {
  name?: string;
  category?: Category;
  amountLevel?: AmountLevel;
  needsPurchase?: boolean;
  memo?: string;
}

export const CATEGORIES: Category[] = ["液体", "チューブ", "瓶", "粉", "スパイス"];

export const AMOUNT_LEVELS: AmountLevel[] = [0, 25, 50, 75, 100];

export const AMOUNT_LEVEL_LABELS: Record<AmountLevel, string> = {
  100: "満タン",
  75: "多い",
  50: "半分",
  25: "少ない",
  0: "なし",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  液体: "🧴",
  チューブ: "🧃",
  瓶: "🫙",
  粉: "🧂",
  スパイス: "🌶️",
};
