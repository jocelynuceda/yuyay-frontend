import type { DocumentPickerAsset } from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';
import { getAttachmentAccess, getAttachmentSource } from './api';
import { appendAttachment, attachmentMimeType } from './attachmentUpload';

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

/** PDF o imagen elegidos en Archivos. Valida tipo y tamaño (máx. 10 MB) antes de subir. */
export function documentFormData(asset: DocumentPickerAsset) {
  const form = new FormData();
  appendAttachment(
    form,
    {
      uri: asset.uri,
      name: asset.name,
      mimeType: attachmentMimeType(asset.name, asset.mimeType),
      size: asset.size,
      file: asset.file,
    },
    Platform.OS === 'web' ? 'web' : 'native',
  );
  return form;
}

/**
 * Abre el archivo original (sobre todo PDF) en el visor del sistema con el enlace temporal de S3.
 * En web, si el backend guarda en disco (dev) y no hay enlace, se abre la descarga de /content.
 */
export async function openAttachmentFile(subjectId: number, attachmentId: number) {
  // La pestaña se abre en el mismo clic para que Safari no la bloquee
  const tab = Platform.OS === 'web' ? globalThis.open('', '_blank') : null;
  try {
    let url: string;
    try {
      url = (await getAttachmentAccess(subjectId, attachmentId)).url;
    } catch (e) {
      if (Platform.OS !== 'web') throw e;
      url = (await getAttachmentSource(subjectId, attachmentId)).uri;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      await Linking.openURL(url);
    }
  } catch (e) {
    tab?.close();
    throw e;
  }
}
