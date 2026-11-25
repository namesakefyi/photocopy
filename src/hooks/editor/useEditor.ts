import {
  createContext,
  type Dispatch,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { EditorAction } from "../../core/editor";
import type { Credit, Tool } from "../../core/types";
import type { ValueStore } from "../../core/valueStore";
import type { ZoomAction } from "../../core/zoom";

export interface EditorStatus {
  canUndo: boolean;
  canRedo: boolean;
  canCopy: boolean;
  canExport: boolean;
  selectedId: string | null;
  tool: Tool;
  brushSize: number;
  canEditMask: boolean;
  canRemoveBackground: boolean;
  canCrop: boolean;
  canBringForward: boolean;
  canSendBack: boolean;
}

export interface EditorCommands {
  dispatch: Dispatch<EditorAction>;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  addFiles: (files: File[], credit?: Credit) => Promise<void>;
  removeBackground: (layerId: string) => void;
  cropToVisible: (layerId: string) => void;
  showBrushSize: () => void;
  zoom: (action: ZoomAction) => void;
  reportZoom: (scale: number) => void;
  openUpload: () => void;
  openSearch: () => void;
  export: () => void;
  status: ValueStore<EditorStatus>;
}

export const EditorContext = createContext<EditorCommands | null>(null);

export type Editor = EditorCommands & Readonly<EditorStatus>;

const STATUS_KEYS: (keyof EditorStatus)[] = [
  "canUndo",
  "canRedo",
  "canCopy",
  "canExport",
  "selectedId",
  "tool",
  "brushSize",
  "canEditMask",
  "canRemoveBackground",
  "canCrop",
  "canBringForward",
  "canSendBack",
];

interface Tracking {
  isRendering: boolean;
  /** The status this component last rendered with, and which of it the render read. */
  rendered: EditorStatus;
  read: Set<keyof EditorStatus>;
}

/**
 * The editor's commands and status. Status values read while rendering are
 * tracked, so the component re-renders only when one of those changes.
 */
export function useEditor(): Editor {
  const commands = useContext(EditorContext);
  if (!commands) throw new Error("useEditor needs an Editor above it");
  const store = commands.status;
  const tracking = useRef<Tracking | null>(null);
  tracking.current ??= {
    isRendering: true,
    rendered: store.get(),
    read: new Set(),
  };
  const state = tracking.current;

  // The last-rendered status until a value it read changes, then the current one.
  useSyncExternalStore(store.subscribe, () => {
    const current = store.get();
    for (const key of state.read) {
      if (!Object.is(current[key], state.rendered[key])) return current;
    }
    return state.rendered;
  });
  state.rendered = store.get();
  state.read.clear();
  state.isRendering = true;
  useLayoutEffect(() => {
    state.isRendering = false;
  });

  return useMemo(() => {
    const editor = { ...commands } as Editor;
    for (const key of STATUS_KEYS) {
      Object.defineProperty(editor, key, {
        enumerable: false,
        get() {
          if (state.isRendering) state.read.add(key);
          return store.get()[key];
        },
      });
    }
    return editor;
  }, [commands, store, state]);
}
