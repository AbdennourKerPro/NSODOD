import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, entryKey, personStats, ranking, karaokeShares, officialStart, challengeDays, assertVote } from '../src/domain.mjs';

test('October 3 stays on its date but has no effect on scores, mascots, streaks or prices', () => {
  const state = emptyState();
  state.entries.abdennour_0 = { participantId: 'abdennour', day: 0, status: 'success' };
  state.entries.meriem_0 = { participantId: 'meriem', day: 0, status: 'failure' };
  const stats = personStats(state, 'abdennour', '2026-10-03');
  assert.equal(stats.statuses[0], 'success');
  assert.equal(stats.successes, 0); assert.equal(stats.streak, 0); assert.equal(stats.best, 0);
  assert.equal(stats.mood, 'neutral');
  assert.ok(ranking(state, '2026-10-03').every(person => person.rank === null));
  assert.ok(karaokeShares(state, '2026-10-03').shares.every(person => person.cents === 1800));
  assert.equal(karaokeShares(state, '2026-10-03').remaining, 24);
  state.entries.abdennour_1 = { participantId: 'abdennour', day: 1, status: 'success' };
  assert.equal(personStats(state, 'abdennour', '2026-10-04').streak, 1);
  assert.equal(personStats(state, 'abdennour', '2026-10-04').successes, 1);
  assert.equal(state.startDate, '2026-10-03');
  assert.equal(officialStart(state), '2026-10-04'); assert.equal(challengeDays(state), 6);
});

test('six official days settle 72 euros after October 9 without needing a trial bilan', () => {
  const state = emptyState();
  const ids = ['abdennour', 'isabelle', 'sherine', 'meriem'];
  for (let i = 0; i < ids.length; i++) for (let day = 1; day <= 6; day++) state.entries[entryKey(ids[i], day)] = {
    participantId: ids[i], day, status: day <= 6 - i * 2 ? 'success' : 'failure',
  };
  const bill = karaokeShares(state, '2026-10-10');
  assert.equal(bill.final, true); assert.equal(bill.recorded, 24); assert.equal(bill.remaining, 0);
  assert.deepEqual(bill.shares.map(person => person.cents), [1200, 1600, 2000, 2400]);
  assert.equal(bill.shares.reduce((sum, person) => sum + person.cents, 0), 7200);
  assert.equal(karaokeShares(state, '2026-10-09').final, false);
  assert.doesNotThrow(() => assertVote('meriem', 'yes', state.startDate, '2026-10-09'));
  assert.throws(() => assertVote('meriem', 'yes', state.startDate, '2026-10-08'));
});
