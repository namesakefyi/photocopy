import {
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { cx } from "./cx";
import styles from "./Dialog.module.css";

export interface DialogProps extends Omit<AriaDialogProps, "className"> {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  className?: string;
  contentClassName?: string;
}

export function Dialog({
  isOpen,
  onOpenChange,
  className,
  contentClassName,
  ...props
}: DialogProps) {
  return (
    <ModalOverlay
      className={styles.overlay}
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal className={cx(styles.modal, className)}>
        <AriaDialog
          {...props}
          className={cx(styles.dialog, contentClassName)}
        />
      </Modal>
    </ModalOverlay>
  );
}

export function DialogHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading slot="title" className={styles.heading}>
      {children}
    </Heading>
  );
}

export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
