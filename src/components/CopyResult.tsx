import { memo, useEffect, useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  type Copy,
  type ExportOptions,
  encodeCopy,
  type Photocopy,
  savedExportOptions,
  saveExportOptions,
} from "../core/copy";
import { creditSource, formatCredit } from "../core/credits";
import type { Credit } from "../core/types";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";

export interface CopyResultProps {
  photocopy: Photocopy | null;
  /** The canvas background color, used unless the export is transparent. */
  background: string;
  credits: Credit[];
  onClose: () => void;
}

export const CopyResult = memo(function CopyResult({
  photocopy,
  background,
  credits,
  onClose,
}: CopyResultProps) {
  const [options, setOptions] = useState<ExportOptions>(savedExportOptions);
  const [copy, setCopy] = useState<Copy | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeFailed, setEncodeFailed] = useState(false);
  const shown = useRef<Copy | null>(null);
  // Keyed to the export, so a new export starts fresh.
  const [copyStatus, setCopyStatus] = useState<{
    photocopy: Photocopy;
    status: "copied" | "failed";
  } | null>(null);
  const status =
    photocopy && copyStatus?.photocopy === photocopy ? copyStatus.status : null;
  const creditText = credits.map(formatCredit).join("\n");

  // The previous image stays up until the new one is ready, then its URL is freed.
  useEffect(() => {
    function show(next: Copy | null) {
      if (shown.current) URL.revokeObjectURL(shown.current.url);
      shown.current = next;
      setCopy(next);
    }
    if (!photocopy) {
      show(null);
      return;
    }
    let isCurrent = true;
    setIsEncoding(true);
    setEncodeFailed(false);
    encodeCopy(photocopy, {
      background: options.transparent ? null : background,
      cropToFit: options.cropToFit,
    })
      .then((next) => {
        if (isCurrent) show(next);
        else URL.revokeObjectURL(next.url);
      })
      .catch((cause) => {
        console.error(cause);
        if (isCurrent) setEncodeFailed(true);
      })
      .finally(() => {
        if (isCurrent) setIsEncoding(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [photocopy, background, options.transparent, options.cropToFit]);

  useEffect(
    () => () => {
      if (shown.current) URL.revokeObjectURL(shown.current.url);
    },
    [],
  );

  function changeOptions(changes: Partial<ExportOptions>) {
    const next = { ...options, ...changes };
    setOptions(next);
    saveExportOptions(next);
  }

  return (
    <ModalOverlay
      className="modal-overlay"
      isDismissable
      isOpen={photocopy !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal className="modal">
        <Dialog className="copy-result">
          {photocopy && (
            <>
              <div className="copy-preview">
                <div className="result" data-stale={isEncoding || undefined}>
                  {copy && <img src={copy.url} alt="Photocopied collage" />}
                </div>
              </div>
              <div className="copy-details">
                <div className="copy-heading">
                  <Heading slot="title">Export</Heading>
                  {copy && (
                    <p className="hint">
                      {copy.width} × {copy.height} px
                    </p>
                  )}
                </div>
                {encodeFailed && (
                  <p role="alert" className="error">
                    Couldn’t prepare the PNG. Try exporting again.
                  </p>
                )}
                <div className="copy-options">
                  <Checkbox
                    isSelected={options.cropToFit}
                    isDisabled={!photocopy.cropBounds}
                    onChange={(cropToFit) => changeOptions({ cropToFit })}
                  >
                    Shrink to fit
                  </Checkbox>
                  <Checkbox
                    isSelected={options.transparent}
                    onChange={(transparent) => changeOptions({ transparent })}
                  >
                    Transparent background
                  </Checkbox>
                </div>
                {credits.length > 0 && (
                  <div className="credits">
                    <div className="section-heading">
                      <h3>Credits</h3>
                      <Button
                        variant="quiet"
                        onPress={async () => {
                          try {
                            await navigator.clipboard.writeText(creditText);
                            setCopyStatus({ photocopy, status: "copied" });
                          } catch {
                            setCopyStatus({ photocopy, status: "failed" });
                          }
                        }}
                      >
                        {status === "copied"
                          ? "Copied"
                          : status === "failed"
                            ? "Couldn’t copy"
                            : "Copy"}
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
                            {creditSource(credit.source)}
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
                  <Button onPress={onClose}>Cancel</Button>
                  {copy && !isEncoding ? (
                    <a
                      className="button primary"
                      href={copy.url}
                      download={`photocopy-${Date.now()}.png`}
                    >
                      Download PNG
                    </a>
                  ) : (
                    <Button variant="primary" isDisabled>
                      {encodeFailed ? "Download PNG" : "Preparing…"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});
