import styles from "./CanvasShape.module.css";

const size = 14;

export function CanvasShape({
  width,
  height,
}: {
  width: number;
  height: number;
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
