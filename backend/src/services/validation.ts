import type { AmountLevel, Category } from "../types/seasoning";
import { badRequest } from "../errors/apiError";

const CATEGORIES: Category[] = ["液体", "チューブ", "瓶", "粉", "スパイス"];
const AMOUNT_LEVELS: AmountLevel[] = [0, 25, 50, 75, 100];

export function validateName(name: unknown): string {
  if (typeof name !== "string" || name.length < 1 || name.length > 30) {
    throw badRequest("name must be a string between 1 and 30 characters");
  }
  return name;
}

export function validateCategory(category: unknown): Category {
  if (typeof category !== "string" || !CATEGORIES.includes(category as Category)) {
    throw badRequest(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return category as Category;
}

export function validateMemo(memo: unknown): string | undefined {
  if (memo === undefined) {
    return undefined;
  }
  if (typeof memo !== "string" || memo.length > 200) {
    throw badRequest("memo must be a string with at most 200 characters");
  }
  return memo;
}

export function validateAmountLevel(amountLevel: unknown): AmountLevel {
  if (typeof amountLevel !== "number" || !AMOUNT_LEVELS.includes(amountLevel as AmountLevel)) {
    throw badRequest(`amountLevel must be one of: ${AMOUNT_LEVELS.join(", ")}`);
  }
  return amountLevel as AmountLevel;
}
