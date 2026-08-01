import { describe, it, expect } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { getUserId } from "./getUserId";

function eventWithClaims(claims: Record<string, string> | undefined): APIGatewayProxyEvent {
  return {
    requestContext: {
      authorizer: claims ? { claims } : undefined,
    },
  } as unknown as APIGatewayProxyEvent;
}

describe("getUserId", () => {
  it("returns the sub claim when present", () => {
    const event = eventWithClaims({ sub: "user-123", email: "a@example.com" });
    expect(getUserId(event)).toBe("user-123");
  });

  it("throws 401 when authorizer claims are missing", () => {
    const event = eventWithClaims(undefined);
    expect(() => getUserId(event)).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it("throws 401 when sub is missing from claims", () => {
    const event = eventWithClaims({ email: "a@example.com" });
    expect(() => getUserId(event)).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    );
  });
});
