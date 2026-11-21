import { expect, it } from "vitest";
import { formatFileSize } from "./copy";

it("formats file sizes in decimal kilobytes and megabytes", () => {
  expect(formatFileSize(55_811, "en-US")).toBe("56 kB");
  expect(formatFileSize(1_420_000, "en-US")).toBe("1.4 MB");
  expect(formatFileSize(200, "en-US")).toBe("1 kB");
});
