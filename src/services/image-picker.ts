import * as ImagePicker from 'expo-image-picker';
import type { ImageAsset } from '../types';

function assetFromResult(result: ImagePicker.ImagePickerResult): Partial<ImageAsset> | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType || 'image/jpeg')) throw new Error('Choose a still JPEG, PNG or WebP photo.');
  if (asset.fileSize && asset.fileSize > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB.');
  return { uri: asset.uri, originalFilename: asset.fileName || 'photo.jpg', mimeType: asset.mimeType || 'image/jpeg', width: asset.width, height: asset.height, fileSize: asset.fileSize };
}
export const ImagePickerService = {
  async pickImage() {
    return assetFromResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }));
  },
  async takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission is required to take a photo.');
    return assetFromResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
  },
};
