import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateSeasoning } from "../hooks/useCreateSeasoning";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { ApiError } from "../api/client";
import { CATEGORIES, type Category } from "../types/seasoning";

export default function AddSeasoningPage() {
  const navigate = useNavigate();
  const createSeasoning = useCreateSeasoning();
  const isOnline = useOnlineStatus();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createSeasoning.mutateAsync({ name, category });
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "追加に失敗しました。入力内容を確認してください"
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">調味料を追加</h1>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!isOnline && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          オフラインです。追加はオンライン時のみ行えます
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          maxLength={30}
          placeholder="名前（例: 醤油）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-xl border border-stone-300 px-4 py-3 dark:border-stone-600 dark:bg-stone-800"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={createSeasoning.isPending || !isOnline}
          className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          追加
        </button>
      </form>
    </div>
  );
}
