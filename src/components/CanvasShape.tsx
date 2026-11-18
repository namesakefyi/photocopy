/** A small outline in the canvas's aspect ratio, dashed when it has no edges. */
export function CanvasShape({
  width,
  height,
  isOpen = false,
  size = 16,
}: {
  width: number;
  height: number;
  isOpen?: boolean;
  size?: number;
}) {
  const fit = size / Math.max(width, height);
  return (
    <span
      className="shape-box"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="shape"
        data-open={isOpen || undefined}
        style={{ width: width * fit, height: height * fit }}
      />
    </span>
  );
}
