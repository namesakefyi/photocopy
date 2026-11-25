import { createContext, useContext } from "react";

/** Artboard-level commands, from the library rather than the open editor. */
export interface ArtboardActions {
  newArtboard: () => void;
  duplicateArtboard: () => void;
  /** Asks first. */
  deleteArtboard: () => void;
}

export const ArtboardActionsContext = createContext<ArtboardActions | null>(
  null,
);

export function useArtboardActions() {
  const actions = useContext(ArtboardActionsContext);
  if (!actions) throw new Error("useArtboardActions needs a provider above it");
  return actions;
}
