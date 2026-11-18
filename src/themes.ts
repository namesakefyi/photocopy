export interface Theme {
  id: string;
  name: string;
  /** Saved behind the copy; null leaves it transparent. */
  color: string | null;
}

/** Transparent, then the Namesake brand colors from namesake.fyi/brand-assets. */
export const THEMES: Theme[] = [
  { id: "transparent", name: "Transparent", color: null },
  { id: "purple", name: "Namesake Purple", color: "#cda5ef" },
  { id: "pink", name: "Pastel Pink", color: "#ecadd4" },
  { id: "blue", name: "Pastel Blue", color: "#96c7f2" },
  { id: "yellow", name: "Pastel Yellow", color: "#ecdd85" },
  { id: "green", name: "Pastel Green", color: "#97cf9c" },
  { id: "brown", name: "Pastel Brown", color: "#ddb896" },
  { id: "white", name: "Photocopy White", color: "#e1e1e1" },
];

const STORAGE_KEY = "copyshop-theme";

export function savedTheme(): Theme {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
  } catch {
    return THEMES[0];
  }
}

/** Remembers the theme. It only colors the canvas, never the interface. */
export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // Storage can be unavailable (private windows); the theme still applies.
  }
}
