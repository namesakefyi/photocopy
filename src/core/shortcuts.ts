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
  previousArtboard: IS_MAC ? "⌥↑" : "Alt+↑",
  nextArtboard: IS_MAC ? "⌥↓" : "Alt+↓",
} as const;

export type ShortcutCommand = keyof typeof SHORTCUTS | "escape";

const MOD_KEYS: Record<string, ShortcutCommand> = {
  "=": "zoomIn",
  "+": "zoomIn",
  "-": "zoomOut",
  _: "zoomOut",
  // Where the browser lets it through, ⌘1 still works.
  "1": "zoomActual",
  "0": "zoomFit",
  y: "redo",
  e: "export",
  "]": "forward",
  "[": "back",
};

const PLAIN_KEYS: Record<string, ShortcutCommand> = {
  "]": "brushLarger",
  "[": "brushSmaller",
  delete: "delete",
  backspace: "delete",
  m: "erase",
  e: "restore",
  escape: "escape",
};

export interface KeyPress {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
  /** The physical key, for shortcuts whose character varies by layout. */
  code?: string;
}

/** The command for a key press, or null to leave it to the browser. ⌘ and Ctrl both work. */
export function shortcutFor({
  key: rawKey,
  metaKey,
  ctrlKey,
  shiftKey,
  altKey = false,
  code,
}: KeyPress): ShortcutCommand | null {
  const key = rawKey.toLowerCase();
  if (altKey && !metaKey && !ctrlKey && !shiftKey) {
    if (key === "arrowup") return "previousArtboard";
    if (key === "arrowdown") return "nextArtboard";
  }
  // ⇧0 and ⇧2 type ")" and "@" on US keyboards, other characters elsewhere.
  if (shiftKey && !metaKey && !ctrlKey) {
    if (code === "Digit0") return "zoomActual";
    if (code === "Digit2") return "zoomDouble";
  }
  if (metaKey || ctrlKey) {
    if (key === "z") return shiftKey ? "redo" : "undo";
    return Object.hasOwn(MOD_KEYS, key) ? MOD_KEYS[key] : null;
  }
  return Object.hasOwn(PLAIN_KEYS, key) ? PLAIN_KEYS[key] : null;
}
