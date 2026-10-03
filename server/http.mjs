import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { createIntegrityService } from './integrity.mjs';
import { COOKIE, sameSecret, signSession, verifySession } from './auth.mjs';
import { isRoomId } from '../src/domain.mjs';
import { commonGarden } from './garden.mjs';

function fail(message, status) { throw Object.assign(new Error(message), { status }); }
function backend() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) fail('Les identifiants serveur Firebase ne sont pas encore configurés dans Vercel.', 503);
  if (!getApps().length) {
    let account;
    try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { fail('La configuration serveur Firebase est invalide.', 503); }
    if (account.project_id !== 'nsod-od') fail('Le compte serveur doit appartenir au projet nsod-od.', 503);
    initializeApp({ credential: cert(account) });
  }
  return { db: getFirestore(), auth: getAuth() };
}
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    if (JSON.stringify(req.body).length > 8000) fail('Requête trop longue.', 413);
    return req.body;
  }
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 8000) fail('Requête trop longue.', 413);
  }
  try { return JSON.parse(raw); } catch { fail('Requête invalide.', 400); }
}
export function sameOrigin(req) {
  const host = req.headers.host;
  const allowed = [`https://${host}`];
  if (/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host || '')) allowed.push(`http://${host}`);
  return allowed.includes(req.headers.origin);
}
export async function handler(req, res, route, { backendFactory = backend } = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method !== 'POST') fail('Méthode non autorisée.', 405);
    if (!sameOrigin(req)) fail('Origine de la requête refusée.', 403);
    const body = await readBody(req);
    if (route !== 'garden' && !isRoomId(body.roomId)) fail('Jardin invalide.', 400);
    const { db, auth } = backendFactory();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) fail('Connexion au jardin requise.', 401);
    let user;
    try { user = await auth.verifyIdToken(token); } catch { fail('Session expirée. Recharge la page.', 401); }
    if (route === 'garden') {
      const result = await commonGarden(db);
      res.statusCode = 200; res.end(JSON.stringify(result)); return;
    }
    if (!(await db.doc(`rooms/${body.roomId}/members/${user.uid}`).get()).exists) fail('Accès au jardin refusé.', 403);
    const service = createIntegrityService({ db });
    let result;
    if (route === 'analyze') {
      if (!process.env.OPENAI_API_KEY) fail('L’analyse sera activée quand Abdennour aura renseigné la clé API dans Vercel.', 503);
      if (typeof body.mealId !== 'string' || !/^(abdennour|isabelle|sherine|meriem)_[0-6]_(breakfast|lunch|dinner|snack)$/.test(body.mealId)) fail('Repas invalide.', 400);
      result = await service.checkMeal(body.roomId, body.mealId, user.uid);
    } else {
      const secret = process.env.ADMIN_PASSWORD;
      if (!secret || secret.length < 16) fail('Configure ADMIN_PASSWORD dans Vercel (16 caractères minimum).', 503);
      const secure = !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host);
      const cookie = value => `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${value ? 14400 : 0}${secure ? '; Secure' : ''}`;
      if (body.action === 'login') {
        // Persistent limit also covers new anonymous identities from the same IP.
        const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
        const limitId = createHash('sha256').update(ip).digest('hex');
        const limitRef = db.doc(`adminLoginLimits/${limitId}`);
        const window = Math.floor(Date.now() / 600000);
        await db.runTransaction(async tx => {
          const previous = (await tx.get(limitRef)).data();
          const attempts = previous?.window === window ? previous.attempts : 0;
          if (attempts >= 10) fail('Trop de tentatives. Réessaie dans dix minutes.', 429);
          tx.set(limitRef, { window, attempts: attempts + 1 });
        });
        if (typeof body.password !== 'string' || !sameSecret(body.password, secret)) fail('Mot de passe incorrect.', 401);
        res.setHeader('Set-Cookie', cookie(signSession({ uid: user.uid, room: body.roomId }, secret)));
        result = { authenticated: true };
      } else {
        const value = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
        if (!verifySession(value, secret, { uid: user.uid, room: body.roomId })) fail('Connecte-toi à l’espace administrateur.', 401);
        if (body.action === 'logout') { res.setHeader('Set-Cookie', cookie('')); result = { authenticated: false }; }
        else if (body.action === 'list') result = await service.listReviews(body.roomId);
        else if (body.action === 'decide') result = await service.decide(body.roomId, body.reviewId, body.decision);
        else fail('Action inconnue.', 400);
      }
    }
    res.statusCode = 200; res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = error.status || 500;
    // Never return raw SDK errors or credential details to the browser.
    res.end(JSON.stringify({ error: error.status ? error.message : 'Le serveur ne peut pas terminer cette opération. Réessaie.' }));
  }
}
