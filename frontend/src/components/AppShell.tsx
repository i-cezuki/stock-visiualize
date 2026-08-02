import { Outlet } from "react-router-dom";
import { OfflineBanner } from "./OfflineBanner";
import { useSeasonings } from "../hooks/useSeasonings";

export function AppShell() {
  // Same query key as every page's own useSeasonings() call, so this reads
  // the shared cache rather than triggering a second fetch -- it exists
  // here only to surface "when was this data last refreshed" in the banner.
  const { dataUpdatedAt } = useSeasonings();

  return (
    <div className="min-h-screen bg-[#F5EFE6] text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <OfflineBanner
        lastUpdated={dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toISOString() : undefined}
      />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
