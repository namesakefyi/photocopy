import type { EditorCommands } from "../hooks/useEditor";

export const ADD_IMAGE_ITEMS = [
  {
    id: "upload",
    label: "Upload Image…",
    run: (editor) => editor.openUpload(),
  },
  {
    id: "search",
    label: "Search for Images…",
    run: (editor) => editor.openSearch(),
  },
] as const satisfies {
  id: string;
  label: string;
  run: (editor: EditorCommands) => void;
}[];
