import { describe, it, expect } from "vitest";
import { pastedFilename } from "./pastedFilename";

describe("pastedFilename", () => {
  it("png ends with .png and starts with pasted-", () => {
    const name = pastedFilename("image/png", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.startsWith("pasted-")).toBe(true);
    expect(name.endsWith(".png")).toBe(true);
  });

  it("jpeg becomes .jpg", () => {
    const name = pastedFilename("image/jpeg", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".jpg")).toBe(true);
  });

  it("webp stays .webp", () => {
    const name = pastedFilename("image/webp", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".webp")).toBe(true);
  });

  it("svg becomes .svg", () => {
    const name = pastedFilename("image/svg+xml", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".svg")).toBe(true);
  });

  it("unknown mime falls back to .bin", () => {
    const name = pastedFilename("application/octet-stream", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".bin")).toBe(true);
  });

  it("uses the injected Date for the timestamp", () => {
    const name = pastedFilename("image/png", new Date("2026-07-15T10:30:00.000Z"));
    // ISO 8601 with colons replaced by hyphens; the millisecond dot is kept.
    expect(name).toContain("2026-07-15T10-30-00.000Z");
  });

  it("replaces colons in the timestamp with hyphens", () => {
    const name = pastedFilename("image/png", new Date("2026-07-15T10:30:00.000Z"));
    expect(name).not.toContain(":");
    expect(name).toContain("T10-30-00");
  });
});
