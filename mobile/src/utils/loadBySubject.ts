/**
 * Pide una lista por persona sin que el fallo de una oculte las demás. `failed` cuenta las que no
 * se pudieron leer: mientras sea mayor que cero no se puede afirmar que no haya nada.
 */
export async function loadBySubject<T>(subjectIds: number[], fetchList: (subjectId: number) => Promise<T[]>) {
  const loaded = new Map<number, T[]>();
  await Promise.all(
    subjectIds.map((id) =>
      fetchList(id).then(
        (list) => void loaded.set(id, list),
        () => undefined,
      ),
    ),
  );
  return { loaded, failed: subjectIds.length - loaded.size };
}
