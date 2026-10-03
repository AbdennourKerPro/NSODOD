import { firebaseConfig } from '../firebase-config.js';
import { CHALLENGE_START, assertEntry, assertMeal, assertVote, cleanState, emptyState, entryKey, isDate, isRoomId, mealKey, newRoomId, validEntry, validMeal, validProfile, validVote } from './domain.mjs';

const LOCAL_KEY = 'nsodod.garden.v1';
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
export const cloudConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
function readLocal() {
  let raw;
  try { raw = localStorage.getItem(LOCAL_KEY); }
  catch { throw new Error('Le navigateur bloque la sauvegarde. Autorise le stockage pour conserver tes résultats.'); }
  if (!raw) return emptyState();
  try { const state = cleanState(JSON.parse(raw)); if (state) return state; }
  catch { /* Preserve the unreadable backup and explain below. */ }
  throw new Error('La sauvegarde de ce navigateur est illisible. Les données ont été conservées ; utilise un autre navigateur pour ouvrir le jardin.');
}
async function confirmedWrite(promise) {
  let timer;
  try {
    await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Ta modification attend encore sa confirmation. Garde cette page ouverte ; le jardin se mettra à jour quand l’envoi sera confirmé.')), 15000);
    })]);
  } finally { clearTimeout(timer); }
}
export function preference(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(`nsodod.${key}`);
    if (value === null) localStorage.removeItem(`nsodod.${key}`);
    else localStorage.setItem(`nsodod.${key}`, value);
  } catch { /* Preferences may be unavailable in private browser sessions. */ }
  return null;
}
export async function createStore(onState, onConnection, config = firebaseConfig) {
  const configured = Boolean(config.apiKey && config.projectId && config.appId);
  let requestedRoom = new URLSearchParams(location.hash.slice(1)).get('jardin');
  if (requestedRoom && !isRoomId(requestedRoom)) throw new Error('Ce lien d’invitation est incomplet. Demande un nouveau lien.');
  const remembered = preference('shared-room');
  // An existing shared garden is independent from this browser's local backup.
  let local = configured && (requestedRoom || isRoomId(remembered)) ? emptyState() : readLocal();
  if (!configured) {
    if (requestedRoom) throw new Error('Le partage de ce site n’est pas encore activé. Ce jardin ne peut pas être chargé.');
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(local)); } catch { throw new Error('Pas assez de place pour sauvegarder le jardin sur cet appareil.'); }
    const persist = next => {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { throw new Error('La sauvegarde a échoué. Ta modification n’a pas été enregistrée.'); }
      local = next;
      onState(local);
    };
    const listener = event => {
      if (event.key !== LOCAL_KEY || !event.newValue) return;
      try { const next = cleanState(JSON.parse(event.newValue)); if (next) { local = next; onState(local); } } catch { /* Ignore malformed events. */ }
    };
    window.addEventListener('storage', listener);
    onConnection('local');
    onState(local);
    return {
      mode: 'local',
      async saveMeal(meal) {
        const current = readLocal();
        assertMeal(meal, current.startDate);
        const value = { participantId: meal.participantId, day: meal.day, type: meal.type, text: meal.text.trim() };
        persist({ ...current, meals: { ...current.meals, [mealKey(meal.participantId, meal.day, meal.type)]: value } });
      },
      async removeMeal(personId, day, type) {
        const current = readLocal();
        assertMeal({ participantId: personId, day, type, text: 'delete' }, current.startDate);
        const meals = { ...current.meals };
        delete meals[mealKey(personId, day, type)];
        persist({ ...current, meals });
      },
      async save(entry) {
        assertEntry(entry, local.startDate);
        // Re-read before each write so multiple tabs do not replace each other's entries.
        const current = readLocal();
        assertEntry(entry, current.startDate);
        persist({ ...current, entries: { ...current.entries, [entryKey(entry.participantId, entry.day)]: entry } });
      },
      async remove(personId, day) {
        assertEntry({ participantId: personId, day, status: 'success' }, local.startDate);
        const current = readLocal();
        const entries = { ...current.entries };
        delete entries[entryKey(personId, day)];
        persist({ ...current, entries });
      },
      async setStart(startDate) {
        if (!isDate(startDate)) throw new Error('Choisis une date valide.');
        const current = readLocal();
        if (Object.keys(current.entries).length) throw new Error('La date est fixée dès le premier résultat.');
        if (Object.keys(current.votes).length) throw new Error('La date est fixée dès le premier vote.');
        if (Object.keys(current.meals).length) throw new Error('La date est fixée dès le premier repas.');
        if (startDate !== CHALLENGE_START) throw new Error('Le départ du défi est fixé au 3 octobre 2026.');
        persist({ ...current, startDate });
      },
      async setColor(personId, color) {
        if (!validProfile(personId, { color })) throw new Error('Choisis une couleur valide pour ta mascotte.');
        const current = readLocal();
        persist({ ...current, profiles: { ...current.profiles, [personId]: { color } } });
      },
      async setVote(personId, vote) {
        const current = readLocal();
        assertVote(personId, vote, current.startDate);
        persist({ ...current, votes: { ...current.votes, [personId]: vote } });
      },
      destroy() { window.removeEventListener('storage', listener); },
    };
  }

  onConnection('connecting');
  const [{ initializeApp }, authApi, dbApi] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const auth = authApi.getAuth(app);
  await auth.authStateReady();
  const user = auth.currentUser || (await authApi.signInAnonymously(auth)).user;
  const db = dbApi.getFirestore(app);
  const roomId = requestedRoom || (isRoomId(remembered) ? remembered : newRoomId());
  const roomRef = dbApi.doc(db, 'rooms', roomId);
  let roomSnap = await dbApi.getDoc(roomRef);
  if (!roomSnap.exists()) {
    if (requestedRoom || isRoomId(remembered)) throw new Error('Ce jardin n’existe plus ou ce lien est incorrect. Demande une nouvelle invitation.');
    await dbApi.setDoc(roomRef, { startDate: CHALLENGE_START, creatorUid: user.uid, createdAt: dbApi.serverTimestamp() });
    roomSnap = await dbApi.getDoc(roomRef);
  }
  const room = roomSnap.data();
  if (!isDate(room.startDate)) throw new Error('La date de ce jardin n’est pas valide.');
  const memberRef = dbApi.doc(db, 'rooms', roomId, 'members', user.uid);
  const member = await dbApi.getDoc(memberRef);
  if (!member.exists()) await dbApi.setDoc(memberRef, { joinedAt: dbApi.serverTimestamp() });
  preference('shared-room', roomId);
  const inviteURL = new URL(location.href);
  inviteURL.hash = `jardin=${roomId}`;
  history.replaceState(null, '', inviteURL);
  let shared = emptyState(room.startDate);
  let stopEntries = () => {};
  let stopProfiles = () => {};
  let stopVotes = () => {};
  let stopMeals = () => {};
  const flags = { entries: null, profiles: null, votes: null, meals: null };
  const errors = { entries: false, profiles: false, votes: false, meals: false };
  const reportConnection = () => {
    const metadata = Object.values(flags).filter(Boolean);
    onConnection(Object.values(errors).some(Boolean) ? 'error'
      : metadata.some(item => item.hasPendingWrites) ? 'pending'
      : metadata.some(item => item.fromCache) ? 'offline'
      : metadata.length === 4 ? 'shared' : 'connecting');
  };
  await new Promise((resolve, reject) => {
    let initialized = false;
    const timer = setTimeout(() => { stopEntries(); stopProfiles(); stopVotes(); stopMeals(); reject(new Error('Le jardin met trop de temps à répondre. Vérifie ta connexion et réessaie.')); }, 12000);
    const received = (collection, snapshot) => {
      flags[collection] = { hasPendingWrites: snapshot.metadata.hasPendingWrites, fromCache: snapshot.metadata.fromCache };
      errors[collection] = false;
      reportConnection();
      if (flags.entries && flags.profiles && flags.votes && flags.meals) {
        onState(shared);
        if (!initialized) { initialized = true; clearTimeout(timer); resolve(); }
      }
    };
    const failed = (collection, error) => {
      errors[collection] = true;
      reportConnection();
      if (!initialized) { clearTimeout(timer); stopEntries(); stopProfiles(); stopVotes(); stopMeals(); reject(error); }
    };
    stopEntries = dbApi.onSnapshot(dbApi.collection(db, 'rooms', roomId, 'entries'), { includeMetadataChanges: true }, snapshot => {
      const entries = {};
      snapshot.forEach(document => {
        const entry = document.data();
        if (validEntry(entry) && document.id === entryKey(entry.participantId, entry.day)) entries[document.id] = { participantId: entry.participantId, day: entry.day, status: entry.status };
      });
      shared = { ...shared, entries };
      received('entries', snapshot);
    }, error => failed('entries', error));
    stopProfiles = dbApi.onSnapshot(dbApi.collection(db, 'rooms', roomId, 'profiles'), { includeMetadataChanges: true }, snapshot => {
      const profiles = {};
      snapshot.forEach(document => {
        const profile = { color: document.data().color };
        if (validProfile(document.id, profile)) profiles[document.id] = profile;
      });
      shared = { ...shared, profiles };
      received('profiles', snapshot);
    }, error => failed('profiles', error));
    stopVotes = dbApi.onSnapshot(dbApi.collection(db, 'rooms', roomId, 'votes'), { includeMetadataChanges: true }, snapshot => {
      const votes = {};
      snapshot.forEach(document => {
        const vote = document.data().vote;
        if (validVote(document.id, vote)) votes[document.id] = vote;
      });
      shared = { ...shared, votes };
      received('votes', snapshot);
    }, error => failed('votes', error));
    stopMeals = dbApi.onSnapshot(dbApi.collection(db, 'rooms', roomId, 'meals'), { includeMetadataChanges: true }, snapshot => {
      const meals = {};
      snapshot.forEach(document => {
        const data = document.data();
        const meal = { participantId: data.participantId, day: data.day, type: data.type, text: data.text };
        if (validMeal(meal) && document.id === mealKey(meal.participantId, meal.day, meal.type)) meals[document.id] = meal;
      });
      shared = { ...shared, meals };
      received('meals', snapshot);
    }, error => failed('meals', error));
  });
  return {
    mode: 'shared', inviteURL: inviteURL.href,
    async saveMeal(meal) {
      assertMeal(meal, shared.startDate);
      if (!navigator.onLine) throw new Error('Reconnecte-toi pour enregistrer ton repas.');
      const value = { participantId: meal.participantId, day: meal.day, type: meal.type, text: meal.text.trim() };
      await confirmedWrite(dbApi.setDoc(dbApi.doc(db, 'rooms', roomId, 'meals', mealKey(meal.participantId, meal.day, meal.type)), { ...value, updatedBy: user.uid, updatedAt: dbApi.serverTimestamp() }));
    },
    async removeMeal(personId, day, type) {
      assertMeal({ participantId: personId, day, type, text: 'delete' }, shared.startDate);
      if (!navigator.onLine) throw new Error('Reconnecte-toi pour modifier ton carnet.');
      await confirmedWrite(dbApi.deleteDoc(dbApi.doc(db, 'rooms', roomId, 'meals', mealKey(personId, day, type))));
    },
    async save(entry) {
      assertEntry(entry, shared.startDate);
      if (!navigator.onLine) throw new Error('Reconnecte-toi pour enregistrer ce résultat dans le jardin partagé.');
      await confirmedWrite(dbApi.setDoc(dbApi.doc(db, 'rooms', roomId, 'entries', entryKey(entry.participantId, entry.day)), { ...entry, updatedBy: user.uid, updatedAt: dbApi.serverTimestamp() }));
    },
    async remove(personId, day) {
      assertEntry({ participantId: personId, day, status: 'success' }, shared.startDate);
      if (!navigator.onLine) throw new Error('Reconnecte-toi pour modifier le jardin partagé.');
      await confirmedWrite(dbApi.deleteDoc(dbApi.doc(db, 'rooms', roomId, 'entries', entryKey(personId, day))));
    },
    async setStart() { throw new Error('La date d’un jardin partagé est fixée à sa création.'); },
    async setColor(personId, color) {
      if (!validProfile(personId, { color })) throw new Error('Choisis une couleur valide pour ta mascotte.');
      if (!navigator.onLine) throw new Error('Reconnecte-toi pour changer la couleur de ta mascotte dans le jardin partagé.');
      await confirmedWrite(dbApi.setDoc(dbApi.doc(db, 'rooms', roomId, 'profiles', personId), { color, updatedBy: user.uid, updatedAt: dbApi.serverTimestamp() }));
    },
    async setVote(personId, vote) {
      assertVote(personId, vote, shared.startDate);
      if (!navigator.onLine) throw new Error('Reconnecte-toi pour enregistrer ton vote dans le jardin partagé.');
      await confirmedWrite(dbApi.setDoc(dbApi.doc(db, 'rooms', roomId, 'votes', personId), { vote, updatedBy: user.uid, updatedAt: dbApi.serverTimestamp() }));
    },
    destroy() { stopEntries(); stopProfiles(); stopVotes(); stopMeals(); },
  };
}
