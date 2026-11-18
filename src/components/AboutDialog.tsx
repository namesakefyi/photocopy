import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { version } from "../../package.json";

export interface AboutDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AboutDialog({ isOpen, onOpenChange }: AboutDialogProps) {
  return (
    <ModalOverlay
      className="modal-overlay about-overlay"
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal className="about-window">
        <Dialog className="about">
          <Heading slot="title">Copyshop</Heading>
          <p className="about-version">Version {version}</p>
          <p>Create photocopy-style collages.</p>
          <p className="about-credit">
            Made by{" "}
            <a href="https://namesake.fyi" target="_blank" rel="noreferrer">
              Namesake
            </a>
          </p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
