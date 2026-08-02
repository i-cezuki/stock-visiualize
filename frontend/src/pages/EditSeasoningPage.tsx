import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { useUpdateSeasoning } from "../hooks/useUpdateSeasoning";
import { useDeleteSeasoning } from "../hooks/useDeleteSeasoning";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ApiError } from "../api/client";
import { CATEGORIES, type Category } from "../types/seasoning";

export default function EditSeasoningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: seasonings } = useSeasonings();
  const updateSeasoning = useUpdateSeasoning();
  const deleteSeasoning = useDeleteSeasoning();
  const isOnline = useOnlineStatus();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seasoning = seasonings?.find((s) => s.id === id);
  const [name, setName] = useState(seasoning?.name ?? "");
  const [category, setCategory] = useState<Category>(seasoning?.category ?? CATEGORIES[0]);

  if (!seasoning) {
    return <p className="text-center text-stone-500">読み込み中…</p>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await updateSeasoning.mutateAsync({ id: seasoning!.id, patch: { name, category } });
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "保存に失敗しました。もう一度お試しください"
      );
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteSeasoning.mutateAsync(seasoning!.id);
      navigate("/", { replace: true });
    } catch (err) {
      setShowConfirm(false);
      setError(
        err instanceof ApiError ? err.message : "削除に失敗しました。もう一度お試しください"
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">編集</h1>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!isOnline && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          オフラインです。保存・削除はオンライン時のみ行えます
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          maxLength={30}
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
          disabled={updateSeasoning.isPending || !isOnline}
          className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          保存
        </button>
      </form>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={!isOnline}
        className="rounded-xl border border-red-600 px-4 py-3 font-semibold text-red-600 disabled:opacity-50"
      >
        削除
      </button>

      {showConfirm && (
        <ConfirmDialog
          message={`「${seasoning.name}」を削除しますか？`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
