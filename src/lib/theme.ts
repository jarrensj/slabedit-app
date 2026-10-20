import { useColorScheme } from "react-native";

const LIGHT = {
  background: "#ffffff",
  text: "#171717",
  muted: "#737373",
  border: "#d4d4d4",
  primary: "#171717",
  onPrimary: "#ffffff",
  danger: "#dc2626",
};

const DARK: typeof LIGHT = {
  background: "#0a0a0a",
  text: "#ededed",
  muted: "#a3a3a3",
  border: "#404040",
  primary: "#ededed",
  onPrimary: "#0a0a0a",
  danger: "#f87171",
};

export type Theme = typeof LIGHT;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
