import {
  Canvas,
  ClipOp,
  Picture,
  Skia,
  createPicture,
  type SkCanvas,
  type SkImage,
} from "@shopify/react-native-skia";
import { useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Slider } from "@/components/Slider";
import { choosePhotoAsset } from "@/lib/photo";
import { drawPhoto } from "@/lib/slab-image";
import { type Theme, useTheme } from "@/lib/theme";
import {
  DEFAULT_WATERMARK,
  MAX_WATERMARK_TEXT,
  MIN_OPACITY,
  type Watermark,
  drawWatermark,
  hasWatermark,
  logoFromUri,
  saveWatermark,
  useWatermark,
} from "@/lib/watermark";

const PREVIEW_HEIGHT = 200;
// A slab's proportions, for the stand-in before a photo is picked.
const SLAB_ASPECT = 3 / 4;
const LAYOUTS: { value: Watermark["layout"]; label: string }[] = [
  { value: "tiled", label: "Tiled" },
  { value: "corner", label: "Corner" },
];

// A slab-shaped stand-in: a shell with a label band across the top.
function drawStandIn(canvas: SkCanvas, width: number, height: number) {
  const shell = Skia.Paint();
  shell.setColor(Skia.Color("#d4d4d8"));
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), 8, 8), shell);
  const label = Skia.Paint();
  label.setColor(Skia.Color("#a1a1aa"));
  canvas.drawRect(Skia.XYWHRect(width * 0.08, height * 0.06, width * 0.84, height * 0.16), label);
}

// The current photo (or the stand-in) with the watermark, drawn with the same
// functions as the export.
function Preview({ photo, watermark }: { photo: SkImage | null; watermark: Watermark }) {
  const [width, setWidth] = useState(0);
  const aspect = photo ? photo.width() / photo.height() : SLAB_ASPECT;
  const h = Math.min(PREVIEW_HEIGHT, width / aspect);
  const w = h * aspect;
  const left = (width - w) / 2;
  const top = (PREVIEW_HEIGHT - h) / 2;
  return (
    <View
      style={styles.preview}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture
            picture={createPicture((canvas) => {
              canvas.save();
              canvas.translate(left, top);
              canvas.clipRect(Skia.XYWHRect(0, 0, w, h), ClipOp.Intersect, true);
              if (photo) drawPhoto(canvas, photo, w, h);
              else drawStandIn(canvas, w, h);
              drawWatermark(canvas, w, h, watermark);
              canvas.restore();
            })}
          />
        </Canvas>
      )}
    </View>
  );
}

function Label({ theme, children, detail }: { theme: Theme; children: string; detail?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: theme.muted }]}>{children}</Text>
      {detail && <Text style={[styles.detail, { color: theme.muted }]}>{detail}</Text>}
    </View>
  );
}

// A quick shrink when Backspace is pressed on an already empty field, so the
// key press still gets a visible response.
function useEmptyBackspaceNudge(empty: boolean) {
  const [scale] = useState(() => new Animated.Value(1));
  async function onKeyPress(key: string) {
    if (key !== "Backspace" || !empty) return;
    if (await AccessibilityInfo.isReduceMotionEnabled()) return;
    const step = (toValue: number) =>
      Animated.timing(scale, {
        toValue,
        duration: 150,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    scale.setValue(1);
    Animated.sequence([step(0.95), step(1)]).start();
  }
  return { scale, onKeyPress };
}

// Watermark settings, kept out of the editor itself: most people set this
// once. Changes save as they're made.
export function WatermarkSheet({
  visible,
  onClose,
  photo,
}: {
  visible: boolean;
  onClose: () => void;
  photo: SkImage | null;
}) {
  const theme = useTheme();
  const watermark = useWatermark();
  const opacity = Math.round(watermark.opacity * 100);
  const update = (patch: Partial<Watermark>) => saveWatermark({ ...watermark, ...patch });
  const nudge = useEmptyBackspaceNudge(watermark.text.length === 0);
  const [addingLogo, setAddingLogo] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  async function chooseLogo() {
    const asset = await choosePhotoAsset();
    if (!asset) return;
    setLogoFailed(false);
    setAddingLogo(true);
    try {
      update({ image: await logoFromUri(asset.uri) });
    } catch {
      setLogoFailed(true);
    } finally {
      setAddingLogo(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
                Watermark
              </Text>
              <Text style={[styles.body, { color: theme.muted }]}>
                Text, a logo, or both. Saved on this device and added to every
                photo you save; switch it off for a single photo.
              </Text>
            </View>

            <Preview photo={photo} watermark={watermark} />

            <View style={styles.field}>
              <Label theme={theme} detail={`${watermark.text.length}/${MAX_WATERMARK_TEXT}`}>
                TEXT
              </Label>
              <Animated.View style={{ transform: [{ scale: nudge.scale }] }}>
                <TextInput
                  value={watermark.text}
                  onChangeText={(text) => update({ text })}
                  onKeyPress={(e) => nudge.onKeyPress(e.nativeEvent.key)}
                  maxLength={MAX_WATERMARK_TEXT}
                  placeholder="Your shop or handle"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  accessibilityLabel="Watermark text"
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </Animated.View>
            </View>

            <View style={styles.field}>
              <Label theme={theme}>LOGO</Label>
              <View style={styles.logoRow}>
                {watermark.image && (
                  <Image
                    accessibilityLabel="Logo"
                    source={{ uri: `data:image/png;base64,${watermark.image}` }}
                    resizeMode="contain"
                    style={[styles.logo, { borderColor: theme.border }]}
                  />
                )}
                <Button
                  title={
                    addingLogo
                      ? "Adding…"
                      : watermark.image
                        ? "Change logo"
                        : "Upload a logo"
                  }
                  onPress={chooseLogo}
                  disabled={addingLogo}
                  style={styles.grow}
                />
                {watermark.image && (
                  <Button
                    title="Remove logo"
                    onPress={() => update({ image: null })}
                    style={styles.grow}
                  />
                )}
              </View>
              {logoFailed && (
                <Text accessibilityRole="alert" style={[styles.detail, { color: theme.danger }]}>
                  Couldn&apos;t open that image. Try a PNG or JPG.
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Label theme={theme} detail={`${opacity}%`}>
                OPACITY
              </Label>
              <Slider
                value={watermark.opacity}
                min={MIN_OPACITY}
                max={1}
                onChange={(value) => update({ opacity: Math.round(value * 100) / 100 })}
                accessibilityLabel="Watermark opacity"
                accessibilityValueText={`${opacity}%`}
              />
            </View>

            <View style={styles.field}>
              <Label theme={theme}>LAYOUT</Label>
              <View
                accessibilityRole="radiogroup"
                style={[styles.segments, { borderColor: theme.border }]}
              >
                {LAYOUTS.map(({ value, label }) => {
                  const selected = watermark.layout === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => update({ layout: value })}
                      style={[styles.segment, selected && { backgroundColor: theme.primary }]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: selected ? theme.onPrimary : theme.muted },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.actions, { borderColor: theme.border }]}>
            <Button
              title="Remove"
              onPress={() => saveWatermark(DEFAULT_WATERMARK)}
              disabled={!hasWatermark(watermark)}
              style={styles.grow}
            />
            <Button variant="primary" title="Done" onPress={onClose} style={styles.grow} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { padding: 20, gap: 20 },
  header: { gap: 6 },
  title: { fontSize: 20, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 20 },
  preview: { height: PREVIEW_HEIGHT },
  field: { gap: 8 },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6 },
  detail: { fontSize: 13 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 48, height: 48, borderWidth: 1, borderRadius: 8 },
  segments: { flexDirection: "row", borderWidth: 1, borderRadius: 11, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
});
