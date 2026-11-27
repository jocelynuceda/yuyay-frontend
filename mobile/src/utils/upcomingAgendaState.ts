/** El total de citas solo se conoce después de recibir todas las listas. */
export function upcomingAgendaState(
  fetch: { loading: boolean; error: string | null; data: { failed: number } | null },
  visibleAppointments: number,
) {
  const warning = fetch.error ?? (fetch.data?.failed ? 'No pudimos cargar todas las citas.' : null);
  return {
    warning,
    showEmpty: !fetch.loading && fetch.data !== null && !warning && visibleAppointments === 0,
  };
}
