import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export const imagePickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
  // El backend solo acepta JPEG y PNG: evita que iOS entregue HEIC
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export function imageFormData(asset: ImagePicker.ImagePickerAsset) {
  const form = new FormData();
  const type = asset.mimeType ?? 'image/jpeg';
  const name = asset.fileName ?? `documento.${type === 'image/png' ? 'png' : 'jpg'}`;
  if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, name);
  // En iOS y Android FormData recibe la ruta del archivo en lugar de un Blob
  else form.append('file', { uri: asset.uri, name, type } as unknown as Blob);
  return form;
}

export async function audioFormData(uri: string) {
  const form = new FormData();
  const name = `nota-de-voz-${Date.now()}`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    // El navegador agrega el códec ("audio/webm;codecs=opus") y el backend compara el tipo exacto
    const type = blob.type.split(';')[0];
    form.append('file', new Blob([blob], { type }), `${name}.${type === 'audio/mp4' ? 'm4a' : 'webm'}`);
  } else {
    form.append('file', { uri, name: `${name}.m4a`, type: 'audio/mp4' } as unknown as Blob);
  }
  return form;
}
