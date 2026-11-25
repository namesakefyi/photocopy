import { ProgressBar } from "react-aria-components";
import styles from "./Progress.module.css";

export interface ProgressProps {
  /** 0–100. */
  value: number;
  message: string;
}

export function Progress({ value, message }: ProgressProps) {
  return (
    <ProgressBar className={styles.progress} aria-label={message} value={value}>
      {({ percentage }) => (
        <>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${percentage}%` }} />
          </div>
          <p className={styles.message}>{message}</p>
        </>
      )}
    </ProgressBar>
  );
}
