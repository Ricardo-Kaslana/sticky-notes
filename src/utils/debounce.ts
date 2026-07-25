export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  delayMs: number
): ((...args: Args) => void) & { cancel: () => void; flush: () => Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  const callable = (...args: Args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) void fn(...a);
    }, delayMs);
  };
  callable.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  callable.flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const a = lastArgs;
    lastArgs = null;
    if (a) await fn(...a);
  };
  return callable;
}
