import { createSignal } from "solid-js";
// Deep import: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import ChevronDown from "lucide-solid/icons/chevron-down";
import { type Settings, type ColorKey } from "../lib/types";
import ColorSwatchRow from "./ColorSwatchRow";

interface SettingsDialogProps {
  settings: Settings;
  onSave: (next: Settings) => void;
  onCancel: () => void;
}

const INTERVALS = [
  { value: 1000, label: "1 秒" },
  { value: 2000, label: "2 秒" },
  { value: 5000, label: "5 秒" },
  { value: 10000, label: "10 秒" },
];

function Toggle(props: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      class="relative w-8 h-[18px] rounded-full transition-colors shrink-0"
      classList={{
        "bg-ink": props.checked,
        "bg-neutral-300": !props.checked,
      }}
    >
      <span
        class="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform"
        classList={{ "translate-x-3.5": props.checked }}
      />
    </button>
  );
}

export default function SettingsDialog(props: SettingsDialogProps) {
  const [defaultColor, setDefaultColor] = createSignal<ColorKey>(
    props.settings.defaultColor
  );
  const [autoSaveIntervalMs, setAutoSaveIntervalMs] = createSignal(
    props.settings.autoSaveIntervalMs
  );
  const [trayOnClose, setTrayOnClose] = createSignal(props.settings.trayOnClose);
  const [launchOnStartup, setLaunchOnStartup] = createSignal(
    props.settings.launchOnStartup
  );

  const handleSave = () => {
    props.onSave({
      ...props.settings,
      defaultColor: defaultColor(),
      autoSaveIntervalMs: autoSaveIntervalMs(),
      trayOnClose: trayOnClose(),
      launchOnStartup: launchOnStartup(),
    });
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/25"
      onClick={props.onCancel}
    >
      <div
        class="bg-panel rounded-lg shadow-modal border border-line p-5 w-80 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 class="text-sm font-semibold text-ink mb-4">设置</h2>

        <div class="mb-4">
          <label class="block text-xs text-ink-muted mb-1.5">新便签默认颜色</label>
          <ColorSwatchRow selected={defaultColor()} onSelect={setDefaultColor} />
        </div>

        <div class="mb-4">
          <label class="block text-xs text-ink-muted mb-1.5">自动保存间隔</label>
          <div class="relative">
            <select
              value={autoSaveIntervalMs()}
              onChange={(e) => setAutoSaveIntervalMs(Number(e.currentTarget.value))}
              class="appearance-none w-full px-2.5 py-1.5 pr-8 text-sm border border-line rounded-sm bg-surface focus:outline-none focus:border-neutral-400 transition-colors"
            >
              {INTERVALS.map((i) => (
                <option value={i.value}>{i.label}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            />
          </div>
        </div>

        <label class="flex items-center justify-between gap-2 mb-3 text-sm text-ink cursor-pointer">
          关闭主窗口时最小化到托盘
          <Toggle checked={trayOnClose()} onChange={setTrayOnClose} />
        </label>

        <label class="flex items-center justify-between gap-2 mb-5 text-sm text-ink cursor-pointer">
          开机自动启动
          <Toggle checked={launchOnStartup()} onChange={setLaunchOnStartup} />
        </label>

        <div class="flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            class="px-3 py-1.5 text-sm text-ink-muted rounded-sm hover:bg-neutral-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            class="px-3 py-1.5 text-sm bg-ink text-white rounded-sm hover:bg-neutral-800 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
