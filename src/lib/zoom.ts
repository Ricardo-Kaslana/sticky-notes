/**
 * Note-window zoom. Applied by scaling the document root font size, which
 * cascades through every rem-based Tailwind utility — so text, padding and
 * icon sizes grow together instead of text alone overflowing its box.
 */
export const NOTE_ZOOM_MIN = 0.75;
export const NOTE_ZOOM_MAX = 2;
export const NOTE_ZOOM_DEFAULT = 1;

/** Root font size in px that zoom 1 maps to (matches the browser default). */
export const BASE_FONT_SIZE_PX = 16;

/** Discrete stops so repeated Ctrl+= lands on predictable, readable sizes. */
export const NOTE_ZOOM_STEPS: readonly number[] = [0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return NOTE_ZOOM_DEFAULT;
  return Math.min(NOTE_ZOOM_MAX, Math.max(NOTE_ZOOM_MIN, value));
}

/**
 * Nearest zoom stop in `dir` (+1 = larger, -1 = smaller). Returns the current
 * clamped value when already at the end of the range, so the caller can skip
 * a redundant write.
 */
export function stepZoom(current: number, dir: number): number {
  const c = clampZoom(current);
  const epsilon = 1e-6;
  if (dir > 0) {
    return NOTE_ZOOM_STEPS.find((s) => s > c + epsilon) ?? NOTE_ZOOM_MAX;
  }
  if (dir < 0) {
    const lower = [...NOTE_ZOOM_STEPS].reverse().find((s) => s < c - epsilon);
    return lower ?? NOTE_ZOOM_MIN;
  }
  return c;
}

export function formatZoom(zoom: number): string {
  return `${Math.round(clampZoom(zoom) * 100)}%`;
}

/** Root font size in px for a zoom factor. */
export function rootFontSizePx(zoom: number): number {
  return Math.round(BASE_FONT_SIZE_PX * clampZoom(zoom));
}
