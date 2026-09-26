import { createSignal, createEffect, Show, onMount, onCleanup, type JSX } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { getCurrentWindow } from "@tauri-apps/api/window";
// Deep imports: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import Trash2 from "lucide-solid/icons/trash-2";
import Pin from "lucide-solid/icons/pin";
import X from "lucide-solid/icons/x";
import Calendar from "lucide-solid/icons/calendar";
import CalendarClock from "lucide-solid/icons/calendar-clock";
import type { Note, ColorKey } from "../lib/types";
import * as api from "../lib/invoke";
import { onNoteUpdated, onSettingsChanged } from "../lib/events";
import {
  settings,
  loadSettings,
  saveSettings,
  applySettings,
  patchSettingsLocal,
} from "../stores/settingsStore";
import { getColorHex, getColorDeepHex } from "../lib/types";
import ColorSwatchRow from "../components/ColorSwatchRow";
import { DELETE_NOTE_CONFIRM } from "../lib/uiText";
import { formatDateTime } from "../lib/formatTime";
import { NOTE_ZOOM_DEFAULT, clampZoom, rootFontSizePx, stepZoom } from "../lib/zoom";
import NoteToolbar from "../components/NoteToolbar";
import TagInput from "../components/TagInput";
import ConfirmDialog from "../components/ConfirmDialog";
import ResizeHandles from "../components/ResizeHandles";
import ZoomControl from "../components/ZoomControl";
import { debounce } from "../utils/debounce";
import { insertImageFromBlob } from "../lib/insertImageFromBlob";

/** Shared header strip that labels one region of the editor. */
function PanelLabel(props: { children: JSX.Element }) {
  return (
    <div class="flex items-center gap-1 px-2 py-1 border-b border-black/10 bg-white/40 text-[0.625rem] font-medium tracking-wide text-ink/45 select-none">
      {props.children}
    </div>
  );
}

export default function NoteView(props: { noteId: string }) {
  const [note, setNote] = createSignal<Note | null>(null);
  const [title, setTitle] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [color, setColor] = createSignal<ColorKey>("paper");
  const [pinned, setPinned] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [editorReady, setEditorReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<string | null>(null);

  let editorContainer!: HTMLDivElement;
  let editor: Editor | undefined;
  // Lifecycle flags for the save pipeline.
  let deleted = false;
  let saveFailedOnce = false;
  let pendingSave: Promise<boolean> = Promise.resolve(true);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => setNotice(null), 5000);
  };

  // Build a Note update object from current editor/signal state
  const buildNoteUpdate = (): Note | null => {
    const current = note();
    if (!current || !editor) return null;
    return {
      ...current,
      title: title(),
      content: editor.getHTML(),
      tags: tags(),
      color: color(),
      pinned: pinned(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Save the full current state (including window rect) immediately.
  const doSave = async (): Promise<boolean> => {
    // After deletion, any straggler save would resurrect the file.
    if (deleted) return true;
    const updated = buildNoteUpdate();
    if (!updated) return true;
    try {
      const win = getCurrentWindow();
      const [pos, size, sf] = await Promise.all([
        win.outerPosition(),
        win.outerSize(),
        win.scaleFactor(),
      ]);
      if (sf > 0) {
        updated.position = {
          x: pos.x / sf,
          y: pos.y / sf,
          width: size.width / sf,
          height: size.height / sf,
        };
      }
    } catch (e) {
      console.error("Failed to capture window position:", e);
    }
    if (deleted) return true;
    try {
      await api.writeNote(updated.id, updated);
      setNote(updated);
      saveFailedOnce = false;
      return true;
    } catch (e) {
      console.error("Failed to save note:", e);
      return false;
    }
  };

  // Serialize saves: a new save always waits for the in-flight one, so this
  // window never has two concurrent write_note calls racing on one file.
  const saveNow = (): Promise<boolean> => {
    const p = pendingSave.catch(() => false).then(() => doSave());
    pendingSave = p;
    return p;
  };

  // Single debounce instance for the whole component lifetime; the delay is
  // read through a getter so a settings change never orphans a live timer.
  let autoSaveDelay = 2000;
  const autoSave = debounce(saveNow, () => autoSaveDelay);

  // ---------------------------------------------------------------------
  // Zoom: window size and content scale are separate gestures. Dragging a
  // ResizeHandles edge changes the window; zooming scales the content inside
  // it by moving the document root font size, which every rem-based Tailwind
  // utility follows — so padding and icons grow with the text instead of the
  // text overflowing a fixed box.
  // ---------------------------------------------------------------------
  const zoom = () => settings().noteZoom;

  createEffect(() => {
    document.documentElement.style.fontSize = `${rootFontSizePx(zoom())}px`;
  });

  // Disk write is debounced: a Ctrl+wheel gesture would otherwise emit a
  // write + a settings-changed broadcast to every window per notch.
  const persistZoom = debounce((next: number) => {
    saveSettings({ ...settings(), noteZoom: next }).catch((e) =>
      console.error("[NoteView] failed to save zoom:", e)
    );
  }, 400);

  const applyZoom = (next: number) => {
    const clamped = clampZoom(next);
    if (clamped === zoom()) return;
    patchSettingsLocal({ noteZoom: clamped });
    persistZoom(clamped);
  };

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || e.altKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        applyZoom(stepZoom(zoom(), 1));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        applyZoom(stepZoom(zoom(), -1));
      } else if (e.key === "0") {
        e.preventDefault();
        applyZoom(NOTE_ZOOM_DEFAULT);
      }
    };
    // passive: false — preventDefault is required or WebView2 zooms the
    // whole webview out from under us.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      applyZoom(stepZoom(zoom(), e.deltaY < 0 ? 1 : -1));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: false });
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
      persistZoom.cancel();
    });
  });

  onMount(() => {
    loadSettings()
      .then((s) => {
        if (s.autoSaveIntervalMs >= 500) autoSaveDelay = s.autoSaveIntervalMs;
      })
      .catch((e) => console.error("[NoteView] failed to read settings:", e));
  });

  // Cross-window sync: merge external changes (e.g. the main window's
  // right-click color change) into local state so the next auto-save does
  // not overwrite them with a stale snapshot. Own echoes are filtered by
  // source label; content stays under this editor's authority.
  onMount(() => {
    const ownLabel = getCurrentWindow().label;
    const unlistenUpdate = onNoteUpdated((n, source) => {
      if (n.id !== props.noteId || source === ownLabel) return;
      const cur = note();
      if (!cur) return;
      setNote({ ...cur, color: n.color, tags: n.tags, pinned: n.pinned, updatedAt: n.updatedAt });
      setColor(n.color);
      setTags(n.tags);
      setPinned(n.pinned);
    });
    // Settings are shared with the main window (sort order) and the other
    // note windows (zoom); adopt the broadcast so a later save of ours does
    // not write back a stale snapshot of the fields we do not own.
    const unlistenSettings = onSettingsChanged((s) => {
      applySettings(s);
      if (s.autoSaveIntervalMs >= 500) autoSaveDelay = s.autoSaveIntervalMs;
    });
    unlistenUpdate.catch((e) =>
      console.error("[NoteView] failed to register note-updated listener:", e)
    );
    unlistenSettings.catch((e) =>
      console.error("[NoteView] failed to register settings listener:", e)
    );
    onCleanup(() => {
      unlistenUpdate.then((un) => un()).catch(() => {});
      unlistenSettings.then((un) => un()).catch(() => {});
    });
  });

  // Save-before-close: covers the red button, Alt+F4 and tray Quit (the
  // backend closes note windows before exiting). Tauri auto-prevents the
  // close while a JS close-requested listener exists, awaits this handler,
  // then destroys the window unless preventDefault() was called.
  onMount(() => {
    const win = getCurrentWindow();
    const unlistenClose = win.onCloseRequested(async (event) => {
      if (deleted) return;
      autoSave.cancel();
      const ok = await saveNow();
      if (!ok) {
        if (saveFailedOnce) return; // user chose to close anyway
        saveFailedOnce = true;
        event.preventDefault();
        setError("保存失败：内容未写入磁盘。再次点击关闭将放弃本次更改。");
      }
    });
    unlistenClose.catch((e) =>
      console.error("[NoteView] failed to register close listener:", e)
    );
    onCleanup(() => {
      unlistenClose.then((un) => un()).catch(() => {});
    });
  });

  // Insert images one by one so their order matches the selection order,
  // and surface failures instead of swallowing them.
  const insertImages = (blobs: Blob[]) => {
    void (async () => {
      let failed = 0;
      for (const blob of blobs) {
        if (!editor) return;
        const ok = await insertImageFromBlob(editor, blob, props.noteId);
        if (!ok) failed++;
      }
      if (failed > 0) showNotice(`${failed} 张图片插入失败，请重试。`);
    })();
  };

  // Create editor after DOM mounts
  onMount(() => {
    if (!editorContainer) {
      setError("Editor container not found");
      return;
    }

    try {
      editor = new Editor({
        element: editorContainer,
        extensions: [
          StarterKit,
          Underline,
          Link.configure({ openOnClick: false }),
          Image.configure({ inline: true }),
          Placeholder.configure({ placeholder: "开始写..." }),
        ],
        editorProps: {
          attributes: { class: "prose prose-sm max-w-none outline-none" },
          handlePaste: (_view, event) => {
            const items = event.clipboardData?.items;
            if (!items) return false;
            const blobs: Blob[] = [];
            for (const item of Array.from(items)) {
              if (item.kind === "file" && item.type.startsWith("image/")) {
                const blob = item.getAsFile();
                if (blob) blobs.push(blob);
              }
            }
            if (blobs.length === 0) return false;
            event.preventDefault();
            insertImages(blobs);
            return true;
          },
          handleDrop: (_view, event, _slice, moved) => {
            if (moved) return false;
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;
            const blobs = Array.from(files).filter((f) =>
              f.type.startsWith("image/")
            );
            if (blobs.length === 0) return false;
            event.preventDefault();
            insertImages(blobs);
            return true;
          },
        },
        onUpdate: () => {
          autoSave();
        },
      });
      setEditorReady(true);
    } catch (e) {
      console.error("[NoteView] Failed to create editor:", e);
      setError(`Failed to create editor: ${e}`);
    }
  });

  // Load note data: fetch starts immediately (parallel with editor
  // creation); applying it waits for the editor to be ready. The catch is
  // attached at creation so an editor failure can't turn the rejection
  // into an unhandled one.
  const noteFetch = api.readNote(props.noteId).catch((e) => {
    console.error("[NoteView] Failed to load note:", e);
    setError(`Failed to load note: ${e}`);
    return null;
  });
  createEffect(() => {
    const ready = editorReady();
    if (!ready) return;

    void noteFetch.then((data) => {
      if (!data) return;
      setNote(data);
      setTitle(data.title);
      setTags(data.tags);
      setColor(data.color);
      setPinned(data.pinned);
      // create_note_window never reads the note, so the saved pin state does
      // not carry over to the OS window; without this a reopened pinned note
      // shows the pin dot but is not actually always-on-top.
      if (data.pinned) {
        api.setNoteWindowPinned(props.noteId, true).catch((e) =>
          console.error("[NoteView] Failed to restore pinned state:", e)
        );
      }
      if (editor) {
        editor.commands.setContent(data.content);
      }
    });
  });

  // Cleanup on unmount — flush any pending save so a quit/close that
  // races a debounce does not drop the user's last edits.
  onCleanup(() => {
    autoSave.flush().catch((e) => {
      console.error("[NoteView] flush on cleanup failed:", e);
    });
    if (noticeTimer) clearTimeout(noticeTimer);
    editor?.destroy();
  });

  const handleClose = () => {
    // The close-requested handler above performs the final save (including
    // the final window rect) before the window is destroyed.
    void api.closeNoteWindow(props.noteId).catch((e) => {
      console.error("[NoteView] Failed to close window:", e);
    });
  };

  const handlePinToggle = async () => {
    const newPinned = !pinned();
    setPinned(newPinned);
    try {
      await api.setNoteWindowPinned(props.noteId, newPinned);
      autoSave();
    } catch (e) {
      console.error("[NoteView] Failed to toggle pin:", e);
      setPinned(!newPinned);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    // Block new saves, then wait out any in-flight save so it cannot
    // re-create the file after deletion.
    autoSave.cancel();
    deleted = true;
    await pendingSave.catch(() => {});
    try {
      await api.deleteNote(props.noteId);
    } catch (e) {
      console.error("[NoteView] Failed to delete note:", e);
      deleted = false;
      setError(`删除失败：${e}`);
      return;
    }
    await api.closeNoteWindow(props.noteId);
  };

  const colorHex = () => getColorHex(color());
  const deepHex = () => getColorDeepHex(color());
  const createdAt = () => formatDateTime(note()?.createdAt);
  const updatedAt = () => formatDateTime(note()?.updatedAt);

  return (
    <div
      class="note-window relative h-full flex flex-col select-none text-ink transition-[background-color] duration-200"
      style={{ background: colorHex() }}
    >
      {/* Borderless window: the OS resize border is invisible, so the user
          needs explicit grab areas. */}
      <ResizeHandles />

      {/* Loading indicator while editor initializes */}
      <Show when={!editorReady() && !error()}>
        <div class="bg-black/5 text-ink-muted text-xs px-3 py-1.5 text-center shrink-0">
          编辑器初始化中…
        </div>
      </Show>

      {/* Error banner */}
      <Show when={error()}>
        <div class="bg-red-50/90 text-red-700 text-xs px-3 py-1.5 text-center shrink-0">
          {error()}
        </div>
      </Show>

      {/* Transient notice banner */}
      <Show when={notice()}>
        <div class="bg-amber-50/90 text-amber-800 text-xs px-3 py-1.5 text-center shrink-0">
          {notice()}
        </div>
      </Show>

      {/* Header — the whole bar is a drag region. Tauri only starts a drag
          when the mousedown target itself carries the attribute, so clicks on
          the child buttons are never consumed by a drag start. */}
      <div class="flex items-center gap-1 px-3 pt-3 pb-1 min-h-9 shrink-0" data-tauri-drag-region>
        <div class="flex gap-2">
          <button
            onClick={handlePinToggle}
            class="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors"
            classList={{
              "bg-black/15 text-transparent hover:text-ink/60 hover:bg-black/20": !pinned(),
              "bg-ink text-white": pinned(),
            }}
            title="置顶/取消置顶"
            aria-label="置顶/取消置顶"
          >
            <Pin class="w-2 h-2" />
          </button>
          <button
            onClick={handleClose}
            class="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 text-transparent hover:text-white flex items-center justify-center transition-colors"
            title="关闭"
            aria-label="关闭"
          >
            <X class="w-2 h-2" />
          </button>
        </div>
        {/* Middle spacer — the sole drag region */}
        <div class="flex-1 self-stretch" data-tauri-drag-region />
        <ZoomControl
          zoom={zoom()}
          onZoomIn={() => applyZoom(stepZoom(zoom(), 1))}
          onZoomOut={() => applyZoom(stepZoom(zoom(), -1))}
          onZoomReset={() => applyZoom(NOTE_ZOOM_DEFAULT)}
        />
        <button
          onClick={() => setShowDeleteConfirm(true)}
          class="p-1 rounded-sm text-ink/50 hover:text-red-600 hover:bg-black/5 transition-colors"
          title="删除便签"
          aria-label="删除便签"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowColorPicker(!showColorPicker())}
          class="w-4 h-4 rounded-full border ml-1"
          style={{ background: colorHex(), "border-color": deepHex() }}
          title="更换颜色"
          aria-label="更换颜色"
        />
      </div>

      {/* Color picker */}
      <Show when={showColorPicker()}>
        <div class="px-3 pb-2 animate-fade-in shrink-0">
          <ColorSwatchRow
            selected={color()}
            onSelect={(c) => {
              setColor(c);
              setShowColorPicker(false);
              autoSave();
            }}
          />
        </div>
      </Show>

      {/* Title + timestamps */}
      <div class="px-3 pb-2 shrink-0">
        <input
          type="text"
          value={title()}
          onInput={(e) => {
            setTitle(e.currentTarget.value);
            autoSave();
          }}
          placeholder="标题"
          class="w-full text-lg font-semibold text-ink outline-none bg-transparent placeholder:text-black/25"
        />
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[0.625rem] leading-3 text-ink/50">
          <Show when={createdAt()}>
            {(value) => (
              <span class="flex items-center gap-1" title="创建时间">
                <Calendar class="w-[0.5625rem] h-[0.5625rem] shrink-0" />
                创建 {value()}
              </span>
            )}
          </Show>
          <Show when={updatedAt()}>
            {(value) => (
              <span class="flex items-center gap-1" title="修改时间">
                <CalendarClock class="w-[0.5625rem] h-[0.5625rem] shrink-0" />
                修改 {value()}
              </span>
            )}
          </Show>
        </div>
      </div>

      {/* Formatting toolbar — its own panel so it reads as chrome, not as
          part of the document. */}
      <div class="mx-3 mb-2 shrink-0 rounded-md border border-black/10 bg-white/55 overflow-hidden">
        <PanelLabel>格式</PanelLabel>
        <div class="px-1.5 py-1">
          <NoteToolbar
            editor={editorReady() ? editor ?? null : null}
            noteId={props.noteId}
            onImageError={showNotice}
          />
        </div>
      </div>

      {/* Body text — the only region that grows, and the only one with a
          paper-white, inset surface so it is obviously where typing goes. */}
      <div class="mx-3 mb-2 flex-1 min-h-0 flex flex-col rounded-md border border-black/10 bg-white/65 overflow-hidden">
        <PanelLabel>内容</PanelLabel>
        <div
          ref={editorContainer!}
          class="flex-1 min-h-0 overflow-y-auto px-3 py-2"
        />
      </div>

      {/* Tags — a separate panel again, so a tag is never mistaken for body
          text and vice versa. */}
      <div class="mx-3 mb-3 shrink-0 rounded-md border border-black/10 bg-white/55 overflow-hidden">
        <PanelLabel>标签</PanelLabel>
        <div class="px-2.5 py-1.5">
          <TagInput
            tags={tags()}
            onChange={(t) => {
              setTags(t);
              autoSave();
            }}
          />
        </div>
      </div>

      <Show when={showDeleteConfirm()}>
        <ConfirmDialog
          message={DELETE_NOTE_CONFIRM}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Show>
    </div>
  );
}
