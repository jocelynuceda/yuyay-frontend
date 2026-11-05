import { Platform } from 'react-native';
import type { Attachment, AttachmentAccess } from '../types';
import { appendAttachment, attachmentUploadOptions, type AttachmentFile } from './attachmentUpload';
import { http } from './http';

const path = (subjectId: number) => `/care-subjects/${subjectId}/attachments`;

export const getAttachments = (subjectId: number) => http.get<Attachment[]>(path(subjectId)).then((r) => r.data);

export function uploadAttachment(subjectId: number, file: AttachmentFile) {
  const body = new FormData();
  appendAttachment(body, file, Platform.OS === 'web' ? 'web' : 'native');
  return http.post<Attachment>(path(subjectId), body, attachmentUploadOptions).then((r) => r.data);
}

export const getAttachmentAccess = (subjectId: number, id: number) =>
  http.get<AttachmentAccess>(`${path(subjectId)}/${id}/access`).then((r) => r.data);

export const deleteAttachment = (subjectId: number, id: number) => http.delete(`${path(subjectId)}/${id}`);

export const retryAttachmentOcr = (subjectId: number, id: number) =>
  http.post<Attachment>(`${path(subjectId)}/${id}/ocr-retry`).then((r) => r.data);
