import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  type SkCanvas,
  type SkImage,
} from "@shopify/react-native-skia";
import { drawCredit } from "@/lib/credit";
import { type Watermark, drawWatermark } from "@/lib/watermark";

// A black box as fractions of the photo's width/height, so it is independent
// of how large the preview renders and maps straight onto the full-size
// export.
export type Box = { id: number; x: number; y: number; w: number; h: number };

export const MIN_BOX_FRACTION = 0.02;

// Keeps the full-size render's memory bounded (a 24MP photo is scaled down
// just enough to fit).
const MAX_PIXELS = 16_777_216;
const JPEG_QUALITY = 92;

let nextBoxId = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Slab labels sit across the top of the slab, so new boxes start up there —
// each one a little lower than the last so they don't stack.
export function newBox(index: number): Box {
  const w = 0.4;
  const h = 0.08;
  return {
    id: nextBoxId++,
    x: (1 - w) / 2,
    y: Math.min(0.1 + index * 0.1, 1 - h),
    w,
    h,
  };
}

export function moveBox(box: Box, dx: number, dy: number): Box {
  return {
    ...box,
    x: clamp(box.x + dx, 0, 1 - box.w),
    y: clamp(box.y + dy, 0, 1 - box.h),
  };
}

export function resizeBox(box: Box, dw: number, dh: number): Box {
  return {
    ...box,
    w: clamp(box.w + dw, MIN_BOX_FRACTION, 1 - box.x),
    h: clamp(box.h + dh, MIN_BOX_FRACTION, 1 - box.y),
  };
}

export type ExportFormat = {
  format: ImageFormat;
  mimeType: string;
  ext: string;
  uti: string;
};

// JPEG photos stay JPEG: a PNG of a 12MP phone photo is several times larger
// and can blow past upload limits. The picker hands HEIC photos over as JPEG.
// Anything else may have transparency, so it becomes PNG.
export function exportFormat(mimeType: string | null | undefined): ExportFormat {
  return mimeType === "image/jpeg"
    ? { format: ImageFormat.JPEG, mimeType: "image/jpeg", ext: "jpg", uti: "public.jpeg" }
    : { format: ImageFormat.PNG, mimeType: "image/png", ext: "png", uti: "public.png" };
}

// Draws the photo scaled into a width × height area at the canvas's origin.
// The preview and the export both draw through here, so they match.
export function drawPhoto(
  canvas: SkCanvas,
  image: SkImage,
  width: number,
  height: number,
) {
  const paint = Skia.Paint();
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, width, height),
    FilterMode.Linear,
    MipmapMode.Linear,
    paint,
  );
}

export function drawBoxes(
  canvas: SkCanvas,
  boxes: Box[],
  width: number,
  height: number,
) {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color("black"));
  paint.setAntiAlias(false);
  for (const box of boxes) {
    // Round outward so no anti-aliased sliver of the serial survives at the
    // box's edges.
    const x0 = Math.floor(box.x * width);
    const y0 = Math.floor(box.y * height);
    const x1 = Math.ceil((box.x + box.w) * width);
    const y1 = Math.ceil((box.y + box.h) * height);
    canvas.drawRect(Skia.XYWHRect(x0, y0, x1 - x0, y1 - y0), paint);
  }
}

// Renders the full-size photo with the boxes painted into the pixels, then
// encodes it. Re-encoding also drops the photo's metadata, including any GPS
// location.
function render<T>(
  image: SkImage,
  boxes: Box[],
  watermark: Watermark | null,
  encode: (snapshot: SkImage) => T,
): T {
  const scale = Math.min(
    1,
    Math.sqrt(MAX_PIXELS / (image.width() * image.height())),
  );
  const width = Math.floor(image.width() * scale);
  const height = Math.floor(image.height() * scale);
  // A CPU surface: no GPU texture size limits, and nothing to wait on.
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error("Couldn't render image");
  try {
    const canvas = surface.getCanvas();
    drawPhoto(canvas, image, width, height);
    // Under the boxes, so a box always covers what it hides completely.
    if (watermark) drawWatermark(canvas, width, height, watermark);
    drawBoxes(canvas, boxes, width, height);
    // Over the boxes, so a box can't hide it.
    drawCredit(canvas, width, height);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return encode(snapshot);
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}

export function renderEdited(
  image: SkImage,
  boxes: Box[],
  format: ImageFormat,
  watermark: Watermark | null,
): Uint8Array {
  return render(image, boxes, watermark, (s) =>
    s.encodeToBytes(format, JPEG_QUALITY),
  );
}

// For the clipboard, which takes base64.
export function renderEditedBase64(
  image: SkImage,
  boxes: Box[],
  format: ImageFormat,
  watermark: Watermark | null,
): string {
  return render(image, boxes, watermark, (s) =>
    s.encodeToBase64(format, JPEG_QUALITY),
  );
}
