import type { AxiosInstance } from 'axios';
import { MAX_ATTACHMENT_BYTES } from './attachmentUpload.ts';

/** Descarga con la sesión de la API. Image recibe los bytes y evita otra petición HTTP. */
export async function loadAndroidPreviewImage(
  client: AxiosInstance, path: string, signal: AbortSignal,
) {
  const { data } = await client.get<Blob & { close?: () => void }>(path, {
    responseType: 'blob', timeout: 60000, signal,
  });
  try {
    if (!data.size || data.size > MAX_ATTACHMENT_BYTES || signal.aborted) {
      throw new Error('Imagen no disponible.');
    }
    const uri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result) : reject(new Error('Imagen no disponible.'));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(data);
    });
    return { uri };
  } finally {
    data.close?.();
  }
}
