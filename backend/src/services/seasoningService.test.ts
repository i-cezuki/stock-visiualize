import { describe, it, expect, vi } from "vitest";
import { SeasoningService } from "./seasoningService";
import type { SeasoningRepositoryPort } from "../repository/seasoningRepository";
import type { Seasoning } from "../types/seasoning";

function makeRepository(
  overrides: Partial<SeasoningRepositoryPort> = {}
): SeasoningRepositoryPort {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const existingSeasoning: Seasoning = {
  id: "01JABC123",
  name: "醤油",
  category: "液体",
  icon: "liquid",
  color: "#5B3714",
  amountLevel: 25,
  needsPurchase: false,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("SeasoningService.create", () => {
  it("assigns server-side defaults and persists the seasoning", async () => {
    const repository = makeRepository();
    const service = new SeasoningService(repository);

    const result = await service.create("user-1", { name: "醤油", category: "液体" });

    expect(result.amountLevel).toBe(100);
    expect(result.needsPurchase).toBe(false);
    expect(result.icon).toBe("liquid");
    expect(result.color).toBe("#5B3714");
    expect(result.id).toEqual(expect.any(String));
    expect(repository.create).toHaveBeenCalledWith("user-1", result);
  });

  it("rejects an invalid name", async () => {
    const repository = makeRepository();
    const service = new SeasoningService(repository);

    await expect(
      service.create("user-1", { name: "", category: "液体" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SeasoningService.update", () => {
  it("throws 404 when the seasoning does not exist", async () => {
    const repository = makeRepository({ get: vi.fn().mockResolvedValue(undefined) });
    const service = new SeasoningService(repository);

    await expect(
      service.update("user-1", "missing-id", { amountLevel: 50 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("normalizes needsPurchase to true when amountLevel is set to 0", async () => {
    const repository = makeRepository({
      get: vi.fn().mockResolvedValue(existingSeasoning),
    });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", existingSeasoning.id, {
      amountLevel: 0,
      needsPurchase: false,
    });

    expect(result.amountLevel).toBe(0);
    expect(result.needsPurchase).toBe(true);
    expect(repository.update).toHaveBeenCalledWith("user-1", result);
  });

  it("allows marking as purchased only when amountLevel is raised above 0", async () => {
    const zeroStock: Seasoning = { ...existingSeasoning, amountLevel: 0, needsPurchase: true };
    const repository = makeRepository({ get: vi.fn().mockResolvedValue(zeroStock) });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", zeroStock.id, {
      amountLevel: 100,
      needsPurchase: false,
    });

    expect(result.amountLevel).toBe(100);
    expect(result.needsPurchase).toBe(false);
  });

  it("keeps needsPurchase true if amountLevel stays 0 and only needsPurchase is patched", async () => {
    const zeroStock: Seasoning = { ...existingSeasoning, amountLevel: 0, needsPurchase: true };
    const repository = makeRepository({ get: vi.fn().mockResolvedValue(zeroStock) });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", zeroStock.id, { needsPurchase: false });

    expect(result.amountLevel).toBe(0);
    expect(result.needsPurchase).toBe(true);
  });

  it("recomputes icon/color when category changes", async () => {
    const repository = makeRepository({
      get: vi.fn().mockResolvedValue(existingSeasoning),
    });
    const service = new SeasoningService(repository);

    const result = await service.update("user-1", existingSeasoning.id, {
      category: "スパイス",
    });

    expect(result.category).toBe("スパイス");
    expect(result.icon).toBe("spice");
    expect(result.color).toBe("#C97A2B");
  });
});

describe("SeasoningService.delete", () => {
  it("delegates to the repository", async () => {
    const repository = makeRepository();
    const service = new SeasoningService(repository);

    await service.delete("user-1", "01JABC123");

    expect(repository.delete).toHaveBeenCalledWith("user-1", "01JABC123");
  });
});

describe("SeasoningService.list", () => {
  it("delegates to the repository", async () => {
    const repository = makeRepository({ list: vi.fn().mockResolvedValue([existingSeasoning]) });
    const service = new SeasoningService(repository);

    const result = await service.list("user-1");

    expect(result).toEqual([existingSeasoning]);
  });
});
