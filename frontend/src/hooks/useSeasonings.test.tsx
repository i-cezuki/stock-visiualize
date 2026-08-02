import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSeasonings } from "./useSeasonings";
import { seasoningsApi } from "../api/seasonings";
import type { Seasoning } from "../types/seasoning";
import { logout } from "../auth/cognitoAuth";
import { ApiError } from "../api/client";
import { queryClient } from "../lib/queryClient";

vi.mock("../api/seasonings", () => ({
  seasoningsApi: { list: vi.fn() },
}));

vi.mock("../auth/cognitoAuth", () => ({
  logout: vi.fn(),
  getCurrentIdToken: vi.fn(async () => null),
}));

const sample: Seasoning = {
  id: "1",
  name: "醤油",
  category: "液体",
  icon: "liquid",
  color: "#5B3714",
  amountLevel: 75,
  needsPurchase: false,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSeasonings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and returns the seasoning list", async () => {
    (seasoningsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([sample]);

    const { result } = renderHook(() => useSeasonings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
  });

  it("logs out and redirects when a query fails with a 401 ApiError", async () => {
    (seasoningsApi.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(401, "UNAUTHORIZED", "not authenticated")
    );
    const originalLocation = window.location;
    // @ts-expect-error -- test-only override of window.location for assertion purposes
    delete window.location;
    // @ts-expect-error -- window.location's setter type is `string`; we deliberately assign an object
    window.location = { ...originalLocation, pathname: "/", assign: vi.fn() } as unknown as Location;

    queryClient
      .fetchQuery({ queryKey: ["seasonings"], queryFn: seasoningsApi.list, retry: false })
      .catch(() => {});

    await vi.waitFor(
      () => {
        expect(logout).toHaveBeenCalled();
        expect(window.location.assign).toHaveBeenCalledWith("/login");
      },
      { timeout: 3000 }
    );

    // @ts-expect-error -- restoring window.location after the test-only override above
    window.location = originalLocation;
    queryClient.clear();
  });
});
