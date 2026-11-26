export interface HandoffAccessCodeResponse {
  code: string | null;
  consumed: boolean;
  expiresAt: string;
  serverTime: string;
  periodSeconds: number;
}

export interface AccessCodeState {
  phase: 'paused' | 'loading' | 'ready' | 'waiting' | 'error';
  code: string | null;
  consumed: boolean;
  secondsRemaining: number;
  progress: number;
}

/** Sólo presenta códigos del servidor. El reloj local de calendario no participa. */
export function createHandoffAccessCode(
  fetchCode: (signal: AbortSignal) => Promise<HandoffAccessCodeResponse>,
  now: () => number = () => performance.now(),
  scheduleExpiry: (callback: () => void, delay: number) => () => void = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  },
) {
  let state: AccessCodeState = { phase: 'paused', code: null, consumed: false, secondsRemaining: 0, progress: 0 };
  let active = false;
  let generation = 0;
  let deadline = 0;
  let controller: AbortController | null = null;
  let cancelExpiry: (() => void) | null = null;
  let staleRetries = 0;
  const listeners = new Set<() => void>();
  const update = (next: AccessCodeState) => { state = next; listeners.forEach((listener) => listener()); };
  const clear = (phase: AccessCodeState['phase']) => update({ phase, code: null, consumed: false, secondsRemaining: 0, progress: 0 });

  async function reload(resetStaleRetries = true) {
    if (!active) return;
    if (resetStaleRetries) staleRetries = 0;
    cancelExpiry?.();
    cancelExpiry = null;
    controller?.abort();
    controller = new AbortController();
    const current = ++generation;
    const startedAt = now();
    clear('loading');
    try {
      const result = await fetchCode(controller.signal);
      if (!active || current !== generation) return;
      const lifetime = Date.parse(result.expiresAt) - Date.parse(result.serverTime);
      // Se resta conservadoramente todo el viaje de red para no mostrar un código vencido.
      deadline = startedAt + lifetime;
      const remaining = deadline - now();
      const validCode = result.consumed === true ? result.code === null : result.consumed === false && typeof result.code === 'string' && /^\d{6}$/.test(result.code);
      if (!validCode || result.periodSeconds !== 30 || !Number.isFinite(lifetime)
        || lifetime <= 0 || lifetime > 30_000) throw new Error('Código no vigente');
      if (remaining <= 0) {
        if (++staleRetries > 2) throw new Error('La respuesta sigue vencida');
        deadline = now() + 250;
        clear('waiting');
        cancelExpiry = scheduleExpiry(() => { if (active && current === generation) void reload(false); }, 250);
        return;
      }
      staleRetries = 0;
      update({ phase: 'ready', code: result.code, consumed: result.consumed, secondsRemaining: Math.ceil(remaining / 1000), progress: remaining / 30_000 });
      cancelExpiry = scheduleExpiry(() => { if (active && current === generation) void reload(false); }, remaining);
    } catch {
      if (active && current === generation) clear('error');
    }
  }

  function setActive(value: boolean) {
    if (active === value) return;
    active = value;
    if (value) void reload();
    else {
      generation++;
      controller?.abort();
      cancelExpiry?.();
      cancelExpiry = null;
      controller = null;
      deadline = 0;
      clear('paused');
    }
  }

  function tick() {
    if (!active || (state.phase !== 'ready' && state.phase !== 'waiting')) return;
    const remaining = deadline - now();
    if (remaining <= 0) { void reload(false); return; }
    if (state.phase === 'ready') update({ ...state, secondsRemaining: Math.ceil(remaining / 1000), progress: remaining / 30_000 });
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setActive, reload, tick,
    dispose: () => { setActive(false); listeners.clear(); },
  };
}
