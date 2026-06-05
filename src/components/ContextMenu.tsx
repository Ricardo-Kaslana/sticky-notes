import { createSignal, Show, For, createEffect, onCleanup } from "solid-js";

interface MenuItem {
  label: string;
  danger?: boolean;
  action: () => void;
}

export function useContextMenu() {
  const [show, setShow] = createSignal(false);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [items, setItems] = createSignal<MenuItem[]>([]);

  const open = (x: number, y: number, menuItems: MenuItem[]) => {
    setPosition({ x, y });
    setItems(menuItems);
    setShow(true);
  };

  const close = () => setShow(false);

  return { open, close, show, position, items };
}

interface ContextMenuProps {
  show: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu(props: ContextMenuProps) {
  let ref: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) {
      props.onClose();
    }
  };

  createEffect(() => {
    if (props.show) {
      document.addEventListener("click", handleClickOutside);
      onCleanup(() => document.removeEventListener("click", handleClickOutside));
    }
  });

  return (
    <Show when={props.show}>
      <div
        ref={ref}
        class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-36 text-sm"
        style={{ left: `${props.x}px`, top: `${props.y}px` }}
      >
        <For each={props.items}>
          {(item, i) => (
            <>
              {item.label === "---" ? (
                <div class="border-t border-gray-100 my-0.5" />
              ) : (
                <button
                  class="w-full text-left px-3 py-1.5 hover:bg-gray-50"
                  classList={{
                    "text-red-600 hover:bg-red-50": item.danger,
                    "text-gray-700": !item.danger,
                  }}
                  onClick={() => { item.action(); props.onClose(); }}
                >
                  {item.label}
                </button>
              )}
            </>
          )}
        </For>
      </div>
    </Show>
  );
}
