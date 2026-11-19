/** A small outline in the canvas's aspect ratio. */
export function CanvasShape({
  width,
  height,
  size = 16,
}: {
  width: number;
  height: number;
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
        style={{ width: width * fit, height: height * fit }}
      />
    </span>
  );
}
