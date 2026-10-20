import { Stack } from "expo-router";
import { SlabEditor } from "@/components/SlabEditor";

// TODO: rename the app from "my-app" to "slab edit" in app.json (name, slug,
// scheme), so the home screen and the permission prompts use the same name.
export default function Index() {
  return (
    <>
      <Stack.Screen options={{ title: "slab edit" }} />
      <SlabEditor />
    </>
  );
}
