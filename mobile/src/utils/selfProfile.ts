/** Solo una respuesta confirmada del backend permite ofrecer otro perfil propio. */
export function selfProfileState(state: {
  data: readonly { ownProfile?: boolean }[] | null;
  loading: boolean;
  error: string | null;
}) {
  if (state.loading) return 'checking';
  if (state.error || !Array.isArray(state.data)) return 'unknown';
  if (state.data.some((subject) => subject.ownProfile === true)) return 'owned';
  return state.data.every((subject) => subject.ownProfile === false) ? 'available' : 'unknown';
}
