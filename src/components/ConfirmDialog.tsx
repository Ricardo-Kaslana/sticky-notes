// Deep import: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import Trash2 from "lucide-solid/icons/trash-2";

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div class="bg-panel rounded-lg shadow-modal border border-line p-5 w-80 max-w-[90vw] animate-scale-in">
        <p class="text-sm text-ink mb-4">{props.message}</p>
        <div class="flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            class="px-4 py-1.5 text-sm text-ink-muted hover:bg-neutral-100 rounded-sm transition-colors"
          >
            {props.cancelLabel ?? "取消"}
          </button>
          <button
            onClick={props.onConfirm}
            class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded-sm transition-colors"
          >
            <Trash2 size={14} />
            {props.confirmLabel ?? "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
