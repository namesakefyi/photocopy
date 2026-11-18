const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** The modifier key as shown in shortcut hints, like ⌘ or Ctrl+. */
const MOD = IS_MAC ? "⌘" : "Ctrl+";

export const SHORTCUTS = {
  undo: `${MOD}Z`,
  redo: IS_MAC ? "⇧⌘Z" : "Ctrl+Shift+Z",
  export: `${MOD}E`,
  forward: `${MOD}]`,
  back: `${MOD}[`,
  // The "erase" tool masks the photo away (Mask); "restore" paints it back (Erase).
  erase: "M",
  restore: "E",
  brushLarger: "]",
  brushSmaller: "[",
  delete: "⌫",
  zoomIn: `${MOD}+`,
  zoomOut: `${MOD}−`,
  // Browsers keep ⌘1–9 for switching tabs, so 100% follows Figma instead.
  zoomActual: "⇧0",
  zoomDouble: "⇧2",
  zoomFit: `${MOD}0`,
} as const;

export type ShortcutCommand =
  | "undo"
  | "redo"
  | "export"
  | "forward"
  | "back"
  | "zoomIn"
  | "zoomOut"
  | "zoomActual"
  | "zoomDouble"
  | "zoomFit"
  | "brushLarger"
  | "brushSmaller"
  | "delete"
  | "restore"
  | "erase"
  | "escape";

export interface KeyPress {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  /** The physical key, for shortcuts whose character varies by layout. */
  code?: string;
}

/**
 * The command a key press stands for, or null for keys the app leaves to the
 * browser. ⌘ and Ctrl both count as the modifier, so either works anywhere.
 */
export function shortcutFor({
  key: rawKey,
  metaKey,
  ctrlKey,
  shiftKey,
  code,
}: KeyPress): ShortcutCommand | null {
  const key = rawKey.toLowerCase();
  // ⇧0 and ⇧2 type ")" and "@" on US keyboards, other characters elsewhere.
  if (shiftKey && !metaKey && !ctrlKey) {
    if (code === "Digit0") return "zoomActual";
    if (code === "Digit2") return "zoomDouble";
  }
  if (metaKey || ctrlKey) {
    switch (key) {
      case "=":
      case "+":
        return "zoomIn";
      case "-":
      case "_":
        return "zoomOut";
      // Where the browser lets it through, ⌘1 still works.
      case "1":
        return "zoomActual";
      case "0":
        return "zoomFit";
      case "z":
        return shiftKey ? "redo" : "undo";
      case "y":
        return "redo";
      case "e":
        return "export";
      case "]":
        return "forward";
      case "[":
        return "back";
      default:
        return null;
    }
  }
  switch (key) {
    case "]":
      return "brushLarger";
    case "[":
      return "brushSmaller";
    case "delete":
    case "backspace":
      return "delete";
    case "m":
      return "erase";
    case "e":
      return "restore";
    case "escape":
      return "escape";
    default:
      return null;
  }
}
