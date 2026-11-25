import { createContext, useContext } from "react";

export interface ArtboardActions {
  newArtboard: () => void;
  duplicateArtboard: () => void;
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
