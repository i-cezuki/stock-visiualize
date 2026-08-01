import { describe, it, expect } from "vitest";
import { getCategoryDefaults } from "./categoryDefaults";

describe("getCategoryDefaults", () => {
  it("returns an icon and HEX color for every category", () => {
    const categories = ["液体", "チューブ", "瓶", "粉", "スパイス"] as const;
    for (const category of categories) {
      const defaults = getCategoryDefaults(category);
      expect(defaults.icon).toEqual(expect.any(String));
      expect(defaults.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("returns the documented default for 液体", () => {
    expect(getCategoryDefaults("液体")).toEqual({ icon: "liquid", color: "#5B3714" });
  });
});
