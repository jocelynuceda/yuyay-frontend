import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon } from './Icon'

export interface SearchInputProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'children'> {
  label: string
  /** Oculta la etiqueta visualmente (sigue disponible para lectores de pantalla). */
  hideLabel?: boolean
  /** Valor controlado: si cambia desde fuera, reemplaza el texto. */
  value?: string
  defaultValue?: string
  /** Se llama con el texto tras `delay` ms sin escribir; al limpiar o pulsar Enter, de inmediato. */
  onSearch: (value: string) => void
  delay?: number
}

/** Campo de búsqueda con debounce y botón "Limpiar búsqueda". */
export function SearchInput({
  label,
  hideLabel = true,
  value,
  defaultValue = '',
  onSearch,
  delay = 300,
  className,
  id,
  ...rest
}: SearchInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(value ?? defaultValue)
  const [lastValue, setLastValue] = useState(value)
  const emitted = useRef(text)
  const debounced = useDebounce(text, delay)
  // Solo emite cuando cambia el valor con espera, no cuando cambia `onSearch` (suele ser una función nueva)
  const lastDebounced = useRef(debounced)

  if (value !== lastValue) {
    setLastValue(value)
    if (value !== undefined) setText(value)
  }

  function emit(next: string) {
    if (next === emitted.current) return
    emitted.current = next
    onSearch(next)
  }

  useEffect(() => {
    if (debounced === lastDebounced.current) return
    lastDebounced.current = debounced
    if (debounced !== emitted.current) {
      emitted.current = debounced
      onSearch(debounced)
    }
  }, [debounced, onSearch])

  return (
    <div className={cx('grid gap-1.5', className)}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-sm font-semibold'}>
        {label}
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') emit(text)
          }}
          className={cx(
            'w-full rounded-xl border border-line bg-card py-2.5 pr-11 pl-11 placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden',
            focusRing,
          )}
          {...rest}
        />
        {text ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setText('')
              emit('')
              inputRef.current?.focus()
            }}
            className={cx('absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-primary-tint', focusRing)}
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
