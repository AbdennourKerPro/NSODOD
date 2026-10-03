import { isRoomId } from './domain.mjs';

export async function sharedGarden(user, fetchImpl = fetch) {
  const token = await user.getIdToken();
  const response = await fetchImpl('/api/garden', { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}', signal: AbortSignal.timeout(55000) });
  let result;
  try { result = await response.json(); } catch { throw new Error('Le jardin commun est momentanément indisponible. Recharge la page pour réessayer.'); }
  if (!response.ok || !isRoomId(result.roomId)) throw new Error(result.error || 'Le jardin commun ne peut pas être chargé.');
  return result.roomId;
}
