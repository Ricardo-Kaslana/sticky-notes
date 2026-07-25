import { createSignal } from "solid-js";
import { COLORS, type Settings, type ColorKey } from "../lib/types";

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
    <>
      <div class="fixed inset-0 z-40 bg-black/20" onClick={props.onCancel} />
      <div class="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-80">
        <h2 class="text-sm font-semibold text-gray-800 mb-4">设置</h2>

        <div class="mb-4">
          <label class="block text-xs text-gray-500 mb-1.5">新便签默认颜色</label>
          <div class="flex gap-2">
            {COLORS.map((c) => (
              <button
                onClick={() => setDefaultColor(c.key)}
                class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                classList={{
                  "border-gray-900": defaultColor() === c.key,
                  "border-transparent": defaultColor() !== c.key,
                }}
                style={{ background: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs text-gray-500 mb-1.5">自动保存间隔</label>
          <select
            value={autoSaveIntervalMs()}
            onChange={(e) => setAutoSaveIntervalMs(Number(e.currentTarget.value))}
            class="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-gray-400"
          >
            {INTERVALS.map((i) => (
              <option value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>

        <label class="flex items-center gap-2 mb-3 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={trayOnClose()}
            onChange={(e) => setTrayOnClose(e.currentTarget.checked)}
          />
          关闭主窗口时最小化到托盘
        </label>

        <label class="flex items-center gap-2 mb-5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={launchOnStartup()}
            onChange={(e) => setLaunchOnStartup(e.currentTarget.checked)}
          />
          开机自动启动
        </label>

        <div class="flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            class="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            class="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            保存
          </button>
        </div>
      </div>
    </>
  );
}
