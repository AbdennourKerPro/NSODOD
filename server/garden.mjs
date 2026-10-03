import { entryKey, mealKey, validEntry, validMeal, validProfile, validVote } from '../src/domain.mjs';

export const COMMON_GARDEN = '82491a2cc44319d6807ae8e9867f388d';
const SOURCES = [
  { room: 'dd5df91e35d65b63faf41533fe2480f8', person: 'meriem' },
  { room: '79d9e2081b87a4218f7f09c486e33089', person: 'isabelle' },
];
const COLLECTIONS = ['meals', 'entries', 'profiles', 'votes'];
function belongs(collection, id, data, person) {
  if (collection === 'meals') return data.participantId === person && validMeal(data) && id === mealKey(person, data.day, data.type);
  if (collection === 'entries') return data.participantId === person && validEntry(data) && id === entryKey(person, data.day);
  if (collection === 'profiles') return id === person && validProfile(person, data);
  return id === person && validVote(person, data.vote);
}

// One-time, non-destructive recovery of the gardens verified in Firebase.
// The destination is fixed server-side; browsers cannot request another source.
export async function commonGarden(db) {
  const room = await db.doc(`rooms/${COMMON_GARDEN}`).get();
  if (!room.exists) throw Object.assign(new Error('Le jardin commun est indisponible. Réessaie.'), { status: 503 });
  const marker = db.doc('gardenMigrations/shared-garden-v1');
  if (!(await marker.get()).exists) {
    const documents = [];
    for (const source of SOURCES) for (const collection of COLLECTIONS) {
      const snapshot = await db.collection(`rooms/${source.room}/${collection}`).get();
      for (const document of snapshot.docs) {
        if (belongs(collection, document.id, document.data(), source.person)) documents.push({
          source: `rooms/${source.room}/${collection}/${document.id}`,
          destination: `rooms/${COMMON_GARDEN}/${collection}/${document.id}`,
        });
      }
    }
    await db.runTransaction(async tx => {
      if ((await tx.get(marker)).exists) return;
      const copies = [];
      // Read every document before writing, as required by Firestore transactions.
      for (const document of documents) {
        const source = await tx.get(db.doc(document.source));
        const target = await tx.get(db.doc(document.destination));
        if (source.exists && !target.exists) copies.push({ ...document, data: source.data() });
      }
      for (const copy of copies) tx.set(db.doc(copy.destination), copy.data);
      tx.set(marker, { completedAt: Date.now(), copied: copies.map(({ source, destination }) => ({ source, destination })) });
    });
  }
  return { roomId: COMMON_GARDEN };
}
