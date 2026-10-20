import {
  PaintStyle,
  Skia,
  StrokeJoin,
  matchFont,
  type SkCanvas,
} from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

export type Watermark = {
  text: string;
  opacity: number;
  layout: "tiled" | "corner";
};

export const MAX_WATERMARK_TEXT = 40;
export const MIN_OPACITY = 0.1;
export const DEFAULT_WATERMARK: Watermark = {
  text: "",
  opacity: 0.4,
  layout: "tiled",
};

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
  return watermark.text.trim().length > 0;
}

// Draws into a width × height area at the canvas's origin. Sizes are relative
// to the area, so the on-screen preview and the full-size export look the
// same. White text with a dark outline reads on both white slab shells and
// dark backgrounds.
export function drawWatermark(
  canvas: SkCanvas,
  width: number,
  height: number,
  watermark: Watermark,
) {
  const text = watermark.text.trim();
  if (!text) return;
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

  const textWidth = font.measureText(text).width;
  const { ascent, descent } = font.getMetrics();
  // (x, y) is the left end of the text's baseline.
  const stamp = (x: number, y: number) => {
    canvas.drawText(text, x, y, stroke, font);
    canvas.drawText(text, x, y, fill, font);
  };

  canvas.save();
  if (watermark.layout === "corner") {
    const pad = size * 0.7;
    stamp(width - pad - textWidth, height - pad - descent);
  } else {
    // Repeated diagonally across the whole photo so it can't be cropped out.
    canvas.translate(width / 2, height / 2);
    canvas.rotate(-30, 0, 0);
    const reach = Math.hypot(width, height) / 2;
    const stepX = textWidth + size * 2.5;
    const stepY = size * 3.5;
    // Centers each stamp on (x, y).
    const middle = -(ascent + descent) / 2;
    for (let row = 0, y = -reach; y <= reach; row++, y += stepY) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = -reach - offset; x <= reach + stepX; x += stepX) {
        stamp(x - textWidth / 2, y + middle);
      }
    }
  }
  canvas.restore();
}
