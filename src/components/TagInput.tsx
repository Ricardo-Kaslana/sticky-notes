import { createSignal, createMemo, Show, For } from "solid-js";
// Deep import: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import X from "lucide-solid/icons/x";
import { notes } from "../stores/notesStore";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput(props: TagInputProps) {
  const [input, setInput] = createSignal("");
  const [showSuggestions, setShowSuggestions] = createSignal(false);

  const allTags = createMemo(() => {
    const tagSet = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags) {
        tagSet.add(tag.toLowerCase());
      }
    }
    return Array.from(tagSet).sort();
  });

  const suggestions = createMemo(() => {
    const q = input().toLowerCase().trim();
    if (!q) return [];
    return allTags()
      .filter(
        (t) =>
          t.includes(q) &&
          !props.tags.some((existing) => existing.toLowerCase() === t)
      )
      .slice(0, 5);
  });

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    // Deduplicate case-insensitive
    if (props.tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput("");
      setShowSuggestions(false);
      return;
    }
    props.onChange([...props.tags, trimmed]);
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    props.onChange(props.tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && input().trim()) {
      e.preventDefault();
      const suggestion = suggestions()[0];
      if (suggestion) {
        addTag(suggestion);
      } else {
        addTag(input());
      }
    } else if (e.key === "Backspace" && !input() && props.tags.length > 0) {
      removeTag(props.tags.length - 1);
    }
  };

  return (
    <div class="relative">
      <div class="flex flex-wrap gap-1 mb-1">
        <For each={props.tags}>
          {(tag, i) => (
            <span class="inline-flex items-center gap-1 text-xs bg-black/10 text-ink-muted px-2 py-0.5 rounded-full">
              {tag}
              <button
                onClick={() => removeTag(i())}
                class="text-ink/40 hover:text-ink transition-colors"
                aria-label={`删除标签 ${tag}`}
              >
                <X class="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </For>
      </div>
      <div class="relative">
        <input
          type="text"
          value={input()}
          onInput={(e) => {
            setInput(e.currentTarget.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="+ add tag"
          class="text-xs text-ink placeholder:text-black/30 outline-none bg-transparent w-full"
        />
        <Show when={showSuggestions() && suggestions().length > 0}>
          <div class="absolute bottom-full left-0 mb-1 bg-panel border border-line rounded-md shadow-pop py-1 min-w-36 z-50 animate-fade-in">
            <For each={suggestions()}>
              {(s) => (
                <button
                  class="w-full text-left px-3 py-1 text-xs text-ink hover:bg-neutral-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(s);
                  }}
                >
                  {s}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
