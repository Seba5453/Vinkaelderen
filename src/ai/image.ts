export function fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export interface DecodedImage { width: number; height: number; source: CanvasImageSource; close(): void; }

/** Decodes a photo, upright. Falls back for browsers (older iOS Safari) that reject imageOrientation or lack createImageBitmap. */
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    for (const attempt of [() => createImageBitmap(file, { imageOrientation: "from-image" }), () => createImageBitmap(file)]) {
      try {
        const bmp = await attempt();
        return { width: bmp.width, height: bmp.height, source: bmp, close: () => bmp.close() };
      } catch { /* try next */ }
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode(); // <img> applies EXIF orientation by default
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { width: img.naturalWidth, height: img.naturalHeight, source: img, close: () => URL.revokeObjectURL(url) };
}

/** Downscales and re-encodes a photo on-device so uploads stay small and cheap. */
export async function downscaleImage(
  file: Blob,
  maxEdge = 1568,
  quality = 0.8,
): Promise<{ blob: Blob; base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await decodeImage(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap.source, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { blob, base64: btoa(bin), mediaType: "image/jpeg" };
}
