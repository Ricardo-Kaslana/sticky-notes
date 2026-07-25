import type { ColorKey } from "../lib/types";
import ColorSwatchRow from "./ColorSwatchRow";

interface ColorPickerProps {
  selected: ColorKey;
  onChange: (color: ColorKey) => void;
}

export default function ColorPicker(props: ColorPickerProps) {
  return (
    <div class="p-2 bg-panel rounded-md shadow-pop border border-line animate-fade-in">
      <ColorSwatchRow selected={props.selected} onSelect={props.onChange} />
    </div>
  );
}
