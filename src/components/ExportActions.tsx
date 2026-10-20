import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { PermissionDeniedError, saveToPhotos } from "@/lib/photo";
import { type ExportFormat } from "@/lib/slab-image";
import { useTheme } from "@/lib/theme";

type Failure = { message: string; openSettings?: boolean };

// Lets "Saving…" paint before the render, which runs on the JS thread.
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function onSave() {
    if (saving) return;
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
      <Button
        variant="primary"
        title={saving ? "Saving…" : saved ? "✓ Saved to Photos" : "Save to Photos"}
        onPress={onSave}
        disabled={saving}
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
