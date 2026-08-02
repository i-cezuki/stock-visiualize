import { useNavigate, useParams, Link } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { useUpdateSeasoning } from "../hooks/useUpdateSeasoning";
import { AMOUNT_LEVELS, AMOUNT_LEVEL_LABELS, type AmountLevel } from "../types/seasoning";

export default function AmountChangePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: seasonings } = useSeasonings();
  const updateSeasoning = useUpdateSeasoning();

  const seasoning = seasonings?.find((s) => s.id === id);

  if (!seasoning) {
    return <p className="text-center text-stone-500">読み込み中…</p>;
  }

  async function handleSelect(amountLevel: AmountLevel) {
    await updateSeasoning.mutateAsync({ id: seasoning!.id, patch: { amountLevel } });
    navigate("/", { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{seasoning.name}</h1>
      <div className="flex flex-col gap-2">
        {AMOUNT_LEVELS.slice()
          .reverse()
          .map((level) => (
            <button
              key={level}
              onClick={() => handleSelect(level)}
              disabled={updateSeasoning.isPending}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${
                seasoning.amountLevel === level
                  ? "border-stone-800 bg-stone-100 dark:border-stone-100 dark:bg-stone-800"
                  : "border-stone-300 dark:border-stone-600"
              }`}
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: seasoning.amountLevel === level ? seasoning.color : "transparent", border: `2px solid ${seasoning.color}` }}
              />
              {AMOUNT_LEVEL_LABELS[level]}
            </button>
          ))}
      </div>
      <Link to={`/seasonings/${seasoning.id}/edit`} className="text-center text-sm text-stone-500 underline dark:text-stone-400">
        編集・削除
      </Link>
    </div>
  );
}
