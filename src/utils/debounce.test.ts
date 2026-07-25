import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the function once after the delay", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel drops the pending call", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("flush runs the pending call immediately and awaits async completion", async () => {
    let completed = false;
    const d = debounce(async () => {
      await Promise.resolve();
      completed = true;
    }, 100);
    d();
    await d.flush();
    expect(completed).toBe(true);
    vi.advanceTimersByTime(200);
  });

  it("flush is a no-op when nothing is pending", async () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    await d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not fire again after flush", async () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    await d.flush();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
