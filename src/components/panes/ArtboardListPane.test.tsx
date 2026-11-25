// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS } from "../../core/canvasFormat";
import type { ArtboardSummary } from "../../core/persistence";
import { DEFAULT_SETTINGS } from "../../core/photocopy";
import {
  type Workspace,
  WorkspaceContext,
} from "../../hooks/workspace/useWorkspace";
import { render } from "../../test/render";
import { ArtboardListPane } from "./ArtboardListPane";

const summary = (id: string): ArtboardSummary => ({
  id,
  backgroundId: "white",
  canvasFormat: DEFAULT_CANVAS,
  settings: DEFAULT_SETTINGS,
  layers: [],
});

const list = (artboards: ArtboardSummary[]) => (
  <WorkspaceContext
    value={{ artboards, activeId: artboards[0].id } as Workspace}
  >
    <ArtboardListPane />
  </WorkspaceContext>
);

describe("ArtboardListPane", () => {
  it("keeps working as artboards are added and removed", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const one = [summary("a")];
    const two = [summary("a"), summary("b")];
    const { container, rerender, unmount } = render(list(one));
    for (const artboards of [two, one]) {
      rerender(list(artboards));
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
