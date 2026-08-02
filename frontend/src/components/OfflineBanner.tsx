import { useOnlineStatus } from "../hooks/useOnlineStatus";

interface OfflineBannerProps {
  lastUpdated?: string;
}

export function OfflineBanner({ lastUpdated }: OfflineBannerProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="w-full bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      オフラインです{formattedTime ? `（最終更新: ${formattedTime}）` : ""}
    </div>
  );
}
