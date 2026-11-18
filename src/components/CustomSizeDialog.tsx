import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import type { CanvasFormat } from "../types";
import { Button } from "./ui/Button";
import { NumberField } from "./ui/NumberField";

export interface CustomSizeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  canvasFormat: CanvasFormat;
  onCanvas: (changes: Partial<CanvasFormat>) => void;
}

export function CustomSizeDialog({
  isOpen,
  onOpenChange,
  canvasFormat,
  onCanvas,
}: CustomSizeDialogProps) {
  return (
    <ModalOverlay
      className="modal-overlay"
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal className="modal">
        <Dialog className="custom-size">
          <Heading slot="title">Custom size</Heading>
          <div className="row">
            <NumberField
              label="Width (px)"
              minValue={100}
              maxValue={8000}
              value={canvasFormat.customWidth}
              onChange={(customWidth) => {
                if (!Number.isNaN(customWidth)) onCanvas({ customWidth });
              }}
              autoFocus
            />
            <NumberField
              label="Height (px)"
              minValue={100}
              maxValue={8000}
              value={canvasFormat.customHeight}
              onChange={(customHeight) => {
                if (!Number.isNaN(customHeight)) onCanvas({ customHeight });
              }}
            />
          </div>
          <div className="row end">
            <Button variant="primary" slot="close">
              Done
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
