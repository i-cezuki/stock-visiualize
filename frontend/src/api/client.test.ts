import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient, ApiError } from "./client";

const BASE_URL = "https://api.example.com/dev";

function makeClient(tokenGetter: () => Promise<string | null>) {
  return createApiClient({ baseUrl: BASE_URL, getIdToken: tokenGetter });
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("throws a 401 ApiError when there is no token", async () => {
    const client = makeClient(async () => null);

    await expect(client.get("/seasonings")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("attaches the Authorization header and returns parsed JSON on success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([{ id: "1" }]), { status: 200 })
    );
    const client = makeClient(async () => "id-token-123");

    const result = await client.get("/seasonings");

    expect(result).toEqual([{ id: "1" }]);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${BASE_URL}/seasonings`);
    expect(init.headers.Authorization).toBe("Bearer id-token-123");
  });

  it("sends a JSON Content-Type header and body for POST", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), { status: 201 })
    );
    const client = makeClient(async () => "id-token-123");

    await client.post("/seasonings", { name: "醤油", category: "液体" });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "醤油", category: "液体" }));
  });

  it("returns undefined for a 204 response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 204 }));
    const client = makeClient(async () => "id-token-123");

    const result = await client.delete("/seasonings/1");

    expect(result).toBeUndefined();
  });

  it("throws an ApiError with the server's code/message on a 4xx/5xx response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "name is required" } }),
        { status: 400 }
      )
    );
    const client = makeClient(async () => "id-token-123");

    await expect(client.post("/seasonings", { name: "" })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "name is required",
    });
  });
});
