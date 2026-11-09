import { useFetch } from '../hooks/useFetch';
import { getAttachment } from '../services/api';
import { isAudio, isImage } from '../utils/attachments';
import { AttachmentPreview } from './AttachmentPreview';
import { VoiceNotePlayer } from './VoiceNotePlayer';

/** La foto o el audio que respalda una versión de un registro. */
export function VersionAttachment({ subjectId, attachmentId }: { subjectId: number; attachmentId: number }) {
  const { data } = useFetch(() => getAttachment(subjectId, attachmentId), [subjectId, attachmentId]);
  if (!data) return null;
  if (isAudio(data)) return <VoiceNotePlayer note={data} />;
  return isImage(data) ? <AttachmentPreview subjectId={subjectId} attachmentId={attachmentId} /> : null;
}
