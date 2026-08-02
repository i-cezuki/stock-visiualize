import { AMOUNT_LEVEL_LABELS, type AmountLevel } from "../types/seasoning";

interface AmountBarProps {
  amountLevel: AmountLevel;
  color: string;
}

export function AmountBar({ amountLevel, color }: AmountBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-16 w-6 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div
          data-testid="amount-bar-fill"
          className="absolute bottom-0 left-0 w-full transition-all duration-500 ease-out"
          style={{ height: `${amountLevel}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tabular-nums">{amountLevel}%</span>
        <span className="text-xs text-stone-500 dark:text-stone-400">
          {AMOUNT_LEVEL_LABELS[amountLevel]}
        </span>
      </div>
    </div>
  );
}
