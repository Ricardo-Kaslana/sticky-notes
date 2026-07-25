import { COLORS, type ColorKey } from "../lib/types";

interface ColorSwatchRowProps {
  selected: ColorKey;
  onSelect: (c: ColorKey) => void;
}

export default function ColorSwatchRow(props: ColorSwatchRowProps) {
  return (
    <div class="flex gap-2">
      {COLORS.map((c) => (
        <button
          onClick={() => props.onSelect(c.key)}
          class="w-5 h-5 rounded-full border transition-transform hover:scale-110"
          classList={{ "ring-2 ring-ink ring-offset-1": props.selected === c.key }}
          style={{ background: c.hex, "border-color": c.deepHex }}
          title={c.name}
          aria-label={c.name}
        />
      ))}
    </div>
  );
}
