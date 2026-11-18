import { type PhotocopySettings, photocopy } from "./photocopy";

export interface PhotocopyRequest {
  id: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  settings: PhotocopySettings;
  pixelScale: number;
}

export type PhotocopyResponse =
  | { id: number; buffer: ArrayBuffer }
  | { id: number; error: string };

self.onmessage = ({ data }: MessageEvent<PhotocopyRequest>) => {
  try {
    const result = photocopy(
      {
        data: new Uint8ClampedArray(data.buffer),
        width: data.width,
        height: data.height,
      },
      data.settings,
      data.pixelScale,
    );
    const buffer = result.data.buffer as ArrayBuffer;
    const response: PhotocopyResponse = { id: data.id, buffer };
    self.postMessage(response, { transfer: [buffer] });
  } catch (cause) {
    const response: PhotocopyResponse = {
      id: data.id,
      error: cause instanceof Error ? cause.message : String(cause),
    };
    self.postMessage(response);
  }
};
