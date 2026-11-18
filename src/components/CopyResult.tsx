import { useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { formatCredit } from "../commons";
import type { Copy } from "../copy";
import type { Credit } from "../types";
import { Button } from "./ui/Button";

export interface CopyResultProps {
  copy: Copy | null;
  credits: Credit[];
  onClose: () => void;
}

export function CopyResult({ copy, credits, onClose }: CopyResultProps) {
  // Keyed to the export's URL, so a new export starts fresh.
  const [copyStatus, setCopyStatus] = useState<{
    url: string;
    status: "copied" | "failed";
  } | null>(null);
  const status =
    copy && copyStatus?.url === copy.url ? copyStatus.status : null;
  const creditText = credits.map(formatCredit).join("\n");

  return (
    <ModalOverlay
      className="modal-overlay"
      isDismissable
      isOpen={copy !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal className="modal">
        <Dialog className="copy-result" aria-label="Export">
          {copy && (
            <>
              <div className="result">
                <img src={copy.url} alt="Photocopied collage" />
              </div>
              <p className="hint">
                {copy.width} × {copy.height} px
              </p>
              {credits.length > 0 && (
                <div className="credits">
                  <div className="section-heading">
                    <h3>Credits</h3>
                    <Button
                      variant="quiet"
                      onPress={async () => {
                        try {
                          await navigator.clipboard.writeText(creditText);
                          setCopyStatus({ url: copy.url, status: "copied" });
                        } catch {
                          setCopyStatus({ url: copy.url, status: "failed" });
                        }
                      }}
                    >
                      {status === "copied"
                        ? "Copied"
                        : status === "failed"
                          ? "Couldn’t copy"
                          : "Copy credits"}
                    </Button>
                  </div>
                  <ul>
                    {credits.map((credit) => (
                      <li key={credit.sourceUrl}>
                        “{credit.title}” by {credit.author},{" "}
                        {credit.licenseUrl ? (
                          <a
                            href={credit.licenseUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {credit.license}
                          </a>
                        ) : (
                          credit.license
                        )}
                        , via{" "}
                        <a
                          href={credit.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Wikimedia Commons
                        </a>
                        {!credit.attributionRequired && (
                          <span className="hint"> (credit optional)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="row">
                <Button onPress={onClose} variant="quiet">
                  Close
                </Button>
                <a
                  className="button primary"
                  href={copy.url}
                  download={`photocopy-${Date.now()}.png`}
                >
                  Download PNG
                </a>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
