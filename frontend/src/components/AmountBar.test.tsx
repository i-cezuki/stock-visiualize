import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AmountBar } from "./AmountBar";

describe("AmountBar", () => {
  it("renders the percentage and label for the given amount level", () => {
    render(<AmountBar amountLevel={75} color="#5B3714" />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("多い")).toBeInTheDocument();
  });

  it("sets the fill height proportional to the amount level", () => {
    render(<AmountBar amountLevel={50} color="#5B3714" />);

    const fill = screen.getByTestId("amount-bar-fill");
    expect(fill).toHaveStyle({ height: "50%" });
  });

  it("shows the empty label and 0% fill for amountLevel 0", () => {
    render(<AmountBar amountLevel={0} color="#5B3714" />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("なし")).toBeInTheDocument();
    expect(screen.getByTestId("amount-bar-fill")).toHaveStyle({ height: "0%" });
  });
});
