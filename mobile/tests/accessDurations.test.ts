import assert from 'node:assert/strict';
import test from 'node:test';
import * as web from '../../web/src/utils/accessDurations.ts';
import * as mobile from '../src/utils/accessDurations.ts';

test('web y móvil convierten las tres unidades con los mismos defaults y sin aceptar cantidades inválidas', () => {
  const { defaultHandoffExpiry, defaultHandoffReading, defaultDelegationDuration } = mobile;
  assert.deepEqual(defaultHandoffExpiry, { amount: '24', unit: 'hours' });
  assert.deepEqual(defaultHandoffReading, { amount: '30', unit: 'minutes' });
  assert.deepEqual(defaultDelegationDuration, { amount: '', unit: 'days' });
  assert.deepEqual(web.defaultHandoffExpiry, defaultHandoffExpiry);
  assert.deepEqual(web.defaultHandoffReading, defaultHandoffReading);
  assert.deepEqual(web.defaultDelegationDuration, defaultDelegationDuration);
  assert.deepEqual(mobile.durationUnits, web.durationUnits);
  assert.deepEqual(mobile.durationUnitLabels, web.durationUnitLabels);

  for (const client of [mobile, web]) {
    assert.equal(client.durationInMinutes({ amount: '2', unit: 'minutes' }), 2);
    assert.equal(client.durationInMinutes({ amount: '2', unit: 'hours' }), 120);
    assert.equal(client.durationInMinutes({ amount: '2', unit: 'days' }), 2880);
    for (const amount of ['', '0', '-1', 'NaN', '1.5', '1e3', '99999999999999999']) {
      assert.equal(client.durationInMinutes({ amount, unit: 'minutes' }), null, amount);
    }
  }
});

test('la vigencia absoluta conserva 72 horas y la lectura no rebasa ni la vigencia ni 7 días', () => {
  for (const client of [mobile, web]) {
    const expiry = { amount: '3', unit: 'days' } as const;
    const duration = client.handoffDurations(expiry, { amount: '4320', unit: 'minutes' });
    assert.deepEqual(duration.request, { expiresInMinutes: 4320, sessionWindowMinutes: 4320 });
    assert.equal(client.handoffDurations({ amount: '4321', unit: 'minutes' }, expiry).errors?.expiry, 'El límite máximo es 3 días.');
    assert.match(client.handoffDurations(expiry, { amount: '7', unit: 'days' }).errors?.reading ?? '', /vigencia/);
    assert.equal(client.handoffDurations(expiry, { amount: '10081', unit: 'minutes' }).errors?.reading, 'Máximo 7 días.');
    const short = client.handoffDurations({ amount: '1', unit: 'minutes' }, { amount: '1', unit: 'minutes' });
    assert.deepEqual(short.request, { expiresInMinutes: 1, sessionWindowMinutes: 1 });
  }
});

test('la delegación usa el instante de envío y conserva el tope exacto de 365 días', () => {
  for (const client of [mobile, web]) {
    const duration = { amount: '30', unit: 'minutes' } as const;
    assert.equal(client.delegationExpiry(duration, new Date('2026-11-26T04:50:00Z')).validUntil, '2026-11-26T05:20:00.000Z');
    assert.equal(client.delegationExpiry(duration, new Date('2026-11-26T05:10:30Z')).validUntil, '2026-11-26T05:40:30.000Z');
    const limaLeapDay = new Date('2028-03-01T04:59:59.999Z');
    assert.equal(client.delegationExpiry({ amount: '365', unit: 'days' }, limaLeapDay).validUntil, '2029-03-01T04:59:59.999Z');
    assert.equal(client.delegationExpiry({ amount: '525601', unit: 'minutes' }, limaLeapDay).error, 'El límite máximo es 365 días.');
  }
});
