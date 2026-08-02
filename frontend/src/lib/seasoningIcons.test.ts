import { describe, it, expect } from "vitest";
import { getSeasoningIconConfig } from "./seasoningIcons";

describe("getSeasoningIconConfig", () => {
  it("gives ketchup and mayonnaise distinct squeeze-bottle colors", () => {
    const ketchup = getSeasoningIconConfig("ケチャップ", "チューブ");
    const mayo = getSeasoningIconConfig("マヨネーズ", "チューブ");

    expect(ketchup.shape).toBe("squeeze");
    expect(mayo.shape).toBe("squeeze");
    expect(ketchup.color).not.toBe(mayo.color);
  });

  it("falls back to the category's jar look for an unlisted name in 瓶", () => {
    const config = getSeasoningIconConfig("自家製だれ", "瓶");
    expect(config.shape).toBe("jar");
  });

  it("falls back to the category's bottle look for an unlisted name in 液体", () => {
    const config = getSeasoningIconConfig("謎の調味料", "液体");
    expect(config.shape).toBe("bottle");
  });
});
