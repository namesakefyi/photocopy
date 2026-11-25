import { createContext, useContext } from "react";
import type { ArtboardSummary } from "../../core/persistence";
import type { ArtboardState, Layer, Removal } from "../../core/types";

export interface WorkspaceActions {
  openArtboard: (id: string) => void;
  createArtboard: () => void;
  duplicateArtboard: (id: string) => void;
  deleteArtboard: (id: string) => void;
  reorderArtboards: (order: string[]) => void;
  switchArtboard: (direction: 1 | -1) => void;
  setSaved: (id: string, saved: ArtboardState) => void;
  setThumbnail: (thumbnail: Blob) => void;
  startBackgroundRemoval: (layer: Layer) => void;
  setArtboardListShown: (isShown: boolean) => void;
}

export interface Workspace extends WorkspaceActions {
  artboards: ArtboardSummary[];
  activeId: string;
  activeArtboard: ArtboardSummary | undefined;
  isArtboardListShown: boolean;
  isNarrow: boolean;
}

export const WorkspaceContext = createContext<Workspace | null>(null);

export interface Removals {
  active: Record<string, Removal>;
  busyIds: Set<string>;
}

export const RemovalsContext = createContext<Removals>({
  active: {},
  busyIds: new Set(),
});

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace needs a provider above it");
  return workspace;
}

export function useRemovals() {
  return useContext(RemovalsContext);
}
