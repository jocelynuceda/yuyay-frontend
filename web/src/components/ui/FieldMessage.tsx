/** Mensaje de error (prioritario) o ayuda bajo un campo. */
export function FieldMessage({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-sm text-danger">
        {error}
      </p>
    )
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
    )
  }
  return null
}
