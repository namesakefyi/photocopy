// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS } from "../core/canvasFormat";
import type { ArtboardSummary } from "../core/persistence";
import { DEFAULT_SETTINGS } from "../core/photocopy";
import { render } from "../test/renderHook";
import { ArtboardList, type ArtboardListProps } from "./ArtboardList";

const summary = (id: string): ArtboardSummary => ({
  id,
  backgroundId: "white",
  canvasFormat: DEFAULT_CANVAS,
  settings: DEFAULT_SETTINGS,
  layers: [],
});

const props = (artboards: ArtboardSummary[]): ArtboardListProps => ({
  artboards,
  activeId: artboards[0].id,
  busyIds: new Set(),
  onOpen: () => {},
  onNew: () => {},
  onDuplicate: () => {},
  onRequestDelete: () => {},
  onReorder: () => {},
});

describe("ArtboardList", () => {
  it("keeps working as artboards are added and removed", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const one = [summary("a")];
    const two = [summary("a"), summary("b")];
    const { container, rerender, unmount } = render(
      <ArtboardList {...props(one)} />,
    );
    for (const artboards of [two, one]) {
      rerender(<ArtboardList {...props(artboards)} />);
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
