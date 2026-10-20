import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import {
  PermissionDeniedError,
  canShare,
  saveToPhotos,
  sharePhoto,
} from "@/lib/photo";
import { type ExportFormat } from "@/lib/slab-image";
import { useTheme } from "@/lib/theme";

type Failure = { message: string; openSettings?: boolean };

// Lets "Saving…" / "Opening…" paint before the render, which runs on the JS
// thread.
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function ExportActions({
  render,
  format,
  filename,
}: {
  render: () => Uint8Array;
  format: ExportFormat;
  filename: string;
}) {
  const theme = useTheme();
  const [shareAvailable, setShareAvailable] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  // One full-size render at a time.
  const busy = sharing || saving;

  useEffect(() => {
    canShare().then(setShareAvailable);
  }, []);

  async function onShare() {
    if (busy) return;
    setFailure(null);
    setSharing(true);
    try {
      await nextFrame();
      await sharePhoto(render(), `${filename}.${format.ext}`, format);
    } catch {
      setFailure({ message: "Couldn't share the photo." });
    } finally {
      setSharing(false);
    }
  }

  async function onSave() {
    if (busy) return;
    setFailure(null);
    setSaving(true);
    try {
      await nextFrame();
      await saveToPhotos(render(), `${filename}.${format.ext}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setFailure(
        err instanceof PermissionDeniedError
          ? {
              message: "Allow slab edit to add photos to save it.",
              openSettings: true,
            }
          : { message: "Couldn't save the photo." },
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.column}>
      {shareAvailable && (
        <Button
          title={sharing ? "Opening…" : "Share"}
          onPress={onShare}
          disabled={busy}
        />
      )}
      <Button
        variant="primary"
        title={saving ? "Saving…" : saved ? "✓ Saved to Photos" : "Save to Photos"}
        onPress={onSave}
        disabled={busy}
      />
      {failure && (
        <View style={styles.failure} accessibilityRole="alert">
          <Text style={[styles.failureText, { color: theme.danger }]}>
            {failure.message}
          </Text>
          {failure.openSettings && (
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openSettings()}
              hitSlop={12}
            >
              <Text style={[styles.link, { color: theme.text }]}>
                Open Settings
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  failure: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  failureText: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
});
