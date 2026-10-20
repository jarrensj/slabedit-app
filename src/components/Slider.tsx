import { useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useTheme } from "@/lib/theme";

const KNOB = 24;
// What a screen reader's swipe up/down changes the value by.
const A11Y_STEP = 0.05;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// A horizontal slider: drag the knob or tap the track. 44pt tall for thumbs,
// and adjustable with a screen reader's swipe up/down.
export function Slider({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
  accessibilityValueText,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  accessibilityValueText: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  // Where the touch started, in the track's coordinates and on the page, so
  // moves stay accurate even when the finger leaves the track.
  const grant = useRef({ x: 0, pageX: 0 });
  const travel = Math.max(1, width - KNOB);
  const fraction = (clamp(value, min, max) - min) / (max - min);

  function valueAt(x: number) {
    return clamp(min + ((x - KNOB / 2) / travel) * (max - min), min, max);
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: accessibilityValueText }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        onChange(
          clamp(
            value + (e.nativeEvent.actionName === "increment" ? A11Y_STEP : -A11Y_STEP),
            min,
            max,
          ),
        )
      }
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e: GestureResponderEvent) => {
        grant.current = { x: e.nativeEvent.locationX, pageX: e.nativeEvent.pageX };
        onChange(valueAt(e.nativeEvent.locationX));
      }}
      onResponderMove={(e: GestureResponderEvent) =>
        onChange(valueAt(grant.current.x + e.nativeEvent.pageX - grant.current.pageX))
      }
      style={styles.slider}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.fill,
            { width: KNOB / 2 + fraction * travel, backgroundColor: theme.text },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.knob, { left: fraction * travel }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slider: { height: 44, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4 },
  knob: {
    position: "absolute",
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: "white",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#a1a1aa",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
