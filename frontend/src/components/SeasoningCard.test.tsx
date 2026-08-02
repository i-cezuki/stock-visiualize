import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasoningCard } from "./SeasoningCard";
import type { Seasoning } from "../types/seasoning";

const sample: Seasoning = {
  id: "1",
  name: "醤油",
  category: "液体",
  icon: "liquid",
  color: "#5B3714",
  amountLevel: 75,
  needsPurchase: false,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("SeasoningCard", () => {
  it("renders the name, category emoji, and amount", () => {
    render(<SeasoningCard seasoning={sample} onClick={() => {}} />);

    expect(screen.getByText("醤油")).toBeInTheDocument();
    expect(screen.getByText("🧴")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("announces shopping-list status in the card's accessible name only when needsPurchase is true", () => {
    const { rerender } = render(<SeasoningCard seasoning={sample} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "醤油" })).toBeInTheDocument();

    rerender(<SeasoningCard seasoning={{ ...sample, needsPurchase: true }} onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: "醤油（買い物リストに追加済み）" })
    ).toBeInTheDocument();
  });

  it("calls onClick when the card is tapped", async () => {
    const onClick = vi.fn();
    render(<SeasoningCard seasoning={sample} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: /醤油/ }));

    expect(onClick).toHaveBeenCalledWith(sample);
  });
});
