import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeJoin,
  matchFont,
  type SkCanvas,
  type SkImage,
} from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

export type Watermark = {
  text: string;
  // The logo as base64 PNG, or null.
  image: string | null;
  opacity: number;
  layout: "tiled" | "corner";
};

export const MAX_WATERMARK_TEXT = 40;
export const MIN_OPACITY = 0.1;
export const DEFAULT_WATERMARK: Watermark = {
  text: "",
  image: null,
  opacity: 0.4,
  layout: "tiled",
};

// Big enough to stay sharp on a full-size export, small enough to store.
const MAX_LOGO_SIZE = 512;

const FONT_FAMILY = Platform.select({
  ios: "Helvetica Neue",
  default: "sans-serif",
});

// The watermark is set once and reused for every photo, so it's kept in a
// small file in the app's documents. It never leaves the device.
// TODO: once there's a Privacy Policy, mention that the watermark settings are
// kept on the device (never sent anywhere).
function settingsFile() {
  return new File(Paths.document, "watermark.json");
}

function parse(raw: string | null): Watermark {
  if (!raw) return DEFAULT_WATERMARK;
  try {
    const value = JSON.parse(raw);
    return {
      text:
        typeof value.text === "string"
          ? value.text.slice(0, MAX_WATERMARK_TEXT)
          : "",
      image:
        typeof value.image === "string" && value.image.length > 0
          ? value.image
          : null,
      opacity:
        typeof value.opacity === "number"
          ? Math.min(Math.max(value.opacity, MIN_OPACITY), 1)
          : DEFAULT_WATERMARK.opacity,
      layout: value.layout === "corner" ? "corner" : "tiled",
    };
  } catch {
    return DEFAULT_WATERMARK;
  }
}

let current: Watermark | undefined;
const listeners = new Set<() => void>();

// Read once, then served from memory. Returns the same object until the
// settings change, as useSyncExternalStore requires.
function read(): Watermark {
  if (current === undefined) {
    try {
      const file = settingsFile();
      current = parse(file.exists ? file.textSync() : null);
    } catch {
      current = DEFAULT_WATERMARK;
    }
  }
  return current;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useWatermark() {
  return useSyncExternalStore(subscribe, read, read);
}

// Writes go one at a time, always with the latest settings, so a burst of
// changes (typing) can't land out of order.
let pending: Watermark | null = null;
let writing = false;

async function persist(value: Watermark) {
  pending = value;
  if (writing) return;
  writing = true;
  while (pending) {
    const next = pending;
    pending = null;
    try {
      const file = settingsFile();
      file.create({ overwrite: true });
      await file.write(JSON.stringify(next));
    } catch {
      // Still applies for this session, just not saved for the next one.
    }
  }
  writing = false;
}

export function saveWatermark(next: Watermark) {
  current = next;
  for (const listener of listeners) listener();
  persist(next);
}

export function hasWatermark(watermark: Watermark) {
  return watermark.text.trim().length > 0 || !!watermark.image;
}

// Shrinks a picked logo to fit MAX_LOGO_SIZE and re-encodes it as PNG, which
// keeps any transparency.
export async function logoFromUri(uri: string): Promise<string> {
  const source = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!source) throw new Error("Couldn't open that image");
  const scale = Math.min(
    1,
    MAX_LOGO_SIZE / Math.max(source.width(), source.height()),
  );
  const width = Math.max(1, Math.round(source.width() * scale));
  const height = Math.max(1, Math.round(source.height() * scale));
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error("Couldn't open that image");
  let snapshot: SkImage | null = null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color("transparent"));
    canvas.drawImageRectOptions(
      source,
      Skia.XYWHRect(0, 0, source.width(), source.height()),
      Skia.XYWHRect(0, 0, width, height),
      FilterMode.Linear,
      MipmapMode.Linear,
      null,
    );
    surface.flush();
    snapshot = surface.makeImageSnapshot();
    return snapshot.encodeToBase64(ImageFormat.PNG);
  } finally {
    snapshot?.dispose();
    surface.dispose();
    source.dispose();
  }
}

// Decoded once per logo, not on every redraw.
let logoCache: { data: string; image: SkImage | null } | null = null;

function logoImage(watermark: Watermark): SkImage | null {
  if (!watermark.image) return null;
  if (logoCache?.data !== watermark.image) {
    logoCache = {
      data: watermark.image,
      image: Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(watermark.image)),
    };
  }
  return logoCache.image;
}

// Draws into a width × height area at the canvas's origin. Sizes are relative
// to the area, so the on-screen preview and the full-size export look the
// same. The logo and the text form one stamp: [logo] text. White text with a
// dark outline reads on both white slab shells and dark backgrounds.
export function drawWatermark(
  canvas: SkCanvas,
  width: number,
  height: number,
  watermark: Watermark,
) {
  const text = watermark.text.trim();
  const logo = logoImage(watermark);
  if (!text && !logo) return;
  const size = Math.max(10, Math.round(Math.min(width, height) * 0.06));
  const font = matchFont({
    fontFamily: FONT_FAMILY,
    fontSize: size,
    fontWeight: "600",
  });
  const fill = Skia.Paint();
  fill.setColor(Skia.Color("white"));
  fill.setAlphaf(watermark.opacity);
  const stroke = Skia.Paint();
  stroke.setColor(Skia.Color("black"));
  stroke.setAlphaf(0.55 * watermark.opacity);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeWidth(Math.max(1, size * 0.08));
  stroke.setStrokeJoin(StrokeJoin.Round);
  const logoPaint = Skia.Paint();
  logoPaint.setAlphaf(watermark.opacity);

  // A logo on its own gets a bit more room than one next to text. Very wide
  // logos are capped so a corner mark doesn't take over the photo.
  let logoHeight = logo ? size * (text ? 1.6 : 2.4) : 0;
  let logoWidth = logo ? (logo.width() / logo.height()) * logoHeight : 0;
  if (logoWidth > size * 5) {
    logoHeight *= (size * 5) / logoWidth;
    logoWidth = size * 5;
  }
  const gap = logo && text ? size * 0.4 : 0;
  const textWidth = text ? font.measureText(text).width : 0;
  const stampWidth = logoWidth + gap + textWidth;
  const stampHeight = Math.max(logoHeight, size * 1.2);
  const { ascent, descent } = font.getMetrics();

  // (x, y) is the stamp's center.
  const stamp = (x: number, y: number) => {
    const left = x - stampWidth / 2;
    if (logo) {
      canvas.drawImageRectOptions(
        logo,
        Skia.XYWHRect(0, 0, logo.width(), logo.height()),
        Skia.XYWHRect(left, y - logoHeight / 2, logoWidth, logoHeight),
        FilterMode.Linear,
        MipmapMode.Linear,
        logoPaint,
      );
    }
    if (text) {
      const baseline = y - (ascent + descent) / 2;
      canvas.drawText(text, left + logoWidth + gap, baseline, stroke, font);
      canvas.drawText(text, left + logoWidth + gap, baseline, fill, font);
    }
  };

  canvas.save();
  if (watermark.layout === "corner") {
    const pad = size * 0.7;
    stamp(width - pad - stampWidth / 2, height - pad - stampHeight / 2);
  } else {
    // Repeated diagonally across the whole photo so it can't be cropped out.
    canvas.translate(width / 2, height / 2);
    canvas.rotate(-30, 0, 0);
    const reach = Math.hypot(width, height) / 2;
    const stepX = stampWidth + size * 2.5;
    const stepY = stampHeight + size * 2.3;
    for (let row = 0, y = -reach; y <= reach; row++, y += stepY) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = -reach - offset; x <= reach + stepX; x += stepX) {
        stamp(x, y);
      }
    }
  }
  canvas.restore();
}
