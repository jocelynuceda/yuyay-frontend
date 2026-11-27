import type { ConfidenceLevel, HomeStackParamList } from '../types';
import { datePartsOf } from './dates.ts';
import type { OcrSuggestion } from './ocrSuggestions.ts';

type NewEntryParams = HomeStackParamList['NewEntry'];
export type EntryPrefill = NewEntryParams & {
  details?: string;
  ocrDraft?: { title?: string; occurredOn?: string; confidenceLevel: 'UNCERTAIN' };
};

/** El texto revisado se usa una sola vez, como valor inicial de Detalles. */
export function ocrEntryParams(
  subjectId: number,
  sourceAttachmentId: number,
  text: string,
  suggestion: OcrSuggestion,
): EntryPrefill {
  return {
    subjectId,
    sourceAttachmentId,
    categoryCode: suggestion.categoryCode,
    details: text.trim(),
    ocrDraft: {
      title: suggestion.title,
      occurredOn: suggestion.occurredOn,
      confidenceLevel: 'UNCERTAIN',
    },
  };
}

export function initialEntryFields({ categoryCode, details, ocrDraft }: EntryPrefill) {
  const confidenceLevel: ConfidenceLevel = ocrDraft?.confidenceLevel ?? 'CONFIRMED';
  return {
    categoryCode: categoryCode ?? (ocrDraft ? '' : 'MEDICATION'),
    title: ocrDraft?.title ?? '',
    details: details ?? '',
    confidenceLevel,
    dateParts: ocrDraft?.occurredOn ? datePartsOf(ocrDraft.occurredOn) : { day: '', month: '', year: '' },
  };
}
