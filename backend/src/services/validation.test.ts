import { describe, it, expect } from "vitest";
import {
  validateName,
  validateCategory,
  validateMemo,
  validateAmountLevel,
} from "./validation";

describe("validateName", () => {
  it("accepts a 1-30 character string", () => {
    expect(validateName("醤油")).toBe("醤油");
  });

  it("rejects an empty string", () => {
    expect(() => validateName("")).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("rejects a string longer than 30 characters", () => {
    expect(() => validateName("あ".repeat(31))).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("rejects non-string input", () => {
    expect(() => validateName(123)).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe("validateCategory", () => {
  it("accepts a defined category", () => {
    expect(validateCategory("液体")).toBe("液体");
  });

  it("rejects an unknown category", () => {
    expect(() => validateCategory("野菜")).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe("validateMemo", () => {
  it("allows undefined", () => {
    expect(validateMemo(undefined)).toBeUndefined();
  });

  it("allows an empty string", () => {
    expect(validateMemo("")).toBe("");
  });

  it("rejects a string longer than 200 characters", () => {
    expect(() => validateMemo("あ".repeat(201))).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe("validateAmountLevel", () => {
  it("accepts each of the five allowed levels", () => {
    for (const level of [0, 25, 50, 75, 100]) {
      expect(validateAmountLevel(level)).toBe(level);
    }
  });

  it("rejects a value outside the allowed set", () => {
    expect(() => validateAmountLevel(60)).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});
