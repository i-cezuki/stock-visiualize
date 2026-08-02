import { Link, useNavigate } from "react-router-dom";
import { useSeasonings } from "../hooks/useSeasonings";
import { SeasoningCard } from "../components/SeasoningCard";
import type { Seasoning } from "../types/seasoning";

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useSeasonings();
  const navigate = useNavigate();

  function handleCardClick(seasoning: Seasoning) {
    navigate(`/seasonings/${seasoning.id}/amount`);
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">調味料</h1>
        <Link to="/shopping-list" className="text-sm underline">
          買い物リスト
        </Link>
      </div>

      {isLoading && <p className="text-center text-stone-500">読み込み中…</p>}

      {isError && (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-stone-500">読み込みに失敗しました</p>
          <button onClick={() => refetch()} className="rounded-xl bg-stone-800 px-4 py-2 text-white dark:bg-stone-100 dark:text-stone-900">
            再試行
          </button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-stone-500">調味料がまだありません。追加しましょう</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((seasoning) => (
            <SeasoningCard key={seasoning.id} seasoning={seasoning} onClick={handleCardClick} />
          ))}
        </div>
      )}

      <Link
        to="/seasonings/new"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-stone-800 text-2xl text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        aria-label="調味料を追加"
      >
        +
      </Link>
    </div>
  );
}
