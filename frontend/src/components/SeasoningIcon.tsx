import { getSeasoningIconConfig } from "../lib/seasoningIcons";
import type { Category } from "../types/seasoning";

interface SeasoningIconProps {
  name: string;
  category: Category;
  className?: string;
}

export function SeasoningIcon({ name, category, className }: SeasoningIconProps) {
  const { shape, color, accent } = getSeasoningIconConfig(name, category);

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      data-testid="seasoning-icon"
      data-shape={shape}
    >
      {shape === "bottle" && (
        <>
          <rect x="10" y="1.5" width="4" height="3.5" rx="1" fill={accent} />
          <rect x="10.5" y="5" width="3" height="3" fill={color} />
          <path
            d="M7 9.5c0-.6.4-1 1-1h8c.6 0 1 .4 1 1V19a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V9.5z"
            fill={color}
          />
        </>
      )}
      {shape === "squeeze" && (
        <>
          <rect x="9" y="1.5" width="6" height="3" rx="1.5" fill={accent} />
          <path
            d="M8 4.5h8l1.2 3.3-1.2 2.2V19a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-9l-1.2-2.2L8 4.5z"
            fill={color}
          />
        </>
      )}
      {shape === "jar" && (
        <>
          <rect x="6" y="2.5" width="12" height="4" rx="1.2" fill={accent} />
          <rect x="7" y="6.5" width="10" height="14" rx="2" fill={color} />
        </>
      )}
      {shape === "shaker" && (
        <>
          <rect x="9" y="1.5" width="6" height="3" rx="1" fill={accent} />
          <circle cx="10.5" cy="3" r="0.45" fill="#3a3a3a" />
          <circle cx="12" cy="3" r="0.45" fill="#3a3a3a" />
          <circle cx="13.5" cy="3" r="0.45" fill="#3a3a3a" />
          <path d="M8 4.5h8V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V4.5z" fill={color} />
        </>
      )}
    </svg>
  );
}
