import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUTO_LOCK_MINUTES,
  isLedgerSessionFresh,
  ledgerLastActiveAt,
  normalizeAutoLockMinutes,
  parseLedgerRecord,
  sameWartAddress,
  serializeLedgerRecord,
} from './ledgerSession.js';

test('auto lock accepts the listed minutes and falls back to 5', () => {
  assert.equal(normalizeAutoLockMinutes(1), 1);
  assert.equal(normalizeAutoLockMinutes('30'), 30);
  assert.equal(normalizeAutoLockMinutes(60), 60);
  assert.equal(normalizeAutoLockMinutes(7), DEFAULT_AUTO_LOCK_MINUTES);
  assert.equal(normalizeAutoLockMinutes('never'), DEFAULT_AUTO_LOCK_MINUTES);
});

test('ledger auto lock follows the last time the page was open', () => {
  const left = 1_000_000;
  assert.equal(isLedgerSessionFresh(left, 5, left + 4 * 60 * 1000), true);
  assert.equal(isLedgerSessionFresh(left, 5, left + 5 * 60 * 1000), false);
  assert.equal(isLedgerSessionFresh(undefined, 5, left), false);
  assert.equal(
    ledgerLastActiveAt({ unlockedAt: 10, lastActiveAt: 50 }),
    50,
  );
  assert.equal(ledgerLastActiveAt({ unlockedAt: 10 }), 10);
  assert.equal(ledgerLastActiveAt({}), 0);
});

test('saved ledger record keeps the account and drops any key material', () => {
  const raw = serializeLedgerRecord({
    address: '79ea517ec0597c83d93f7ca302a3214833bb8938656cf3d3',
    publicKey: 'ab',
    pathType: 'non-hardened',
    index: 2,
    privateKey: 'secret',
  });
  const parsed = parseLedgerRecord(raw);
  assert.equal(parsed.address, '79ea517ec0597c83d93f7ca302a3214833bb8938656cf3d3');
  assert.equal(parsed.pathType, 'non-hardened');
  assert.equal(parsed.index, 2);
  assert.equal(parsed.privateKey, undefined);
  assert.equal(raw.includes('secret'), false);
  assert.equal(parseLedgerRecord('not-json'), null);
  assert.equal(sameWartAddress(parsed.address, `0x${parsed.address.toUpperCase()}`), true);
});
