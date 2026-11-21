import styles from "./CanvasShape.module.css";

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
      className={styles.box}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={styles.shape}
        style={{ width: width * fit, height: height * fit }}
      />
    </span>
  );
}
