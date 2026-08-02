import { Outlet } from "react-router-dom";
import { OfflineBanner } from "./OfflineBanner";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5EFE6] text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <OfflineBanner />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
