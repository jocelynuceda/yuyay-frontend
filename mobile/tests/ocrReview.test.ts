import assert from 'node:assert/strict';
import test from 'node:test';
import medicalTerms from '../src/data/medicalTerms.json' with { type: 'json' };
import { parseDateParts } from '../src/utils/dates.ts';
import { applyAcceptedMatches, createMedicalTermMatcher } from '../src/utils/medicalTermMatcher.ts';
import { initialEntryFields, ocrEntryParams } from '../src/utils/ocrEntryDraft.ts';
import { suggestEntryFromOcr } from '../src/utils/ocrSuggestions.ts';

const matcher = createMedicalTermMatcher(medicalTerms);

test('extrae título, categoría y fecha de atención con las líneas originales como evidencia', () => {
  const text = 'RECETA ÚNICA ESTANDARIZADA\nVálido hasta: 05/03/2024\nFecha de atención\n29/02/2024';
  assert.deepEqual(suggestEntryFromOcr(text, 2026), {
    title: 'Receta médica',
    categoryCode: 'MEDICATION',
    occurredOn: '2024-02-29',
    evidence: {
      title: 'RECETA ÚNICA ESTANDARIZADA',
      categoryCode: 'RECETA ÚNICA ESTANDARIZADA',
      occurredOn: 'Fecha de atención / 29/02/2024',
    },
  });
  assert.equal(suggestEntryFromOcr('CARNÉ DE VACUNACIÓN').categoryCode, 'IMMUNIZATION');
});

test('omite fechas imposibles, próximas citas, vencimientos y fechas de atención contradictorias', () => {
  for (const text of [
    'Fecha de atención: 29/02/2023',
    'Válido hasta: 05/03/2024',
    'Fecha de próxima cita: 05/03/2024',
    'Fecha de atención: 01/03/2024\nFecha de atención: 02/03/2024',
  ]) {
    assert.equal(suggestEntryFromOcr(text, 2026).occurredOn, undefined, text);
  }
  assert.equal(suggestEntryFromOcr('Fecha: 3/1/20 10:30', 2026).occurredOn, '2020-01-03');
});

test('reconoce nombres en español y sugiere corregir errores inequívocos de receta', () => {
  const text = 'Rp.\n1. Acido acetilsalicilico 100 mg\nClonidina 0,1 mg\nOmeprasol 20 mg\nPrednisolna 10 mg';
  assert.deepEqual(matcher.findInText(text).map(({ kind, term }) => [kind, term]), [
    ['known', 'Ácido acetilsalicílico'],
    ['known', 'Clonidina'],
    ['suggestion', 'Omeprazol'],
  ]);
  assert.equal(matcher.matchWord('Clonidna')?.term, 'Clonidina');
});

test('no confunde las unidades de laboratorio con dosis ni clasifica el informe como receta', () => {
  const lab = 'LABORATORIO CLÍNICO\nGlucosa 95 mg/dL\nColesterol 200 mg/dL\nProteínas 150 mg/24h\nIndicaciones: ayuno';
  assert.deepEqual(matcher.findInText(lab), []);
  assert.deepEqual(suggestEntryFromOcr(lab), { evidence: {} });
});

test('aplica solo el término aceptado en la posición exacta y conserva el formato del texto', () => {
  const text = '  Rp: xPanitidina Panitidina 10 mg\r\nHiosina 20 mg\r\nFirma: Panitidina';
  const [match] = matcher.findInText(text);
  assert.equal(text.split('\r\n')[0].slice(match.start, match.start + match.original.length), 'Panitidina');
  const corrected = applyAcceptedMatches(text, [match]);
  assert.equal(corrected, '  Rp: xPanitidina Ranitidina 10 mg\r\nHiosina 20 mg\r\nFirma: Panitidina');
  assert.equal(applyAcceptedMatches(corrected, [match]), corrected);
  const edited = text.replace('xPanitidina Panitidina', 'xPanitidina Famotidina');
  assert.equal(applyAcceptedMatches(edited, [match]), edited);
});

test('lleva el texto corregido a un único borrador con adjunto, fecha y confianza por confirmar', () => {
  const text = 'RECETA\nFecha: 05/07/2023\nRp.\nOmeprasol 20 mg\nNota agregada a mano.';
  const corrected = applyAcceptedMatches(text, matcher.findInText(text));
  const params = ocrEntryParams(7, 23, corrected, suggestEntryFromOcr(corrected));
  assert.equal(params.subjectId, 7);
  assert.equal(params.sourceAttachmentId, 23);
  assert.deepEqual(initialEntryFields(params), {
    title: 'Receta médica',
    categoryCode: 'MEDICATION',
    details: 'RECETA\nFecha: 05/07/2023\nRp.\nOmeprazol 20 mg\nNota agregada a mano.',
    dateParts: { day: '05', month: '07', year: '2023' },
    confidenceLevel: 'UNCERTAIN',
  });
  assert.equal(parseDateParts(initialEntryFields(params).dateParts).iso, '2023-07-05');
});

test('solo la revisión OCR sin categoría deja la elección pendiente', () => {
  const params = ocrEntryParams(7, 23, 'Texto sin encabezado', { evidence: {} });
  assert.deepEqual(initialEntryFields(params), {
    title: '',
    categoryCode: '',
    details: 'Texto sin encabezado',
    dateParts: { day: '', month: '', year: '' },
    confidenceLevel: 'UNCERTAIN',
  });
  assert.deepEqual(initialEntryFields({ subjectId: 7 }), {
    title: '',
    categoryCode: 'MEDICATION',
    details: '',
    dateParts: { day: '', month: '', year: '' },
    confidenceLevel: 'CONFIRMED',
  });
  assert.equal(initialEntryFields({ subjectId: 7, categoryCode: 'EXAM_RESULT' }).categoryCode, 'EXAM_RESULT');
  assert.equal(initialEntryFields({ subjectId: 7, sourceAttachmentId: 23 }).confidenceLevel, 'CONFIRMED');
});

test('escribir desde un documento que no se pudo leer conserva el adjunto y empieza por confirmar', () => {
  const params = ocrEntryParams(7, 23, '', { evidence: {} });
  assert.equal(params.sourceAttachmentId, 23);
  assert.equal(initialEntryFields(params).categoryCode, '');
  assert.equal(initialEntryFields(params).details, '');
  assert.equal(initialEntryFields(params).confidenceLevel, 'UNCERTAIN');
});
