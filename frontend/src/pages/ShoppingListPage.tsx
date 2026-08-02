import { useState } from "react";
import { Link } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { useUpdateSeasoning } from "../hooks/useUpdateSeasoning";
import { ApiError } from "../api/client";

export default function ShoppingListPage() {
  const { data, isLoading } = useSeasonings();
  const updateSeasoning = useUpdateSeasoning();
  const [error, setError] = useState<string | null>(null);

  const shoppingList = data?.filter((s) => s.needsPurchase) ?? [];

  async function handlePurchased(id: string) {
    setError(null);
    try {
      await updateSeasoning.mutateAsync({ id, patch: { needsPurchase: false, amountLevel: 100 } });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "更新に失敗しました。もう一度お試しください"
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">買い物リスト</h1>
        <Link to="/" className="text-sm underline">
          一覧へ
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {isLoading && <p className="text-center text-stone-500">読み込み中…</p>}

      {!isLoading && shoppingList.length === 0 && (
        <p className="py-8 text-center text-stone-500">買い物リストは空です</p>
      )}

      <ul className="flex flex-col gap-2">
        {shoppingList.map((seasoning) => (
          <li key={seasoning.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-stone-800">
            <input
              type="checkbox"
              onChange={() => handlePurchased(seasoning.id)}
              disabled={updateSeasoning.isPending}
              className="h-5 w-5"
              aria-label={`${seasoning.name} を購入済みにする`}
            />
            <span className="flex-1">{seasoning.name}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {seasoning.amountLevel === 0 ? "なし" : `${seasoning.amountLevel}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
