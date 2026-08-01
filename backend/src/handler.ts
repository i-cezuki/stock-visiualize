import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SeasoningRepository } from "./repository/seasoningRepository";
import { SeasoningService } from "./services/seasoningService";
import { getUserId } from "./auth/getUserId";
import { ApiError } from "./errors/apiError";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const repository = new SeasoningRepository(dynamoClient);
const service = new SeasoningService(repository);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  };
}

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function noBody(statusCode: number): APIGatewayProxyResult {
  return { statusCode, headers: corsHeaders(), body: "" };
}

function errorResponse(error: unknown): APIGatewayProxyResult {
  if (error instanceof ApiError) {
    return json(error.statusCode, { error: { code: error.code, message: error.message } });
  }
  console.error(error);
  return json(500, {
    error: { code: "INTERNAL_ERROR", message: "internal server error" },
  });
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === "OPTIONS") {
    return noBody(200);
  }

  try {
    const userId = getUserId(event);
    const id = event.pathParameters?.id;

    if (event.httpMethod === "GET" && !id) {
      const items = await service.list(userId);
      return json(200, items);
    }

    if (event.httpMethod === "POST" && !id) {
      const input = JSON.parse(event.body ?? "{}");
      const created = await service.create(userId, input);
      return json(201, created);
    }

    if (event.httpMethod === "PATCH" && id) {
      const patch = JSON.parse(event.body ?? "{}");
      const updated = await service.update(userId, id, patch);
      return json(200, updated);
    }

    if (event.httpMethod === "DELETE" && id) {
      await service.delete(userId, id);
      return noBody(204);
    }

    return json(404, { error: { code: "NOT_FOUND", message: "route not found" } });
  } catch (error) {
    return errorResponse(error);
  }
}
