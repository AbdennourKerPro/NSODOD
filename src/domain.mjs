export const COLORS = Object.freeze([
  { id: 'royal', label: 'Bleu royal' },
  { id: 'turquoise', label: 'Bleu turquoise' },
  { id: 'blue', label: 'Bleu' },
  { id: 'green', label: 'Vert' },
  { id: 'purple', label: 'Violet' },
  { id: 'pink', label: 'Rose' },
  { id: 'yellow', label: 'Jaune' },
  { id: 'orange', label: 'Orange' },
]);
export const PEOPLE = Object.freeze([
  { id: 'abdennour', name: 'Abdennour', plant: 'Basil', color: 'royal', emoji: '🌿' },
  { id: 'isabelle', name: 'Isabelle', plant: 'Sunny', color: 'turquoise', emoji: '🌼' },
  { id: 'sherine', name: 'Shérine', plant: 'Lila', color: 'green', emoji: '🪻' },
  { id: 'meriem', name: 'Meriem', plant: 'Poppy', color: 'pink', emoji: '🌷' },
]);
export const DAYS = 7;
export const MEAL_TYPES = Object.freeze([
  { id: 'breakfast', label: 'Petit-déjeuner', emoji: '☀️' },
  { id: 'lunch', label: 'Déjeuner', emoji: '🥗' },
  { id: 'dinner', label: 'Dîner', emoji: '🌙' },
  { id: 'snack', label: 'Collations', emoji: '🍎' },
]);
export function mealKey(personId, day, type) { return `${personId}_${day}_${type}`; }
export function validMeal(meal) {
  return Boolean(meal && PEOPLE.some(person => person.id === meal.participantId)
    && Number.isInteger(meal.day) && meal.day >= 0 && meal.day < DAYS
    && MEAL_TYPES.some(type => type.id === meal.type)
    && typeof meal.text === 'string' && meal.text.trim().length > 0 && meal.text.length <= 2000);
}
export function assertMeal(meal, startDate, today = todayISO()) {
  if (!validMeal(meal)) throw new Error('Décris ton repas en 1 à 2 000 caractères.');
  assertEntry({ participantId: meal.participantId, day: meal.day, status: 'success' }, startDate, today);
}
export const CHALLENGE_START = '2026-10-03';
export function todayISO(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function addDays(iso, count) {
  const date = new Date(iso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function dayIndex(start, today = todayISO()) {
  return Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 86400000);
}
export function dateLabel(iso, options = {}) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC', ...options }).format(new Date(iso + 'T12:00:00Z')).replace('.', '');
}
export function validEntry(entry) {
  return entry && PEOPLE.some(person => person.id === entry.participantId) && Number.isInteger(entry.day) && entry.day >= 0 && entry.day < DAYS && ['success', 'failure'].includes(entry.status);
}
export function entryKey(personId, day) { return `${personId}_${day}`; }
export function assertEntry(entry, startDate, today = todayISO()) {
  if (!validEntry(entry)) throw new Error('Ce résultat n’est pas valide.');
  if (!isDate(startDate) || !isDate(today)) throw new Error('La date du défi n’est pas valide.');
  if (entry.day > dayIndex(startDate, today)) throw new Error('Cette journée n’a pas encore commencé.');
}
export function validProfile(personId, profile) {
  return Boolean(PEOPLE.some(person => person.id === personId)
    && profile && typeof profile === 'object' && !Array.isArray(profile)
    && Object.keys(profile).length === 1 && Object.hasOwn(profile, 'color')
    && COLORS.some(color => color.id === profile.color));
}
export function profileColor(state, id) {
  const profile = state?.profiles?.[id];
  return validProfile(id, profile) ? profile.color : PEOPLE.find(person => person.id === id)?.color;
}
export function validVote(personId, vote) {
  return PEOPLE.some(person => person.id === personId) && ['yes', 'no'].includes(vote);
}
export function assertVote(personId, vote, startDate, today = todayISO()) {
  if (!validVote(personId, vote)) throw new Error('Choisis un vote valide.');
  if (!isDate(startDate) || !isDate(today)) throw new Error('La date du défi n’est pas valide.');
  if (dayIndex(startDate, today) < DAYS - 1) throw new Error('Le vote ouvrira le dernier jour du défi.');
}
export function challengePhase(state, today = todayISO()) {
  const index = dayIndex(state.startDate, today);
  return index < 0 ? 'preparing' : index < DAYS - 1 ? 'active' : index === DAYS - 1 ? 'final' : 'finished';
}
export function voteSummary(state) {
  const votes = PEOPLE.map(person => state?.votes?.[person.id]).filter(vote => ['yes', 'no'].includes(vote));
  const yes = votes.filter(vote => vote === 'yes').length;
  const no = votes.length - yes;
  const complete = votes.length === PEOPLE.length;
  return { yes, no, total: votes.length, remaining: PEOPLE.length - votes.length, complete, decision: complete ? yes > no ? 'extend' : no > yes ? 'stop' : 'tie' : null };
}
export function emptyState(startDate = CHALLENGE_START) { return { version: 1, startDate, entries: {}, profiles: {}, votes: {}, meals: {}, jokerCounts: {}, analysisStates: {} }; }
export function cleanState(raw) {
  if (!raw || raw.version !== 1 || !isDate(raw.startDate)) return null;
  const state = emptyState(raw.startDate);
  for (const entry of Object.values(raw.entries || {})) {
    if (validEntry(entry)) state.entries[entryKey(entry.participantId, entry.day)] = { participantId: entry.participantId, day: entry.day, status: entry.status };
  }
  for (const [personId, profile] of Object.entries(raw.profiles || {})) {
    if (validProfile(personId, profile)) state.profiles[personId] = { color: profile.color };
  }
  for (const [personId, vote] of Object.entries(raw.votes || {})) {
    if (validVote(personId, vote)) state.votes[personId] = vote;
  }
  for (const meal of Object.values(raw.meals || {})) {
    if (validMeal(meal)) state.meals[mealKey(meal.participantId, meal.day, meal.type)] = {
      participantId: meal.participantId, day: meal.day, type: meal.type, text: meal.text.trim(),
    };
  }
  // Local backups cannot create administrator decisions. These are server-owned data.
  // An unused local garden can follow the agreed date without changing past results.
  if (!Object.keys(state.entries).length && !Object.keys(state.votes).length && !Object.keys(state.meals).length) state.startDate = CHALLENGE_START;
  return state;
}
export function personStats(state, id, today = todayISO()) {
  const index = dayIndex(state.startDate, today);
  const statuses = Array.from({ length: DAYS }, (_, day) => day <= index ? state.entries[entryKey(id, day)]?.status || null : null);
  const successes = statuses.filter(status => status === 'success').length;
  const failures = statuses.filter(status => status === 'failure').length;
  let best = 0, run = 0;
  for (const status of statuses) { run = status === 'success' ? run + 1 : 0; best = Math.max(best, run); }
  let anchor = Math.min(index, DAYS - 1);
  if (anchor >= 0 && statuses[anchor] === null) anchor--;
  let streak = 0;
  for (let day = anchor; day >= 0 && statuses[day] === 'success'; day--) streak++;
  const last = statuses.filter(Boolean).at(-1);
  return { statuses, successes, failures, best, streak, recorded: successes + failures, mood: last === 'success' ? 'happy' : last === 'failure' ? 'sad' : 'neutral' };
}
export function ranking(state, today = todayISO()) {
  const all = PEOPLE.map(person => ({ ...person, color: profileColor(state, person.id), ...personStats(state, person.id, today) }));
  const any = all.some(person => person.recorded);
  return all.sort((a, b) => b.successes - a.successes).map(person => ({ ...person, rank: any ? 1 + all.filter(other => other.successes > person.successes).length : null }));
}
export const KARAOKE_TOTAL_CENTS = 7200;
export function karaokeShares(state, today = todayISO()) {
  const participants = ranking(state, today);
  const totalSuccesses = participants.reduce((total, person) => total + person.successes, 0);
  const recorded = participants.reduce((total, person) => total + person.recorded, 0);
  const baseCents = KARAOKE_TOTAL_CENTS / PEOPLE.length;
  // With four participants and a €2 score adjustment, every share is exact to 50 cents.
  const shares = participants.map(person => ({
    ...person,
    cents: baseCents + 200 * (totalSuccesses / PEOPLE.length - person.successes),
  }));
  return {
    shares, recorded, remaining: PEOPLE.length * DAYS - recorded,
    final: dayIndex(state.startDate, today) >= DAYS && recorded === PEOPLE.length * DAYS,
    totalCents: KARAOKE_TOTAL_CENTS,
  };
}
export function newRoomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function isRoomId(value) { return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value); }
