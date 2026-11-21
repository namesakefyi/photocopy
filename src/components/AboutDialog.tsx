import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { version } from "../../package.json";
import styles from "./AboutDialog.module.css";
import modalStyles from "./ui/modal.module.css";

export interface AboutDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AboutDialog({ isOpen, onOpenChange }: AboutDialogProps) {
  return (
    <ModalOverlay
      className={modalStyles.overlay}
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal className={styles.window}>
        <Dialog className={styles.about}>
          <Heading slot="title">Photocopy</Heading>
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
      </Modal>
    </ModalOverlay>
  );
}
