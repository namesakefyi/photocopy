import { type PhotocopySettings, photocopy } from "./photocopy";

export interface PhotocopyRequest {
  id: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  settings: PhotocopySettings;
  pixelScale: number;
}

self.onmessage = ({ data }: MessageEvent<PhotocopyRequest>) => {
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
  self.postMessage({ id: data.id, buffer }, { transfer: [buffer] });
};
