import { ulid } from "ulid";
import type {
  Seasoning,
  CreateSeasoningInput,
  UpdateSeasoningInput,
} from "../types/seasoning";
import type { SeasoningRepositoryPort } from "../repository/seasoningRepository";
import { getCategoryDefaults } from "./categoryDefaults";
import {
  validateName,
  validateCategory,
  validateMemo,
  validateAmountLevel,
} from "./validation";
import { notFound } from "../errors/apiError";

export class SeasoningService {
  constructor(private readonly repository: SeasoningRepositoryPort) {}

  async list(userId: string): Promise<Seasoning[]> {
    return this.repository.list(userId);
  }

  async create(userId: string, input: CreateSeasoningInput): Promise<Seasoning> {
    const name = validateName(input.name);
    const category = validateCategory(input.category);
    const memo = validateMemo(input.memo);
    const defaults = getCategoryDefaults(category);
    const now = new Date().toISOString();

    const seasoning: Seasoning = {
      id: ulid(),
      name,
      category,
      icon: defaults.icon,
      color: defaults.color,
      amountLevel: 100,
      needsPurchase: false,
      memo,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(userId, seasoning);
    return seasoning;
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateSeasoningInput
  ): Promise<Seasoning> {
    const existing = await this.repository.get(userId, id);
    if (!existing) {
      throw notFound(`seasoning ${id} not found`);
    }

    const merged: Seasoning = { ...existing };

    if (patch.name !== undefined) {
      merged.name = validateName(patch.name);
    }
    if (patch.category !== undefined) {
      merged.category = validateCategory(patch.category);
      const defaults = getCategoryDefaults(merged.category);
      merged.icon = defaults.icon;
      merged.color = defaults.color;
    }
    if (patch.memo !== undefined) {
      merged.memo = validateMemo(patch.memo);
    }
    if (patch.amountLevel !== undefined) {
      merged.amountLevel = validateAmountLevel(patch.amountLevel);
    }
    if (patch.needsPurchase !== undefined) {
      merged.needsPurchase = patch.needsPurchase;
    }

    // Server-side invariant: amountLevel=0 always implies needsPurchase=true.
    // "Mark as purchased" must raise amountLevel in the same request, or this wins.
    if (merged.amountLevel === 0) {
      merged.needsPurchase = true;
    }

    merged.updatedAt = new Date().toISOString();

    await this.repository.update(userId, merged);
    return merged;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.repository.delete(userId, id);
  }
}
