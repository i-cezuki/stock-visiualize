import { getCurrentIdToken } from "../auth/cognitoAuth";

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

interface ApiClientOptions {
  baseUrl: string;
  getIdToken: () => Promise<string | null>;
}

interface RequestOptions {
  method: string;
  body?: unknown;
}

export function createApiClient({ baseUrl, getIdToken }: ApiClientOptions) {
  async function request<T>(path: string, options: RequestOptions): Promise<T> {
    const idToken = await getIdToken();
    if (!idToken) {
      throw new ApiError(401, "UNAUTHORIZED", "not authenticated");
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${idToken}` };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const parsedBody = await response.json().catch(() => null);

    if (!response.ok) {
      const code = parsedBody?.error?.code ?? "UNKNOWN_ERROR";
      const message = parsedBody?.error?.message ?? response.statusText;
      throw new ApiError(response.status, code, message);
    }

    return parsedBody as T;
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: "GET" }),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
    patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
    delete: (path: string) => request<void>(path, { method: "DELETE" }),
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getIdToken: getCurrentIdToken,
});
