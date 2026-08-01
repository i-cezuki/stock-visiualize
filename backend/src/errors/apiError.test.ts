import { describe, it, expect } from "vitest";
import { ApiError, badRequest, notFound, conflict } from "./apiError";

describe("ApiError", () => {
  it("badRequest produces a 400 VALIDATION_ERROR", () => {
    const error = badRequest("name is required");
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("name is required");
  });

  it("notFound produces a 404 NOT_FOUND", () => {
    const error = notFound("seasoning missing");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("conflict produces a 409 CONFLICT", () => {
    const error = conflict("seasoning exists");
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("CONFLICT");
  });
});
