/** La lista siempre proviene del backend; null todavía no confirma una lista vacía. */
export function careNetworkState<T>(state: { data: readonly T[] | null; loading: boolean; error: string | null }) {
  return {
    initialLoading: state.loading && state.data === null,
    showEmpty: !state.loading && !state.error && state.data !== null && state.data.length === 0,
    count: state.data === null ? null : state.data.length,
  };
}
