const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** The modifier key as shown in shortcut hints, like ⌘ or Ctrl+. */
const MOD = IS_MAC ? "⌘" : "Ctrl+";

export const SHORTCUTS = {
  undo: `${MOD}Z`,
  redo: IS_MAC ? "⇧⌘Z" : "Ctrl+Shift+Z",
  export: `${MOD}E`,
  forward: `${MOD}]`,
  back: `${MOD}[`,
  erase: "E",
  restore: "B",
  brushLarger: "]",
  brushSmaller: "[",
  delete: "⌫",
  zoomIn: `${MOD}+`,
  zoomOut: `${MOD}−`,
  zoomActual: `${MOD}1`,
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
}: KeyPress): ShortcutCommand | null {
  const key = rawKey.toLowerCase();
  if (metaKey || ctrlKey) {
    switch (key) {
      case "=":
      case "+":
        return "zoomIn";
      case "-":
      case "_":
        return "zoomOut";
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
    case "b":
      return "restore";
    case "e":
      return "erase";
    case "escape":
      return "escape";
    default:
      return null;
  }
}
