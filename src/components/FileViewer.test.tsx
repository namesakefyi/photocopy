// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ArtboardSummary } from "../persistence";
import { render } from "../test/renderHook";
import { FileViewer, type FileViewerProps } from "./FileViewer";

const summary = (id: string): ArtboardSummary => ({
  id,
  backgroundId: "white",
});

const props = (artboards: ArtboardSummary[]): FileViewerProps => ({
  artboards,
  activeId: artboards[0].id,
  busyIds: new Set(),
  onOpen: () => {},
  onNew: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
  onReorder: () => {},
});

describe("FileViewer", () => {
  it("keeps working as artboards are added and removed", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const one = [summary("a")];
    const two = [summary("a"), summary("b")];
    const { container, rerender, unmount } = render(
      <FileViewer {...props(one)} />,
    );
    for (const artboards of [two, one]) {
      rerender(<FileViewer {...props(artboards)} />);
      expect(container.querySelectorAll("[role=row]")).toHaveLength(
        artboards.length,
      );
    }
    unmount();
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    errors.mockRestore();
    warnings.mockRestore();
  });
});
