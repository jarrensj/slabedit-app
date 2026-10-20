import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

// At least 48pt tall, so it's an easy thumb target.
export function Button({
  title,
  onPress,
  variant = "secondary",
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.primary }
          : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
    >
      <Text
        style={[styles.title, { color: primary ? theme.onPrimary : theme.text }]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "600" },
  dimmed: { opacity: 0.5 },
});
