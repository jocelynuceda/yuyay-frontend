import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import React from 'react';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as { renderToStaticMarkup(node: React.ReactNode): string };
import ts from 'typescript';
import { careNetworkState } from '../src/utils/careNetworkState.ts';

const mockUrl = new URL('./support/native-empty-state.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/components/EmptyState.tsx') &&
        ['react-native', '../theme', './Sparkle'].includes(specifier)) return { url: mockUrl, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('/components/EmptyState.tsx')) return nextLoad(url, context);
    const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return { format: 'module', source, shortCircuit: true };
  },
});
const { EmptyState } = await import('../src/components/EmptyState.tsx');

test('el vacío de personas conserva título, descripción y acción sin estrella ni su contenedor', () => {
  const html = renderToStaticMarkup(React.createElement(EmptyState, {
    title: 'Aún no registras a nadie', description: 'Agrega a la persona que cuidas',
    action: React.createElement('button', null, '+ Agregar persona'), showIcon: false,
  }));
  assert.match(html, /Aún no registras a nadie/);
  assert.match(html, /Agrega a la persona que cuidas/);
  assert.match(html, /<button>\+ Agregar persona<\/button>/);
  assert.doesNotMatch(html, /data-decoration|width.*48/);
  assert.match(html, /paddingVertical.*22/);
});

test('otros estados vacíos mantienen la estrella y las ilustraciones siguen disponibles', () => {
  assert.match(renderToStaticMarkup(React.createElement(EmptyState, { title: 'Otra sección' })), /data-decoration/);
  assert.match(renderToStaticMarkup(React.createElement(EmptyState, { title: 'Ilustrado', image: 1, showIcon: false })), /data-illustration/);
});

test('carga, reintento y error no se presentan como una red vacía', () => {
  assert.deepEqual(careNetworkState({ data: null, loading: true, error: null }),
    { initialLoading: true, showEmpty: false, count: null });
  assert.equal(careNetworkState({ data: [], loading: true, error: null }).showEmpty, false);
  assert.equal(careNetworkState({ data: [], loading: false, error: 'Sin conexión' }).showEmpty, false);
  assert.equal(careNetworkState({ data: null, loading: false, error: null }).showEmpty, false);
  assert.equal(careNetworkState({ data: [], loading: false, error: null }).showEmpty, true);
});

test('el perfil propio del backend cuenta como persona y no se agregan filas artificiales', () => {
  const own = { id: 71, name: 'Alias de prueba', myRole: 'PRINCIPAL' };
  const rows = [own];
  assert.deepEqual(careNetworkState({ data: rows, loading: false, error: null }),
    { initialLoading: false, showEmpty: false, count: 1 });
  assert.deepEqual(rows, [own]);
});

test('la ilustración de avisos mantiene el tamaño grande y el estilo sin recuadro', () => {
  const html = renderToStaticMarkup(React.createElement(EmptyState, {
    title: 'Sin notificaciones', image: 1, showIcon: false,
  }));
  assert.match(html, /data-illustration/);
  assert.match(html, /paddingTop.*56/);
  assert.match(html, /width.*168/);
  assert.doesNotMatch(html, /borderStyle|data-decoration|paddingVertical/);
});
