import type { APIGatewayProxyEvent } from "aws-lambda";
import { unauthorized } from "../errors/apiError";

export function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims as
    | Record<string, string>
    | undefined;
  const sub = claims?.sub;

  if (!sub) {
    throw unauthorized("missing or invalid authentication");
  }

  return sub;
}
