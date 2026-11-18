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

export function simplifiedRatio(width: number, height: number) {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = gcd(Math.round(width), Math.round(height)) || 1;
  const ratioWidth = width / divisor;
  const ratioHeight = height / divisor;
  return ratioWidth <= 50 && ratioHeight <= 50
    ? `${ratioWidth}:${ratioHeight}`
    : `${(width / height).toFixed(2)}:1`;
}
