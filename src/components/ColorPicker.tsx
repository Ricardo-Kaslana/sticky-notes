import { COLORS, type ColorKey } from "../lib/types";

interface ColorPickerProps {
  selected: ColorKey;
  onChange: (color: ColorKey) => void;
}

export default function ColorPicker(props: ColorPickerProps) {
  return (
    <div class="flex gap-2 p-2 bg-white rounded-lg shadow-lg border border-gray-200">
      {COLORS.map((c) => (
        <button
          onClick={() => props.onChange(c.key)}
          class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
          classList={{
            "border-gray-900": props.selected === c.key,
            "border-transparent": props.selected !== c.key,
          }}
          style={{ background: c.hex }}
          title={c.name}
        />
      ))}
    </div>
  );
}
