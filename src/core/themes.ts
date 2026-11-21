import { readSetting, writeSetting } from "./settings";

export interface Theme {
  id: string;
  name: string;
  color: string;
}

/** The Namesake brand colors from namesake.fyi/brand-assets. */
export const THEMES: Theme[] = [
  { id: "purple", name: "Namesake Purple", color: "#cda5ef" },
  { id: "pink", name: "Pastel Pink", color: "#ecadd4" },
  { id: "blue", name: "Pastel Blue", color: "#96c7f2" },
  { id: "yellow", name: "Pastel Yellow", color: "#ecdd85" },
  { id: "green", name: "Pastel Green", color: "#97cf9c" },
  { id: "brown", name: "Pastel Brown", color: "#ddb896" },
  { id: "white", name: "Photocopy White", color: "#e1e1e1" },
];

export const DEFAULT_THEME = THEMES[THEMES.length - 1];

const STORAGE_KEY = "photocopy-background";

/** The theme with this id, or the last one picked if there's none. */
export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? savedBackground();
}

export function savedBackground(): Theme {
  const id = readSetting(STORAGE_KEY);
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

/** Remembers the background. It only colors the canvas, never the interface. */
export function saveBackground(theme: Theme) {
  writeSetting(STORAGE_KEY, theme.id);
}
