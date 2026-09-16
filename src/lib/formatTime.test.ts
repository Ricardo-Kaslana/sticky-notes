import { describe, expect, it } from "vitest";
import { formatDateTime } from "./formatTime";

/** Built from local components so the expectation holds in any timezone. */
const local = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe("formatDateTime", () => {
  it("formats an RFC3339 string as local YYYY-MM-DD HH:mm", () => {
    expect(formatDateTime(local(2026, 9, 17, 0, 34))).toBe("2026-09-17 00:34");
  });

  it("zero-pads month, day, hour and minute", () => {
    expect(formatDateTime(local(2026, 1, 2, 3, 4))).toBe("2026-01-02 03:04");
  });

  it("accepts both Rust (+00:00) and JS (Z) UTC spellings", () => {
    const z = "2026-09-17T00:34:00Z";
    const offset = "2026-09-17T00:34:00+00:00";
    expect(formatDateTime(z)).toBe(formatDateTime(offset));
  });

  it("uses 24-hour clock with midnight as 00:00", () => {
    expect(formatDateTime(local(2026, 9, 17, 0, 0))).toContain("00:00");
    expect(formatDateTime(local(2026, 9, 17, 13, 5))).toContain("13:05");
  });

  it("returns an empty string for missing or unparseable input", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("not a date")).toBe("");
  });
});
