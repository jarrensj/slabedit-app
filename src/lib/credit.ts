import {
  PaintStyle,
  Skia,
  StrokeJoin,
  matchFont,
  type SkCanvas,
} from "@shopify/react-native-skia";
import { Platform } from "react-native";

// Every export gets a small credit at the bottom center of the photo: the
// domain of EXPO_PUBLIC_BASE_URL (e.g. slabedit.com). It's drawn on the photo,
// so the export keeps its size. No URL set, no credit.
// TODO: let people pay to remove the credit. Taking payments will also need
// Terms of Service and Privacy Policy updates, and the App Store's and Google
// Play's rules for in-app purchases.
const CREDIT = process.env.EXPO_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "")
  .trim();

const FONT_FAMILY = Platform.select({
  ios: "Helvetica Neue",
  default: "sans-serif",
});

export function creditText() {
  return CREDIT || null;
}

// Draws into a width × height area at the canvas's origin. Sizes are relative
// to the area, like the watermark, so the on-screen preview and the full-size
// export look the same. The text stays within the bottom 3.9% of the shorter
// side, below where a corner watermark ends (its padding is 4.2%), so the two
// never overlap.
export function drawCredit(canvas: SkCanvas, width: number, height: number) {
  const text = creditText();
  if (!text) return;
  const size = Math.max(1, Math.round(Math.min(width, height) * 0.026));
  const font = matchFont({
    fontFamily: FONT_FAMILY,
    fontSize: size,
    fontWeight: "600",
  });
  // The watermark's look: white with a dark outline, so it reads on white
  // slab shells and dark backgrounds alike.
  const fill = Skia.Paint();
  fill.setColor(Skia.Color("white"));
  fill.setAlphaf(0.9);
  const stroke = Skia.Paint();
  stroke.setColor(Skia.Color("black"));
  stroke.setAlphaf(0.55 * 0.9);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeWidth(Math.max(1, size * 0.08));
  stroke.setStrokeJoin(StrokeJoin.Round);
  const { ascent, descent } = font.getMetrics();
  const x = (width - font.measureText(text).width) / 2;
  // Centered on height - size.
  const baseline = height - size - (ascent + descent) / 2;
  canvas.drawText(text, x, baseline, stroke, font);
  canvas.drawText(text, x, baseline, fill, font);
}
