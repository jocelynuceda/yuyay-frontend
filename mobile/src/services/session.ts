type Tokens = { accessToken: string; refreshToken: string };

interface SessionOptions<T extends Tokens> {
  storage: {
    get: () => Promise<string | null>;
    set: (token: string) => Promise<void>;
    remove: () => Promise<void>;
  };
  renew: (token: string) => Promise<T>;
  revoke: (token: string) => Promise<unknown>;
  isRejected: (error: unknown) => boolean;
  onExpired: () => void;
  onRecovery?: (error: unknown) => void;
}

export class NoSessionError extends Error {}

export function createSession<T extends Tokens>(options: SessionOptions<T>) {
  let generation = 0;
  let accessToken: string | null = null;
  // Use the latest rotated token if storage temporarily fails during refresh.
  let rotatedToken: string | null = null;
  let writes = Promise.resolve();
  let inFlight: { generation: number; result: Promise<T> } | undefined;

  function queue<R>(operation: () => Promise<R>): Promise<R> {
    const result = writes.then(operation);
    writes = result.then(() => undefined, () => undefined);
    return result;
  }

  function assertCurrent(expected: number) {
    if (generation !== expected) throw new NoSessionError();
  }

  function reset() {
    generation += 1;
    accessToken = null;
    rotatedToken = null;
    return generation;
  }

  async function save(tokens: T, expected: number) {
    await queue(async () => {
      assertCurrent(expected);
      rotatedToken = tokens.refreshToken;
      await options.storage.set(tokens.refreshToken);
      assertCurrent(expected);
      accessToken = tokens.accessToken;
    });
  }

  function refresh(): Promise<T> {
    if (inFlight?.generation === generation) return inFlight.result;
    const expected = generation;
    const result = (async () => {
      await writes;
      assertCurrent(expected);
      const token = rotatedToken ?? await options.storage.get();
      assertCurrent(expected);
      if (!token) throw new NoSessionError();
      let tokens: T;
      try {
        tokens = await options.renew(token);
      } catch (error) {
        if (expected === generation && options.isRejected(error)) {
          reset();
          // Queue deletion before notifying the UI, so a subsequent login writes last.
          const removal = queue(options.storage.remove);
          options.onExpired();
          await removal.catch(() => {});
        }
        if (expected === generation) options.onRecovery?.(error);
        throw error;
      }
      try {
        await save(tokens, expected);
      } catch (error) {
        if (error instanceof NoSessionError) {
          // A refresh can already have rotated server-side when the user signs out.
          void options.revoke(tokens.refreshToken).catch(() => {});
        } else if (expected === generation) options.onRecovery?.(error);
        throw error;
      }
      return tokens;
    })().finally(() => {
      if (inFlight?.result === result) inFlight = undefined;
    });
    inFlight = { generation: expected, result };
    return result;
  }

  return {
    get generation() { return generation; },
    get accessToken() { return accessToken; },
    replace(tokens: T) {
      return save(tokens, reset());
    },
    refresh,
    async logout() {
      const tokenInMemory = rotatedToken;
      reset();
      const token = await queue(async () => {
        const current = tokenInMemory ?? await options.storage.get();
        await options.storage.remove();
        return current;
      });
      if (token) void options.revoke(token).catch(() => {});
    },
  };
}
