import { AmountBar } from "./AmountBar";
import { CATEGORY_EMOJI, type Seasoning } from "../types/seasoning";

interface SeasoningCardProps {
  seasoning: Seasoning;
  onClick: (seasoning: Seasoning) => void;
}

export function SeasoningCard({ seasoning, onClick }: SeasoningCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(seasoning)}
      aria-label={
        seasoning.needsPurchase
          ? `${seasoning.name}（買い物リストに追加済み）`
          : seasoning.name
      }
      className="relative flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 transition hover:shadow-md active:scale-[0.98] dark:bg-stone-800 dark:ring-stone-700"
    >
      {seasoning.needsPurchase && (
        <span aria-hidden="true" className="absolute right-2 top-2 text-lg">
          🛒
        </span>
      )}
      <span className="text-3xl">{CATEGORY_EMOJI[seasoning.category]}</span>
      <span className="font-semibold text-stone-800 dark:text-stone-100">{seasoning.name}</span>
      <AmountBar amountLevel={seasoning.amountLevel} color={seasoning.color} />
    </button>
  );
}
