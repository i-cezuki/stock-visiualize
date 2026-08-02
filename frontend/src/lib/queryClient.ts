import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ApiError } from "../api/client";
import { logout } from "../auth/cognitoAuth";

function handleAuthError(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 401) {
    logout();
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.statusCode === 401) && failureCount < 1,
    },
  },
  queryCache: new QueryCache({ onError: handleAuthError }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
});

// Bump this whenever the persisted Seasoning shape changes, so a long-offline
// user's stale-shaped cache is discarded instead of feeding old data into new
// components before the first successful refetch overwrites it.
const CACHE_VERSION = "v1";

if (typeof window !== "undefined") {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "seasoning-stock-cache",
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: Infinity,
    buster: CACHE_VERSION,
  });
}
