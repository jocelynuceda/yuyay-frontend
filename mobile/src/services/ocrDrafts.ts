import type { EntryPrefill } from '../utils/ocrEntryDraft';
import { createSubjectDrafts } from '../utils/subjectDrafts';
import { subjectAccess } from './api';

export const ocrDrafts = createSubjectDrafts<EntryPrefill>(subjectAccess);
