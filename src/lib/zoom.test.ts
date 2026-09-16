import { describe, expect, it } from "vitest";
import {
  NOTE_ZOOM_DEFAULT,
  NOTE_ZOOM_MAX,
  NOTE_ZOOM_MIN,
  clampZoom,
  formatZoom,
  rootFontSizePx,
  stepZoom,
} from "./zoom";

describe("clampZoom", () => {
  it("keeps values inside the supported range", () => {
    expect(clampZoom(1.2)).toBe(1.2);
    expect(clampZoom(NOTE_ZOOM_MIN)).toBe(NOTE_ZOOM_MIN);
    expect(clampZoom(NOTE_ZOOM_MAX)).toBe(NOTE_ZOOM_MAX);
  });

  it("clamps out-of-range values", () => {
    expect(clampZoom(0.1)).toBe(NOTE_ZOOM_MIN);
    expect(clampZoom(99)).toBe(NOTE_ZOOM_MAX);
    expect(clampZoom(-1)).toBe(NOTE_ZOOM_MIN);
  });

  it("falls back to 100% for non-finite input", () => {
    // Any non-finite value means the stored setting is corrupt; reset to the
    // neutral 100% rather than guessing which end of the range was meant.
    expect(clampZoom(NaN)).toBe(NOTE_ZOOM_DEFAULT);
    expect(clampZoom(Infinity)).toBe(NOTE_ZOOM_DEFAULT);
    expect(clampZoom(-Infinity)).toBe(NOTE_ZOOM_DEFAULT);
  });
});

describe("stepZoom", () => {
  it("walks up through the discrete stops", () => {
    expect(stepZoom(1, 1)).toBe(1.15);
    expect(stepZoom(1.15, 1)).toBe(1.3);
    expect(stepZoom(1.3, 1)).toBe(1.5);
  });

  it("walks down through the discrete stops", () => {
    expect(stepZoom(1, -1)).toBe(0.85);
    expect(stepZoom(0.85, -1)).toBe(0.75);
  });

  it("snaps an off-stop value to the next stop in the given direction", () => {
    expect(stepZoom(1.05, 1)).toBe(1.15);
    expect(stepZoom(1.05, -1)).toBe(1);
  });

  it("saturates at the ends instead of overshooting", () => {
    expect(stepZoom(NOTE_ZOOM_MAX, 1)).toBe(NOTE_ZOOM_MAX);
    expect(stepZoom(NOTE_ZOOM_MIN, -1)).toBe(NOTE_ZOOM_MIN);
  });

  it("returns the current value for dir 0", () => {
    expect(stepZoom(1.3, 0)).toBe(1.3);
  });
});

describe("formatZoom", () => {
  it("renders whole percentages", () => {
    expect(formatZoom(1)).toBe("100%");
    expect(formatZoom(1.15)).toBe("115%");
    expect(formatZoom(0.75)).toBe("75%");
  });

  it("clamps before formatting", () => {
    expect(formatZoom(5)).toBe("200%");
  });
});

describe("rootFontSizePx", () => {
  it("scales the 16px baseline", () => {
    expect(rootFontSizePx(1)).toBe(16);
    expect(rootFontSizePx(1.5)).toBe(24);
    expect(rootFontSizePx(0.75)).toBe(12);
  });
});
