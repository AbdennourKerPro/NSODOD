import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_START, COLORS, PEOPLE, addDays, assertEntry, assertVote, challengePhase, cleanState, dayIndex, emptyState,
  entryKey, isDate, isRoomId, newRoomId, personStats, profileColor, ranking, todayISO, validProfile, validVote, voteSummary,
} from '../src/domain.mjs';

function garden(startDate, results) {
  const state = emptyState(startDate);
  for (const [participantId, statuses] of Object.entries(results)) {
    statuses.forEach((status, day) => {
      if (status) state.entries[entryKey(participantId, day)] = { participantId, day, status };
    });
  }
  return state;
}

test('calendar date follows Paris midnight on both sides of the spring clock change', () => {
  const instants = [
    ['2026-03-28T22:59:59Z', '2026-03-28'],
    ['2026-03-28T23:00:00Z', '2026-03-29'],
    ['2026-03-29T21:59:59Z', '2026-03-29'],
    ['2026-03-29T22:00:00Z', '2026-03-30'],
  ];
  for (const [instant, expected] of instants) assert.equal(todayISO(new Date(instant)), expected);
});

test('calendar date follows Paris midnight on both sides of the autumn clock change', () => {
  const instants = [
    ['2026-10-24T21:59:59Z', '2026-10-24'],
    ['2026-10-24T22:00:00Z', '2026-10-25'],
    ['2026-10-25T22:59:59Z', '2026-10-25'],
    ['2026-10-25T23:00:00Z', '2026-10-26'],
  ];
  for (const [instant, expected] of instants) assert.equal(todayISO(new Date(instant)), expected);
});

test('seven calendar days remain seven days across DST, month and year boundaries', () => {
  assert.equal(addDays('2026-03-27', 6), '2026-04-02');
  assert.equal(dayIndex('2026-03-27', '2026-04-02'), 6);
  assert.equal(addDays('2026-10-23', 6), '2026-10-29');
  assert.equal(dayIndex('2026-10-23', '2026-10-29'), 6);
  assert.equal(addDays('2026-12-29', 6), '2027-01-04');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(dayIndex('2026-10-03', '2026-10-02'), -1);
});

test('invalid and normalized-overflow dates cannot become challenge start dates', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '26-01-01', '2026-1-01', '2026-01-01T00:00:00Z', '', null, 20261002]) {
    assert.equal(isDate(value), false, String(value));
  }
  assert.equal(isDate('2024-02-29'), true);
  assert.equal(isDate('2026-10-02'), true);
});

test('today and earlier results are accepted, including correction after the week ends', () => {
  assert.doesNotThrow(() => assertEntry({ participantId: 'abdennour', day: 0, status: 'success' }, '2026-10-02', '2026-10-02'));
  assert.doesNotThrow(() => assertEntry({ participantId: 'isabelle', day: 1, status: 'failure' }, '2026-10-02', '2026-10-04'));
  assert.doesNotThrow(() => assertEntry({ participantId: 'meriem', day: 6, status: 'success' }, '2026-10-02', '2026-10-20'));
});

test('future days and a challenge that has not begun reject results', () => {
  assert.throws(() => assertEntry({ participantId: 'sherine', day: 1, status: 'success' }, '2026-10-02', '2026-10-02'), /pas encore commencé/);
  assert.throws(() => assertEntry({ participantId: 'sherine', day: 0, status: 'failure' }, '2026-10-03', '2026-10-02'), /pas encore commencé/);
});

test('result validation rejects unknown people, invalid days and unsupported statuses', () => {
  const invalid = [
    { participantId: 'someone', day: 0, status: 'success' },
    { participantId: 'abdennour', day: -1, status: 'success' },
    { participantId: 'abdennour', day: 7, status: 'success' },
    { participantId: 'abdennour', day: 0.5, status: 'success' },
    { participantId: 'abdennour', day: '0', status: 'success' },
    { participantId: 'abdennour', day: 0, status: 'pending' },
    null,
  ];
  for (const entry of invalid) assert.throws(() => assertEntry(entry, '2026-10-02', '2026-10-08'), /pas valide/);
});

test('an empty garden has neutral mascots, zero scores and no ranking yet', () => {
  const state = emptyState('2026-10-02');
  assert.deepEqual(personStats(state, 'abdennour', '2026-10-02'), {
    statuses: Array(7).fill(null), successes: 0, failures: 0, best: 0, streak: 0, recorded: 0, mood: 'neutral',
  });
  assert.equal(ranking(state, '2026-10-02').length, 4);
  assert.ok(ranking(state, '2026-10-02').every(person => person.rank === null));
  assert.equal(emptyState().startDate, CHALLENGE_START);
  assert.deepEqual(PEOPLE.map(person => person.name), ['Abdennour', 'Isabelle', 'Shérine', 'Meriem']);
});

test('ties share a competition rank, with failures excluded from the score', () => {
  const state = garden('2026-10-02', {
    abdennour: ['success', 'failure', 'success'],
    isabelle: ['success', 'success', null],
    sherine: ['success', 'failure', 'failure'],
    meriem: ['failure', 'failure', 'failure'],
  });
  const rows = ranking(state, '2026-10-04');
  assert.deepEqual(rows.map(({ id, rank, successes }) => [id, rank, successes]), [
    ['abdennour', 1, 2], ['isabelle', 1, 2], ['sherine', 3, 1], ['meriem', 4, 0],
  ]);
  assert.equal(rows[0].failures, 1);
  assert.equal(rows[1].failures, 0);
});

test('a failure-only garden has recorded results and an equal zero-score ranking', () => {
  const state = garden('2026-10-02', { abdennour: ['failure'] });
  assert.ok(ranking(state, '2026-10-02').every(person => person.rank === 1));
  assert.equal(personStats(state, 'abdennour', '2026-10-02').recorded, 1);
  assert.equal(personStats(state, 'abdennour', '2026-10-02').mood, 'sad');
});

test('an unrecorded current day preserves yesterday’s run, but a full gap breaks it', () => {
  const state = garden('2026-10-02', { abdennour: ['success', 'success'] });
  assert.equal(personStats(state, 'abdennour', '2026-10-04').streak, 2);
  assert.equal(personStats(state, 'abdennour', '2026-10-05').streak, 0);
  assert.equal(personStats(state, 'abdennour', '2026-10-05').best, 2);
  assert.equal(personStats(state, 'abdennour', '2026-10-05').mood, 'happy');
});

test('a missing historical day separates success runs and remains unrecorded', () => {
  const state = garden('2026-10-02', { abdennour: ['success', 'success', null, 'success', 'success'] });
  const stats = personStats(state, 'abdennour', '2026-10-06');
  assert.equal(stats.successes, 4);
  assert.equal(stats.failures, 0);
  assert.equal(stats.recorded, 4);
  assert.equal(stats.best, 2);
  assert.equal(stats.streak, 2);
  assert.equal(stats.statuses[2], null);
});

test('a failure changes mascot mood without erasing previous victories, and recovery works', () => {
  const state = garden('2026-10-02', { isabelle: ['success', 'success', 'failure', 'success'] });
  const failed = personStats(state, 'isabelle', '2026-10-04');
  assert.equal(failed.successes, 2);
  assert.equal(failed.failures, 1);
  assert.equal(failed.streak, 0);
  assert.equal(failed.best, 2);
  assert.equal(failed.mood, 'sad');
  const recovered = personStats(state, 'isabelle', '2026-10-05');
  assert.equal(recovered.successes, 3);
  assert.equal(recovered.streak, 1);
  assert.equal(recovered.mood, 'happy');
});

test('stored future results are invisible until their calendar day, including before the challenge', () => {
  const state = garden('2026-10-02', { meriem: ['success', 'failure', null, null, null, null, 'success'] });
  const before = personStats(state, 'meriem', '2026-10-01');
  assert.equal(before.recorded, 0);
  assert.equal(before.mood, 'neutral');
  assert.ok(ranking(state, '2026-10-01').every(person => person.rank === null));
  const firstDay = personStats(state, 'meriem', '2026-10-02');
  assert.equal(firstDay.successes, 1);
  assert.equal(firstDay.failures, 0);
  assert.equal(firstDay.mood, 'happy');
  assert.equal(firstDay.statuses[6], null);
  const finalDay = personStats(state, 'meriem', '2026-10-08');
  assert.equal(finalDay.successes, 2);
  assert.equal(finalDay.failures, 1);
  assert.equal(finalDay.mood, 'happy');
});

test('correcting a result recalculates scores, streaks and tied places', () => {
  const state = garden('2026-10-02', { abdennour: ['success', 'failure'], isabelle: ['success', 'success'] });
  assert.equal(ranking(state, '2026-10-03').find(person => person.id === 'abdennour').rank, 2);
  state.entries.abdennour_1.status = 'success';
  const stats = personStats(state, 'abdennour', '2026-10-03');
  assert.equal(stats.successes, 2);
  assert.equal(stats.failures, 0);
  assert.equal(stats.streak, 2);
  assert.equal(stats.mood, 'happy');
  assert.equal(ranking(state, '2026-10-03').find(person => person.id === 'abdennour').rank, 1);
});

test('sanitization rebuilds safe entry keys and discards unknown or malformed data', () => {
  const raw = {
    version: 1, startDate: '2026-10-02', unexpected: 'ignored',
    entries: {
      arbitrary: { participantId: 'sherine', day: 0, status: 'success', html: '<script>bad</script>' },
      unknown: { participantId: 'inconnue', day: 0, status: 'success' },
      outside: { participantId: 'meriem', day: 7, status: 'failure' },
      malformed: { participantId: 'meriem', day: 1, status: 'unanswered' },
      empty: null,
    },
  };
  const cleaned = cleanState(raw);
  assert.deepEqual(cleaned, {
    version: 1, startDate: '2026-10-02',
    entries: { sherine_0: { participantId: 'sherine', day: 0, status: 'success' } },
    profiles: {},
    votes: {},
  });
  assert.equal(raw.entries.arbitrary.html, '<script>bad</script>');
  raw.entries.arbitrary.status = 'failure';
  assert.equal(cleaned.entries.sherine_0.status, 'success');
});

test('corrupt state headers are rejected while a missing entries collection is safe', () => {
  for (const raw of [null, {}, { version: 2, startDate: '2026-10-02' }, { version: 1, startDate: '2026-02-29' }]) {
    assert.equal(cleanState(raw), null);
  }
  assert.deepEqual(cleanState({ version: 1, startDate: '2026-10-02' }), emptyState(CHALLENGE_START));
});

test('existing v1 backups keep their dates and results while adding optional mascot settings', () => {
  const backup = {
    version: 1,
    startDate: '2026-10-02',
    entries: { abdennour_0: { participantId: 'abdennour', day: 0, status: 'success' } },
  };
  const migrated = cleanState(backup);
  assert.equal(migrated.startDate, backup.startDate);
  assert.deepEqual(migrated.entries, backup.entries);
  assert.deepEqual(migrated.profiles, {});
  assert.deepEqual(migrated.votes, {});
  assert.deepEqual(PEOPLE.map(person => profileColor(migrated, person.id)), ['royal', 'turquoise', 'green', 'pink']);
  assert.equal(personStats(migrated, 'abdennour', '2026-10-02').successes, 1);
  assert.equal(Object.hasOwn(backup, 'profiles'), false);
});

test('profile colors accept exactly one allowed color for one known participant', () => {
  for (const person of PEOPLE) {
    for (const color of COLORS) assert.equal(validProfile(person.id, { color: color.id }), true);
  }
  const invalidProfiles = [
    null, undefined, 'blue', ['blue'], {}, { color: 'cyan' }, { color: null },
    { color: 'BLUE' }, { color: 'blue;background:red' }, { color: 'blue', extra: true },
    Object.create({ color: 'blue' }),
  ];
  for (const profile of invalidProfiles) assert.equal(validProfile('abdennour', profile), false);
  for (const id of ['inconnue', '__proto__', null, 1]) assert.equal(validProfile(id, { color: 'blue' }), false);
});

test('sanitization preserves valid per-person overrides and discards malformed profiles', () => {
  const raw = {
    ...garden('2026-10-02', { meriem: ['success'] }),
    profiles: {
      abdennour: { color: 'orange' },
      isabelle: { color: 'purple' },
      sherine: { color: 'pink', extra: '<script>bad</script>' },
      meriem: { color: 'unknown' },
      inconnue: { color: 'blue' },
    },
  };
  const cleaned = cleanState(raw);
  assert.deepEqual(cleaned.profiles, { abdennour: { color: 'orange' }, isabelle: { color: 'purple' } });
  assert.deepEqual(cleaned.entries, raw.entries);
  assert.equal(profileColor(cleaned, 'sherine'), 'green');
  assert.equal(profileColor(cleaned, 'meriem'), 'pink');
  raw.profiles.abdennour.color = 'pink';
  assert.equal(profileColor(cleaned, 'abdennour'), 'orange');
});

test('custom colors appear in ranking without modifying defaults or masking results', () => {
  const state = garden('2026-10-02', { isabelle: ['success'], abdennour: ['failure'] });
  state.profiles = { abdennour: { color: 'yellow' }, isabelle: { color: 'orange' } };
  const rows = ranking(state, '2026-10-02');
  assert.equal(rows[0].id, 'isabelle');
  assert.equal(rows[0].color, 'orange');
  assert.equal(rows.find(person => person.id === 'abdennour').color, 'yellow');
  assert.equal(rows.find(person => person.id === 'abdennour').mood, 'sad');
  assert.equal(PEOPLE.find(person => person.id === 'abdennour').color, 'royal');
  assert.equal(profileColor({ profiles: { abdennour: { color: 'cyan' } } }, 'abdennour'), 'royal');
  assert.equal(profileColor(undefined, 'isabelle'), 'turquoise');
});

test('new defaults preserve saved blue and green preferences from existing gardens', () => {
  const state = cleanState({
    version: 1, startDate: '2026-10-02',
    profiles: { abdennour: { color: 'blue' }, isabelle: { color: 'green' } },
  });
  assert.deepEqual(state.profiles, { abdennour: { color: 'blue' }, isabelle: { color: 'green' } });
  assert.equal(profileColor(state, 'abdennour'), 'blue');
  assert.equal(profileColor(state, 'isabelle'), 'green');
  assert.deepEqual(ranking(state, '2026-10-02').slice(0, 2).map(person => person.color), ['blue', 'green']);
  for (const color of ['royal', 'turquoise']) {
    assert.equal(validProfile('abdennour', { color }), true);
    assert.equal(profileColor({ profiles: { abdennour: { color } } }, 'abdennour'), color);
  }
});

test('unused backups move to the agreed start date without losing custom mascot colors', () => {
  const backup = {
    version: 1, startDate: '2026-10-01',
    profiles: { abdennour: { color: 'orange' }, isabelle: { color: 'green' } },
    entries: { broken: { participantId: 'inconnue', day: 0, status: 'success' } },
  };
  const migrated = cleanState(backup);
  assert.equal(migrated.startDate, '2026-10-03');
  assert.deepEqual(migrated.profiles, backup.profiles);
  assert.deepEqual(migrated.entries, {});
  assert.equal(backup.startDate, '2026-10-01');
  assert.equal(addDays(emptyState().startDate, 6), '2026-10-09');
});

test('preparation, active challenge, final day and finished week use Paris calendar dates', () => {
  const state = emptyState();
  for (const [day, phase] of [
    ['2026-10-02', 'preparing'], ['2026-10-03', 'active'], ['2026-10-08', 'active'],
    ['2026-10-09', 'final'], ['2026-10-10', 'finished'],
  ]) assert.equal(challengePhase(state, day), phase);
  assert.equal(challengePhase(state, todayISO(new Date('2026-10-08T21:59:59Z'))), 'active');
  assert.equal(challengePhase(state, todayISO(new Date('2026-10-08T22:00:00Z'))), 'final');
});

test('votes require a known participant, yes or no and at least the final challenge day', () => {
  for (const person of PEOPLE) {
    for (const vote of ['yes', 'no']) {
      assert.equal(validVote(person.id, vote), true);
      assert.doesNotThrow(() => assertVote(person.id, vote, CHALLENGE_START, '2026-10-09'));
      assert.doesNotThrow(() => assertVote(person.id, vote, CHALLENGE_START, '2026-11-01'));
      assert.throws(() => assertVote(person.id, vote, CHALLENGE_START, '2026-10-08'), /dernier jour/);
    }
  }
  for (const [id, vote] of [['inconnue', 'yes'], ['__proto__', 'yes'], ['abdennour', true], ['meriem', 'maybe'], ['sherine', 'YES']]) {
    assert.equal(validVote(id, vote), false);
    assert.throws(() => assertVote(id, vote, CHALLENGE_START, '2026-10-09'), /valide/);
  }
  assert.throws(() => assertVote('abdennour', 'yes', '2026-02-29', '2026-10-09'), /date/);
  assert.throws(() => assertVote('abdennour', 'yes', CHALLENGE_START, 'bad'), /date/);
  // Older gardens continue to open their vote relative to their preserved date.
  assert.doesNotThrow(() => assertVote('abdennour', 'no', '2026-10-01', '2026-10-07'));
});

test('votes are optional in older backups and sanitization preserves only known choices', () => {
  const backup = {
    ...garden('2026-10-02', { abdennour: ['success'] }),
    votes: { abdennour: 'yes', isabelle: 'no', sherine: true, meriem: { vote: 'yes' }, inconnue: 'yes' },
  };
  const cleaned = cleanState(backup);
  assert.deepEqual(cleaned.votes, { abdennour: 'yes', isabelle: 'no' });
  assert.equal(cleaned.startDate, '2026-10-02');
  assert.deepEqual(cleaned.entries, backup.entries);
  backup.votes.abdennour = 'no';
  assert.equal(cleaned.votes.abdennour, 'yes');
  const votedWithoutEntries = cleanState({ version: 1, startDate: '2026-10-01', votes: { meriem: 'no' } });
  assert.equal(votedWithoutEntries.startDate, '2026-10-01');
});

test('a group decision waits for all four votes and distinguishes a majority from a tie', () => {
  const state = emptyState();
  assert.deepEqual(voteSummary(state), { yes: 0, no: 0, total: 0, remaining: 4, complete: false, decision: null });
  state.votes = { abdennour: 'yes', isabelle: 'yes', sherine: 'yes', inconnue: 'yes' };
  assert.deepEqual(voteSummary(state), { yes: 3, no: 0, total: 3, remaining: 1, complete: false, decision: null });
  state.votes.meriem = 'no';
  assert.equal(voteSummary(state).decision, 'extend');
  assert.equal(voteSummary(state).complete, true);
  state.votes.sherine = 'no';
  assert.equal(voteSummary(state).decision, 'tie');
  state.votes.isabelle = 'no';
  assert.equal(voteSummary(state).decision, 'stop');
});

test('local stores keep each vote, corrections, results and preferences across reloads', async () => {
  const { createStore } = await import('../src/store.mjs');
  const original = new Map(['Date', 'localStorage', 'location', 'window'].map(key => [key, globalThis[key]]));
  const stored = new Map();
  const RealDate = globalThis.Date;
  let instant = '2026-10-02T12:00:00Z';
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [instant])); }
  };
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  globalThis.location = { hash: '' };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const stores = [];
  try {
    stored.set('nsodod.garden.v1', JSON.stringify({ version: 1, startDate: '2026-10-02', profiles: { isabelle: { color: 'orange' } } }));
    let state;
    const first = await createStore(next => { state = next; }, () => {}, {});
    stores.push(first);
    assert.equal(state.startDate, CHALLENGE_START);
    assert.equal(profileColor(state, 'isabelle'), 'orange');
    await assert.rejects(first.setVote('abdennour', 'yes'), /dernier jour/);
    instant = '2026-10-09T12:00:00Z';
    await first.save({ participantId: 'isabelle', day: 0, status: 'success' });
    await first.setVote('abdennour', 'yes');
    const second = await createStore(() => {}, () => {}, {});
    stores.push(second);
    await second.setVote('isabelle', 'no');
    await first.setVote('abdennour', 'no');
    await first.setColor('meriem', 'royal');
    const reloaded = await createStore(next => { state = next; }, () => {}, {});
    stores.push(reloaded);
    assert.deepEqual(state.votes, { abdennour: 'no', isabelle: 'no' });
    assert.equal(state.entries.isabelle_0.status, 'success');
    assert.equal(profileColor(state, 'isabelle'), 'orange');
    assert.equal(profileColor(state, 'meriem'), 'royal');
    await assert.rejects(reloaded.setVote('meriem', 'invalid'), /valide/);
    const unchanged = JSON.parse(stored.get('nsodod.garden.v1'));
    assert.deepEqual(unchanged.votes, state.votes);
  } finally {
    for (const store of stores) store.destroy();
    for (const [key, value] of original) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test('room identifiers have sufficient random bytes and reject malformed invitation input', () => {
  const first = newRoomId();
  const second = newRoomId();
  assert.equal(isRoomId(first), true);
  assert.equal(isRoomId(second), true);
  assert.notEqual(first, second);
  for (const input of ['', 'a'.repeat(31), 'a'.repeat(33), 'g'.repeat(32), 'A'.repeat(32), null, 123]) assert.equal(isRoomId(input), false);
});
