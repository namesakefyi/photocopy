import { version } from "../../package.json";
import styles from "./AboutDialog.module.css";
import { Dialog, DialogHeading } from "./ui/Dialog";

export interface AboutDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AboutDialog({ isOpen, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={styles.window}
      contentClassName={styles.about}
    >
      <DialogHeading>Photocopy</DialogHeading>
      <p className={styles.version}>Version {version}</p>
      <p>Create photocopy-style collages.</p>
      <p className={styles.credit}>
        By{" "}
        <a href="https://namesake.fyi" target="_blank" rel="noreferrer">
          Namesake
        </a>
        . Code on{" "}
        <a
          href="https://github.com/namesakefyi/photocopy"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        .
      </p>
    </Dialog>
  );
}
