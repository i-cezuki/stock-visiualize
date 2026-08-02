import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { useUpdateSeasoning } from "../hooks/useUpdateSeasoning";
import { useDeleteSeasoning } from "../hooks/useDeleteSeasoning";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CATEGORIES, type Category } from "../types/seasoning";

export default function EditSeasoningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: seasonings } = useSeasonings();
  const updateSeasoning = useUpdateSeasoning();
  const deleteSeasoning = useDeleteSeasoning();
  const [showConfirm, setShowConfirm] = useState(false);

  const seasoning = seasonings?.find((s) => s.id === id);
  const [name, setName] = useState(seasoning?.name ?? "");
  const [category, setCategory] = useState<Category>(seasoning?.category ?? CATEGORIES[0]);

  if (!seasoning) {
    return <p className="text-center text-stone-500">読み込み中…</p>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await updateSeasoning.mutateAsync({ id: seasoning!.id, patch: { name, category } });
    navigate("/", { replace: true });
  }

  async function handleDelete() {
    await deleteSeasoning.mutateAsync(seasoning!.id);
    navigate("/", { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">編集</h1>
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
          disabled={updateSeasoning.isPending}
          className="rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          保存
        </button>
      </form>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-xl border border-red-600 px-4 py-3 font-semibold text-red-600"
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
