export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string): ApiError =>
  new ApiError(400, "VALIDATION_ERROR", message);

export const notFound = (message: string): ApiError =>
  new ApiError(404, "NOT_FOUND", message);

export const conflict = (message: string): ApiError =>
  new ApiError(409, "CONFLICT", message);

export const unauthorized = (message: string): ApiError =>
  new ApiError(401, "UNAUTHORIZED", message);
