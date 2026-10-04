import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { Asset } from 'expo-media-library';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';

async function localFile(uri: string) {
  if (uri.startsWith('file://')) return uri;
  return (await File.downloadFileAsync(uri, new File(Paths.cache, `enhanced_${Date.now()}.png`))).uri;
}
export async function saveImage(uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not download image.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = 'enhanced.png'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  // Android 10+ saves app-owned media without broad library access.
  if (Platform.OS === 'android' && Number(Platform.Version) <= 28) {
    const permission = await MediaLibrary.requestPermissionsAsync(true, []);
    if (!permission.granted) throw new Error('Photo permission is required to save this image.');
  }
  const file = await localFile(uri);
  if (Platform.OS === 'android') await Asset.create(file);
  else await MediaLibrary.saveToLibraryAsync(file);
}
export async function shareImage(uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not download image.');
    const file = new window.File([await response.blob()], 'enhanced.png', { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) throw new Error('Image sharing is unavailable in this browser. Use Save instead.');
    await navigator.share({ files: [file] });
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  await Sharing.shareAsync(await localFile(uri), { mimeType: 'image/png', UTI: 'public.png' });
}
