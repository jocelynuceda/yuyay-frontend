import axios from 'axios'
import { getHttpErrorMessage } from '../services/http'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ErrorResponse } from '../types'

/** Mensaje legible para un toast a partir de cualquier error de la API. */
export function getErrorMessage(error: unknown): string {
  return getHttpErrorMessage(error)
}

/**
 * Pasa los fieldErrors del backend a los campos del formulario (React Hook Form).
 * Los nombres de campo del backend coinciden con los de los esquemas.
 * Devuelve el mensaje general para mostrar en un toast, o null si todo quedó en campos.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    const fieldErrors = error.response?.data?.fieldErrors ?? []
    let unmatched = false
    fieldErrors.forEach(({ field, message }, index) => {
      const name = field.split(/[.[]/)[0] as Path<T>
      if (fields.includes(name)) {
        setError(name, { type: 'server', message }, { shouldFocus: index === 0 })
      } else {
        unmatched = true
      }
    })
    if (fieldErrors.length > 0 && !unmatched) return null
  }
  return getErrorMessage(error)
}
