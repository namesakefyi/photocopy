import { ProgressBar } from "react-aria-components";

export interface ProgressLineProps {
  /** For screen readers, like "Removing background". */
  label: string;
  /** From 0 to 1. */
  fraction: number;
}

export function ProgressLine({ label, fraction }: ProgressLineProps) {
  return (
    <ProgressBar
      className="progress-line"
      aria-label={label}
      value={fraction * 100}
    >
      {({ percentage }) => (
        <div
          className="progress-line-fill"
          style={{ width: `${percentage}%` }}
        />
      )}
    </ProgressBar>
  );
}
