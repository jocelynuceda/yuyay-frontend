import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { act, useState } from 'react'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = await import('react-dom/client')
const { DatePicker } = await import('../src/components/ui/DatePicker')

test('el calendario está en español, respeta los límites, cambia de mes y año, y permite borrar', async (t) => {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  const changes: string[] = []
  function Harness() {
    const [value, setValue] = useState('2026-11-10')
    return <DatePicker id="d" value={value} min="1900-01-01" max="2026-11-25" onChange={(next) => { changes.push(next); setValue(next) }} />
  }
  await act(async () => root.render(<Harness />))
  const trigger = container.querySelector<HTMLButtonElement>('#d')!
  const click = async (element: Element | null) => { assert.ok(element); await act(async () => { (element as HTMLButtonElement).click() }) }
  const day = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  const select = async (name: string, value: string) => {
    const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!
    await act(async () => { element.value = value; element.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
  }

  assert.match(trigger.textContent!, /10 de noviembre de 2026/)
  assert.equal(container.querySelector('select'), null)
  await click(trigger)
  assert.equal(day('10 de noviembre de 2026')!.getAttribute('aria-pressed'), 'true')
  assert.equal(day('26 de noviembre de 2026')!.disabled, true)
  assert.equal(day('Mes siguiente')!.disabled, true)

  await select('Año', '1954')
  await select('Mes', '0')
  await click(day('5 de enero de 1954'))
  assert.equal(changes.at(-1), '1954-01-05')
  assert.equal(container.querySelector('select'), null, 'elegir un día cierra el calendario')

  await click(trigger)
  await click(day('Mes anterior'))
  assert.ok(day('1 de diciembre de 1953'))
  await click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Borrar fecha')!)
  assert.equal(changes.at(-1), '')
  assert.match(trigger.textContent!, /Elige una fecha/)
})
