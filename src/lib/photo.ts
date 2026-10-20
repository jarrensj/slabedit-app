import { Skia, type SkImage } from "@shopify/react-native-skia";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { type ExportFormat } from "@/lib/slab-image";

export type Photo = {
  name: string;
  mimeType: string | null;
  image: SkImage;
};

export class PermissionDeniedError extends Error {}

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

// Opening the photo library needs no permission. On iOS, "compatible" hands
// HEIC photos over as JPEG.
export async function choosePhotoAsset() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return result.canceled ? null : result.assets[0];
}

export async function loadPhoto(
  asset: ImagePicker.ImagePickerAsset,
): Promise<Photo> {
  const data = await Skia.Data.fromURI(asset.uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error("Couldn't open that photo");
  const extension = asset.uri.split(".").pop()?.toLowerCase() ?? "";
  return {
    name: asset.fileName?.replace(/\.[^.]+$/, "") || "slab",
    mimeType: asset.mimeType ?? EXTENSION_TYPES[extension] ?? null,
    image,
  };
}

// The render goes through a temporary file in the cache directory, which is
// removed once it's been handed over.
async function writeTempFile(bytes: Uint8Array, name: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  return file;
}

export async function saveToPhotos(bytes: Uint8Array, name: string) {
  // Add-only access is all saving needs, and it's the lighter prompt on iOS.
  const { granted } = await MediaLibrary.requestPermissionsAsync(true, [
    "photo",
  ]);
  if (!granted) throw new PermissionDeniedError();
  const file = await writeTempFile(bytes, name);
  try {
    await MediaLibrary.Asset.create(file.uri);
  } finally {
    file.delete();
  }
}

export function canShare() {
  return Sharing.isAvailableAsync();
}

// Opens the share sheet (Save Image, Messages, AirDrop, …) with the file.
// The file isn't deleted afterwards, since the app it was shared to may still
// be reading it. It keeps the same name each time, so the cache holds at most
// one shared copy.
export async function sharePhoto(
  bytes: Uint8Array,
  name: string,
  format: ExportFormat,
) {
  const file = await writeTempFile(bytes, name);
  await Sharing.shareAsync(file.uri, {
    mimeType: format.mimeType,
    UTI: format.uti,
    dialogTitle: "Share photo",
  });
}

// Puts the photo on the clipboard, ready to paste into a listing or a chat.
export function copyPhoto(base64: string) {
  return Clipboard.setImageAsync(base64);
}
