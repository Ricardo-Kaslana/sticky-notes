import { For } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * `ResizeDirection` is declared in @tauri-apps/api/window but not exported,
 * so mirror the union here. The strings must stay byte-identical to the
 * Rust enum variants — a typo is a silent no-op, not a build error.
 */
type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

interface Handle {
  dir: ResizeDirection;
  /** Hit area. Edges are thin strips; corners are square-ish and on top. */
  class: string;
}

// Corners come after the edges so they win the overlap at each corner.
const HANDLES: Handle[] = [
  { dir: "North", class: "top-0 left-3 right-3 h-1.5 cursor-n-resize" },
  { dir: "South", class: "bottom-0 left-3 right-3 h-1.5 cursor-s-resize" },
  { dir: "West", class: "left-0 top-3 bottom-3 w-1.5 cursor-w-resize" },
  { dir: "East", class: "right-0 top-3 bottom-3 w-1.5 cursor-e-resize" },
  { dir: "NorthWest", class: "top-0 left-0 w-3 h-3 cursor-nwse-resize" },
  { dir: "NorthEast", class: "top-0 right-0 w-3 h-3 cursor-nesw-resize" },
  { dir: "SouthWest", class: "bottom-0 left-0 w-3 h-3 cursor-nesw-resize" },
  { dir: "SouthEast", class: "bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize" },
];

/**
 * Drag-to-resize for the borderless note window.
 *
 * A `decorations(false)` window has no visible frame, so on Windows the
 * native resize borders are a few pixels of nothing — users cannot find
 * them. These handles hand the drag to the OS via `startResizeDragging`,
 * which gives real window resizing (including snapping) instead of a
 * JS-computed rect. Requires `core:window:allow-start-resize-dragging`.
 */
export default function ResizeHandles() {
  const start = (dir: ResizeDirection) => (e: MouseEvent) => {
    if (e.button !== 0) return;
    // Keep the click away from the header's drag region and from any
    // parent handler that would otherwise steal focus.
    e.preventDefault();
    e.stopPropagation();
    void getCurrentWindow()
      .startResizeDragging(dir)
      .catch((err) =>
        console.error(`[ResizeHandles] startResizeDragging(${dir}) failed:`, err)
      );
  };

  return (
    <>
      <For each={HANDLES}>
        {(h) => (
          <div
            class={`absolute z-20 ${h.class}`}
            onMouseDown={start(h.dir)}
            aria-hidden="true"
          />
        )}
      </For>
      {/* Visible affordance for the corner that actually gets used. */}
      <div class="absolute bottom-0 right-0 z-30 w-3.5 h-3.5 pointer-events-none flex items-end justify-end p-0.5">
        <svg
          viewBox="0 0 10 10"
          fill="none"
          class="w-[0.5625rem] h-[0.5625rem] text-ink/35"
          aria-hidden="true"
        >
          <path
            d="M9 1.5 L1.5 9 M9 5.5 L5.5 9"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
      </div>
    </>
  );
}
