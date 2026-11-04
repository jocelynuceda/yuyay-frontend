import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

/** A 128 kbps son unos 5 MB, por debajo del límite de 10 MB del backend. */
const MAX_RECORDING_MS = 5 * 60 * 1000;

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder, 250);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
    return () => {
      if (limitTimer.current) clearTimeout(limitTimer.current);
    };
  }, []);

  async function stop() {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    await recorder.stop();
    // Con la grabación activa iOS saca el audio por el auricular y no por el altavoz
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setUri(recorder.uri);
  }

  async function start() {
    setError(null);
    setUri(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError('Activa el permiso de micrófono en los ajustes del celular para grabar.');
      return false;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      limitTimer.current = setTimeout(() => void stop(), MAX_RECORDING_MS);
      return true;
    } catch {
      setError('No pudimos iniciar la grabación.');
      return false;
    }
  }

  return {
    isRecording: recording.isRecording,
    seconds: recording.durationMillis / 1000,
    uri,
    error,
    start,
    stop,
    discard: () => setUri(null),
  };
}

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;
