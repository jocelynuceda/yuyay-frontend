import { useFetch } from '../../hooks/useFetch'
import { listAttachments } from '../../services/api/attachments'
import type { Attachment } from '../../types'

export function useAttachmentList(subjectId: number) {
  const list = useFetch((signal) => listAttachments(subjectId, signal), [subjectId])

  function applyChange(id: number, updated?: Attachment) {
    list.updateData((files) => updated
      ? files.map((file) => file.id === id ? updated : file)
      : files.filter((file) => file.id !== id))
    list.reload()
  }

  return { ...list, applyChange }
}
