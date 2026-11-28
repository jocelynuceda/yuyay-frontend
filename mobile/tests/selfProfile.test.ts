import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import React from 'react';
import ts from 'typescript';
import { selfProfileState } from '../src/utils/selfProfile.ts';
import type { useCareAuthorization } from '../src/hooks/useCareAuthorization';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as { renderToStaticMarkup(node: React.ReactNode): string };
const mock = new URL('./support/native-care-authorization.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/CareAuthorizationFields.tsx')) {
      if (specifier === '../utils/careAuthorization') return { url: new URL('../src/utils/careAuthorization.ts', import.meta.url).href, shortCircuit: true };
      if (['react-native', 'react-native-paper', '@expo/vector-icons', '../theme', './FormKit', './StatusMessage'].includes(specifier)) return { url: mock, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('/components/CareAuthorizationFields.tsx')) return next(url, context);
    return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true };
  },
});
const { CareAuthorizationFields } = await import('../src/components/CareAuthorizationFields.tsx');
const authorization: ReturnType<typeof useCareAuthorization> = {
  document: { textVersion: '1', thirdPartyQuestion: 'Autorización de otra persona', options: [
    { type: 'SELF', label: 'Mi propio perfil', description: 'Datos propios', scope: 'OWN_DATA', confirmationText: 'Confirmo.' },
    { type: 'FICTITIOUS', label: 'Perfil ficticio', description: 'Ejemplo', scope: 'FICTITIOUS_DATA_ONLY', confirmationText: 'Confirmo.' },
  ] }, profileKind: null, thirdPartyType: null, option: undefined, declaration: null,
  chooseProfileKind: () => {}, chooseThirdPartyType: () => {}, confirm: () => {}, review: () => {}, loading: false, error: null,
};
const cases = [
  { label: 'cuenta nueva con perfil', data: [{ ownProfile: true }], loading: false, error: null, show: false },
  { label: 'cuenta anterior sin perfil', data: [], loading: false, error: null, show: true },
  { label: 'cuenta anterior con perfil', data: [{ ownProfile: true }], loading: false, error: null, show: false },
  { label: 'familiares principales no son el propio perfil', data: [{ ownProfile: false }, { ownProfile: false }], loading: false, error: null, show: true },
  { label: 'perfil propio entre familiares', data: [{ ownProfile: false }, { ownProfile: true }], loading: false, error: null, show: false },
  { label: 'carga inicial', data: null, loading: true, error: null, show: false },
  { label: 'recarga con estado anterior', data: [], loading: true, error: null, show: false },
  { label: 'error con estado anterior', data: [], loading: false, error: 'Sin conexión', show: false },
  { label: 'contrato anterior sin indicador', data: [{}], loading: false, error: null, show: false },
];
for (const scenario of cases) test('Mobile: ' + scenario.label, () => {
  const html = renderToStaticMarkup(React.createElement(CareAuthorizationFields, {
    authorization, disabled: false, allowSelf: selfProfileState(scenario) === 'available',
  }));
  assert.equal(html.includes('Mi propio perfil'), scenario.show);
  assert.match(html, /Perfil ficticio/);
  assert.match(html, /El perfil es para otra persona/);
});
