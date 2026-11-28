export type SourceOrigin = 's3' | 'api';
type Source = { uri: string; headers?: Record<string, string> };

type PreviewState =
  | { status: 'loading'; origin: SourceOrigin }
  | { status: 'ready'; origin: SourceOrigin; source: Source }
  | { status: 'failed'; origin: 'api' };

type PreviewEvent =
  | { type: 'loaded'; origin: SourceOrigin; source: Source }
  | { type: 'error'; origin: SourceOrigin };

export function attachmentPreviewState(state: PreviewState, event: PreviewEvent): PreviewState {
  if (state.origin !== event.origin || state.status === 'failed') return state;
  if (event.type === 'loaded') return { status: 'ready', origin: event.origin, source: event.source };
  return event.origin === 's3' ? { status: 'loading', origin: 'api' } : { status: 'failed', origin: 'api' };
}
