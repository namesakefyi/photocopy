import { createContext, type Dispatch, useContext } from "react";
import type { EditorAction } from "../core/editor";
import type { Credit } from "../core/types";
import type { ZoomAction } from "../core/zoom";

export interface EditorCommands {
  dispatch: Dispatch<EditorAction>;
  undo: () => void;
  redo: () => void;
  /** Copy and cut act on the selected layer. */
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
  openAbout: () => void;
}

export const EditorContext = createContext<EditorCommands | null>(null);

export function useEditor() {
  const commands = useContext(EditorContext);
  if (!commands) throw new Error("useEditor needs an ArtboardEditor above it");
  return commands;
}
