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

/** The canvas background: a color, or none for transparent. */
export interface Background {
  theme: Theme | null;
  /** Fills the export with the color; otherwise it only shows on the canvas. */
  includeInExport: boolean;
}

export const NO_BACKGROUND: Background = { theme: null, includeInExport: true };

const STORAGE_KEY = "photocopy-background";
const EXPORT_KEY = "photocopy-background-export";

export function savedBackground(): Background {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return {
      theme: THEMES.find((theme) => theme.id === id) ?? null,
      includeInExport: localStorage.getItem(EXPORT_KEY) !== "false",
    };
  } catch {
    return NO_BACKGROUND;
  }
}

/** Remembers the background. It only colors the canvas, never the interface. */
export function saveBackground({ theme, includeInExport }: Background) {
  try {
    localStorage.setItem(STORAGE_KEY, theme?.id ?? "transparent");
    localStorage.setItem(EXPORT_KEY, String(includeInExport));
  } catch {
    // Storage can be unavailable (private windows); the background still applies.
  }
}

/** The color to fill an export with, or null to leave it transparent. */
export function exportFill({ theme, includeInExport }: Background) {
  return includeInExport ? (theme?.color ?? null) : null;
}
