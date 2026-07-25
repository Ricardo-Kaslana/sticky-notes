interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div class="bg-white rounded-xl shadow-xl p-6 w-80 max-w-[90vw]">
        <p class="text-sm text-gray-700 mb-4">{props.message}</p>
        <div class="flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            class="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {props.cancelLabel ?? "取消"}
          </button>
          <button
            onClick={props.onConfirm}
            class="px-4 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
          >
            {props.confirmLabel ?? "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
