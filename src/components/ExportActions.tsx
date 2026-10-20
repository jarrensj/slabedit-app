import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import {
  PermissionDeniedError,
  canShare,
  copyPhoto,
  saveToPhotos,
  sharePhoto,
} from "@/lib/photo";
import { type ExportFormat } from "@/lib/slab-image";
import { useTheme } from "@/lib/theme";

type Failure = { message: string; openSettings?: boolean };

// Lets "Copying…" / "Opening…" / "Saving…" paint before the render, which runs
// on the JS thread.
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function ExportActions({
  render,
  renderBase64,
  format,
  filename,
}: {
  render: () => Uint8Array;
  renderBase64: () => string;
  format: ExportFormat;
  filename: string;
}) {
  const theme = useTheme();
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareAvailable, setShareAvailable] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  // One full-size render at a time.
  const busy = copying || sharing || saving;

  useEffect(() => {
    canShare().then(setShareAvailable);
  }, []);

  async function onCopy() {
    if (busy) return;
    setFailure(null);
    setCopying(true);
    try {
      await nextFrame();
      await copyPhoto(renderBase64());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailure({ message: "Couldn't copy the photo." });
    } finally {
      setCopying(false);
    }
  }

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
      <View style={styles.row}>
        <Button
          title={copying ? "Copying…" : copied ? "✓ Copied" : "Copy"}
          onPress={onCopy}
          disabled={busy}
          style={styles.grow}
        />
        {shareAvailable && (
          <Button
            title={sharing ? "Opening…" : "Share"}
            onPress={onShare}
            disabled={busy}
            style={styles.grow}
          />
        )}
      </View>
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
  row: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
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
