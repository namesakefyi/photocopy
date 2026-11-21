import { ProgressBar } from "react-aria-components";
import styles from "./ProgressLine.module.css";

export interface ProgressLineProps {
  label: string;
  /** From 0 to 1. */
  fraction: number;
}

export function ProgressLine({ label, fraction }: ProgressLineProps) {
  return (
    <ProgressBar
      className={styles.progressLine}
      aria-label={label}
      value={fraction * 100}
    >
      {({ percentage }) => (
        <div className={styles.fill} style={{ width: `${percentage}%` }} />
      )}
    </ProgressBar>
  );
}
