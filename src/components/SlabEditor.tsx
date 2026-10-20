import { Canvas, Picture, createPicture } from "@shopify/react-native-skia";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ExportActions } from "@/components/ExportActions";
import { WatermarkSheet } from "@/components/WatermarkSheet";
import { choosePhotoAsset, loadPhoto, type Photo } from "@/lib/photo";
import {
  type Box,
  drawPhoto,
  exportFormat,
  moveBox,
  newBox,
  renderEdited,
  renderEditedBase64,
  resizeBox,
} from "@/lib/slab-image";
import { type Theme, useTheme } from "@/lib/theme";
import {
  type Watermark,
  drawWatermark,
  hasWatermark,
  useWatermark,
} from "@/lib/watermark";

type Size = { width: number; height: number };
type Fit = Size & { left: number; top: number };

// Room around the photo for the box controls, whose 44pt hit areas reach past
// the box's corners. Touches outside a parent view's bounds aren't delivered
// reliably on every platform, so the controls stay inside the stage.
const STAGE_PADDING = 24;
const HIT = 44;

function describeWatermark(watermark: Watermark) {
  const text = watermark.text.trim();
  if (watermark.image && text) return `logo + “${text}”`;
  return watermark.image ? "logo" : `“${text}”`;
}

// The largest size with the photo's aspect ratio that fits the stage.
function fitPhoto(photo: Size, stage: Size): Fit | null {
  const room = {
    width: stage.width - STAGE_PADDING * 2,
    height: stage.height - STAGE_PADDING * 2,
  };
  if (room.width <= 0 || room.height <= 0) return null;
  const scale = Math.min(room.width / photo.width, room.height / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  return {
    width,
    height,
    left: (stage.width - width) / 2,
    top: (stage.height - height) / 2,
  };
}

// Touch-responder props for dragging. The drag's starting point is kept in a
// ref set when the touch starts, so a re-render mid-drag doesn't lose it.
function useDrag(onStart: () => void, onDrag: (dx: number, dy: number) => void) {
  const origin = useRef({ x: 0, y: 0 });
  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      onStart();
    },
    onResponderMove: (e: GestureResponderEvent) => {
      onDrag(
        e.nativeEvent.pageX - origin.current.x,
        e.nativeEvent.pageY - origin.current.y,
      );
    },
  };
}

function BoxControls({
  box,
  fit,
  onChange,
  onRemove,
}: {
  box: Box;
  fit: Fit;
  onChange: (box: Box) => void;
  onRemove: () => void;
}) {
  const start = useRef(box);
  const onStart = () => {
    start.current = box;
  };
  const move = useDrag(onStart, (dx, dy) =>
    onChange(moveBox(start.current, dx / fit.width, dy / fit.height)),
  );
  const resize = useDrag(onStart, (dx, dy) =>
    onChange(resizeBox(start.current, dx / fit.width, dy / fit.height)),
  );

  const left = fit.left + box.x * fit.width;
  const top = fit.top + box.y * fit.height;
  const right = left + box.w * fit.width;
  const bottom = top + box.h * fit.height;

  return (
    <>
      <View
        {...move}
        accessibilityLabel="Black box. Drag to move it."
        style={[
          styles.box,
          { left, top, width: right - left, height: bottom - top },
        ]}
      />
      {/* The resize corner's hit area sits mostly outside the box, so
          grabbing near a corner still moves the box. */}
      <View
        {...resize}
        accessibilityLabel="Resize box"
        style={[styles.hit, { left: right - 12, top: bottom - 12 }]}
      >
        <View style={styles.handle} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove box"
        onPress={onRemove}
        style={[styles.hit, styles.center, { left: right - HIT / 2, top: top - HIT / 2 }]}
      >
        <View style={styles.remove}>
          <Text style={styles.removeText}>×</Text>
        </View>
      </Pressable>
    </>
  );
}

export function SlabEditor() {
  const theme = useTheme();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [stage, setStage] = useState<Size>({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const watermark = useWatermark();
  const [watermarkOn, setWatermarkOn] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Same object until the settings change.
  const activeWatermark =
    watermarkOn && hasWatermark(watermark) ? watermark : null;

  async function choosePhoto() {
    const asset = await choosePhotoAsset();
    if (!asset) return;
    setOpenFailed(false);
    setLoading(true);
    try {
      setPhoto(await loadPhoto(asset));
      setBoxes([newBox(0)]);
    } catch {
      setOpenFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function onStageLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setStage({ width, height });
  }

  if (!photo) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.screen, styles.empty, { backgroundColor: theme.background }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          Clean up a slab photo before you share it
        </Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Black out the serial number, then save the photo.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={choosePhoto}
          disabled={loading}
          style={({ pressed }) => [
            styles.chooser,
            { borderColor: theme.border },
            pressed && { opacity: 0.6 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              <Text style={[styles.chooserTitle, { color: theme.text }]}>
                Choose a slab photo
              </Text>
              <Text style={[styles.body, { color: theme.muted }]}>
                From your photo library
              </Text>
            </>
          )}
        </Pressable>
        {openFailed && <OpenFailed theme={theme} />}
        {/* So it can be set up before picking a photo. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheetOpen(true)}
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: theme.muted }]} numberOfLines={1}>
            {hasWatermark(watermark)
              ? `Watermark: ${describeWatermark(watermark)} · Edit`
              : "+ Add a watermark"}
          </Text>
        </Pressable>
        <WatermarkSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} photo={null} />
      </SafeAreaView>
    );
  }

  const size = { width: photo.image.width(), height: photo.image.height() };
  const fit = fitPhoto(size, stage);
  const format = exportFormat(photo.mimeType);

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.stage} onLayout={onStageLayout}>
        {fit && (
          <View
            style={[
              styles.photo,
              { left: fit.left, top: fit.top, width: fit.width, height: fit.height },
            ]}
          >
            <Canvas style={StyleSheet.absoluteFill}>
              <Picture
                picture={createPicture((canvas) => {
                  drawPhoto(canvas, photo.image, fit.width, fit.height);
                  if (activeWatermark) {
                    drawWatermark(canvas, fit.width, fit.height, activeWatermark);
                  }
                }, fit)}
              />
            </Canvas>
          </View>
        )}
        {fit &&
          boxes.map((box) => (
            <BoxControls
              key={box.id}
              box={box}
              fit={fit}
              onChange={(next) =>
                setBoxes((prev) => prev.map((b) => (b.id === next.id ? next : b)))
              }
              onRemove={() =>
                setBoxes((prev) => prev.filter((b) => b.id !== box.id))
              }
            />
          ))}
        {loading && (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator color={theme.text} />
          </View>
        )}
      </View>

      <View style={styles.dock}>
        <View style={styles.watermarkRow}>
          {hasWatermark(watermark) ? (
            <>
              <Switch
                value={watermarkOn}
                onValueChange={setWatermarkOn}
                accessibilityLabel="Watermark"
              />
              {watermark.image && (
                <Image
                  accessibilityIgnoresInvertColors
                  source={{ uri: `data:image/png;base64,${watermark.image}` }}
                  resizeMode="contain"
                  style={styles.logoThumb}
                />
              )}
              <Text style={[styles.watermarkText, { color: theme.text }]} numberOfLines={1}>
                Watermark{" "}
                {watermark.text.trim() ? (
                  <Text style={{ color: theme.muted }}>“{watermark.text.trim()}”</Text>
                ) : null}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSheetOpen(true)}
                style={styles.link}
              >
                <Text style={[styles.linkText, { color: theme.text }]}>Edit</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheetOpen(true)}
              style={styles.link}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>
                + Add a watermark
              </Text>
            </Pressable>
          )}
        </View>
        {openFailed ? (
          <OpenFailed theme={theme} />
        ) : (
          <Text style={[styles.hint, { color: theme.muted }]}>
            Drag the black box over the serial number, and drag its corner to
            resize it.
          </Text>
        )}
        <View style={styles.row}>
          <Button
            title="+ Add box"
            onPress={() => setBoxes((prev) => [...prev, newBox(prev.length)])}
            style={styles.grow}
          />
          <Button
            title="Change photo"
            onPress={choosePhoto}
            disabled={loading}
            style={styles.grow}
          />
        </View>
        <ExportActions
          render={() =>
            renderEdited(photo.image, boxes, format.format, activeWatermark)
          }
          renderBase64={() =>
            renderEditedBase64(photo.image, boxes, format.format, activeWatermark)
          }
          format={format}
          filename={`${photo.name}-edited`}
        />
      </View>
      <WatermarkSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        photo={photo.image}
      />
    </SafeAreaView>
  );
}

function OpenFailed({ theme }: { theme: Theme }) {
  return (
    <Text accessibilityRole="alert" style={[styles.hint, { color: theme.danger }]}>
      Couldn&apos;t open that photo. Try another one.
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 15, textAlign: "center" },
  chooser: {
    marginTop: 12,
    minHeight: 180,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 24,
  },
  chooserTitle: { fontSize: 17, fontWeight: "600" },
  stage: { flex: 1 },
  photo: { position: "absolute", borderRadius: 8, overflow: "hidden" },
  box: {
    position: "absolute",
    backgroundColor: "black",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  hit: { position: "absolute", width: HIT, height: HIT },
  handle: {
    position: "absolute",
    left: 5,
    top: 5,
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#18181b",
    backgroundColor: "white",
  },
  center: { alignItems: "center", justifyContent: "center" },
  remove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d4d4d8",
  },
  removeText: { fontSize: 16, lineHeight: 18, color: "#18181b" },
  dock: { gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  hint: { fontSize: 13, textAlign: "center" },
  watermarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 44,
  },
  watermarkText: { flexShrink: 1, fontSize: 14 },
  logoThumb: { width: 20, height: 20 },
  link: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 4 },
  linkText: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
  row: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
});
