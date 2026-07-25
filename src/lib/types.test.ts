import { describe, expect, it } from "vitest";
import { COLORS, getColorDeepHex, getColorHex } from "./types";

describe("color palette", () => {
  it("every color has an unchanged base hex and a valid deep variant", () => {
    for (const c of COLORS) {
      expect(getColorHex(c.key)).toBe(c.hex);
      expect(c.deepHex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.deepHex).not.toBe(c.hex);
      expect(getColorDeepHex(c.key)).toBe(c.deepHex);
    }
  });

  it("falls back to paper deep hex for unknown keys", () => {
    expect(getColorDeepHex("nope" as never)).toBe("#e8d972");
  });
});
