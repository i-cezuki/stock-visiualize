import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "./handler";

const ddbMock = mockClient(DynamoDBDocumentClient);

function baseEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/seasonings",
    pathParameters: null,
    body: null,
    requestContext: {
      authorizer: { claims: { sub: "user-1" } },
    },
    ...overrides,
  } as unknown as APIGatewayProxyEvent;
}

describe("handler", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("returns 200 with CORS headers for OPTIONS without requiring auth", async () => {
    const event = baseEvent({ httpMethod: "OPTIONS", requestContext: {} as never });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("returns 401 with CORS headers when unauthenticated", async () => {
    const event = baseEvent({ requestContext: {} as never });
    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("lists seasonings on GET /seasonings", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const result = await handler(baseEvent({ httpMethod: "GET" }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  it("creates a seasoning on POST /seasonings", async () => {
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(
      baseEvent({
        httpMethod: "POST",
        body: JSON.stringify({ name: "醤油", category: "液体" }),
      })
    );

    expect(result.statusCode).toBe(201);
    const created = JSON.parse(result.body);
    expect(created.name).toBe("醤油");
    expect(created.amountLevel).toBe(100);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("returns 400 with CORS headers for invalid POST input", async () => {
    const result = await handler(
      baseEvent({ httpMethod: "POST", body: JSON.stringify({ name: "" }) })
    );

    expect(result.statusCode).toBe(400);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
    expect(JSON.parse(result.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown route", async () => {
    const result = await handler(baseEvent({ httpMethod: "PUT" }));

    expect(result.statusCode).toBe(404);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("returns 400 with CORS headers for a malformed JSON body", async () => {
    const result = await handler(
      baseEvent({ httpMethod: "POST", body: "{not valid json" })
    );

    expect(result.statusCode).toBe(400);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
    expect(JSON.parse(result.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for a JSON body that is not an object", async () => {
    const result = await handler(baseEvent({ httpMethod: "POST", body: "null" }));

    expect(result.statusCode).toBe(400);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBeDefined();
    expect(JSON.parse(result.body).error.code).toBe("VALIDATION_ERROR");
  });
});
