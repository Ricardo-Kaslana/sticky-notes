import Minus from "lucide-solid/icons/minus";
import Plus from "lucide-solid/icons/plus";
import { formatZoom } from "../lib/zoom";

interface ZoomControlProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

/**
 * Font/content scale for the note window. Resizing the window is a different
 * gesture (see ResizeHandles) — this one keeps the window put and makes the
 * content readable.
 */
export default function ZoomControl(props: ZoomControlProps) {
  const btnClass =
    "w-5 h-5 flex items-center justify-center rounded-sm text-ink/55 hover:text-ink hover:bg-black/5 transition-colors";

  return (
    <div class="flex items-center gap-0.5 rounded-sm border border-black/10 bg-white/45 px-0.5 py-px mr-1.5">
      <button
        onClick={props.onZoomOut}
        class={btnClass}
        title="缩小 (Ctrl+-)"
        aria-label="缩小"
      >
        <Minus class="w-3 h-3" />
      </button>
      <button
        onClick={props.onZoomReset}
        class="min-w-9 px-0.5 h-5 text-[0.625rem] tabular-nums text-ink/60 hover:text-ink rounded-sm hover:bg-black/5 transition-colors"
        title="重置为 100% (Ctrl+0)"
        aria-label="重置缩放"
      >
        {formatZoom(props.zoom)}
      </button>
      <button
        onClick={props.onZoomIn}
        class={btnClass}
        title="放大 (Ctrl+=)"
        aria-label="放大"
      >
        <Plus class="w-3 h-3" />
      </button>
    </div>
  );
}
