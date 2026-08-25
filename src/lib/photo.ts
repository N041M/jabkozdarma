import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Getting a photo of a tree, from the camera or the library.
 *
 * Both paths downscale on web before the image goes anywhere. A raw phone
 * photo as a multi-megabyte data URI blows the localStorage quota and freezes
 * serialization on every state change, and the camera path is the one most
 * likely to hand us a 12-megapixel original.
 */

/** Web-only: resize a picked image down to a phone-friendly JPEG data URI. */
async function downscale(uri: string, maxDim = 1280, quality = 0.72): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = uri;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale === 1 && uri.length < 400_000) return uri;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return uri; // worst case keep the original
  }
}

async function toStorableUri(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (Platform.OS !== 'web') return asset.uri;
  const source = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
  return downscale(source);
}

/** Pick an existing photo. Null if the picker was dismissed. */
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets[0]) return null;
  return toStorableUri(result.assets[0]);
}

/**
 * Shoot a new photo. Null if it was cancelled or the camera isn't available.
 *
 * **Call this straight out of a tap.** On web the camera is a file input with
 * `capture` set, and browsers only open one during a user gesture — anything
 * awaited first, a location prompt above all, spends the gesture and the
 * camera silently never opens. On a desktop browser `capture` is ignored and
 * this is an ordinary file browser, which is the right thing to degrade to.
 */
export async function capturePhoto(): Promise<string | null> {
  try {
    // Native asks for camera permission; on web that call is a no-op that
    // resolves granted, and awaiting anything at all before opening the input
    // is exactly what costs us the gesture. So don't.
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: Platform.OS === 'web',
      // `capture="environment"`: a tree is in front of you, not behind the
      // phone.
      cameraType: ImagePicker.CameraType.back,
    });
    if (result.canceled || !result.assets[0]) return null;
    return toStorableUri(result.assets[0]);
  } catch {
    // No camera, or the platform refused. The library picker still works.
    return null;
  }
}
