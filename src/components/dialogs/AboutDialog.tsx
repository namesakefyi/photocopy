import { version } from "../../../package.json";
import { Dialog, DialogHeading } from "../ui/Dialog";
import styles from "./AboutDialog.module.css";

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
      <DialogHeading>Photocopy v{version}</DialogHeading>
      <p>Create photocopy-style collages.</p>
      <p className={styles.credit}>
        By{" "}
        <a href="https://namesake.fyi" target="_blank" rel="noreferrer">
          Namesake
        </a>
        .
      </p>
    </Dialog>
  );
}
