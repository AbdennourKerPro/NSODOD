import { PEOPLE, COLORS, DAYS, MEAL_TYPES, CHALLENGE_START, addDays, challengePhase, dateLabel, dayIndex, emptyState, entryKey, karaokeShares, mealKey, personStats, profileColor, ranking, todayISO, voteSummary } from './domain.mjs';
import { cloudConfigured, createStore, preference } from './store.mjs';

const root = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
let state = emptyState();
let store;
let selected = PEOPLE.find(person => person.id === preference('person')) || null;
let page = 'dashboard';
let activeDay = 0;
let connection = cloudConfigured ? 'connecting' : 'local';
let busy = false;
let fatalError = '';
let toastTimer;
let lastToday = todayISO();
let homeRulesOpen = false;
let colorDraft = null;
let settingsBusy = false;
let mealBusy = false;
let mealDraft = null;
const pendingAnalyses = new Map();
let adminBusy = false;
let adminData = null;
const celebrationDate = addDays(CHALLENGE_START, DAYS);

const paths = {
  sprout: '<path d="M12 21v-9M12 13C5 14 3 8 3 4c7 0 10 4 9 9Zm0-3c0-6 5-8 9-8 0 6-4 10-9 8Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v5m-4 2h8"/>',
  fire: '<path d="M12 3c1 4-3 5-3 8 0 1 1 2 2 2 2-1 2-3 2-3 3 2 5 4 5 6a6 6 0 0 1-12 0C4 10 10 8 12 3Z"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  link: '<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',
  settings: '<path d="m9 3-.6 2-2 .9-1.9-.5-2 3.4 1.3 1.5v2.4L2.5 14l2 3.4 1.9-.5 2 .9.6 2.2h4l.6-2.2 2-.9 1.9.5 2-3.4-1.3-1.3v-2.4l1.3-1.5-2-3.4-1.9.5-2-.9L13 3Z"/><circle cx="11" cy="11.5" r="3"/>',
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sprout}</svg>`; }
function escape(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function mascot(person, mood = 'neutral', extra = '', colorOverride = null) {
  const phase = Math.max(0, PEOPLE.findIndex(candidate => candidate.id === person?.id));
  const color = colorOverride || (person ? profileColor(state, person.id) : 'green');
  // Keep the SVG filter in this document: external SVG filters can leave the sprite green.
  const royalFilter = color === 'royal' ? ';filter:url(#mascot-royal)' : '';
  return `<div class="mascot ${color} mood-${mood} ${extra}" style="--mascot-delay:-${phase * .7}s${royalFilter}" role="img" aria-label="${person ? escape(person.plant) : 'Une petite pousse'}, ${mood === 'happy' ? 'en pleine forme' : mood === 'sad' ? 'un peu raplapla' : 'prête pour le défi'}"></div>`;
}
function badge() {
  const labels = { local: 'Sur cet appareil', connecting: 'Connexion au jardin…', shared: 'Jardin partagé', offline: 'Hors connexion', pending: 'Envoi en cours…', error: 'Connexion interrompue' };
  return `<span class="connection ${connection}" title="${connection === 'local' ? 'Tes résultats sont sauvegardés dans ce navigateur.' : 'Les résultats du jardin sont partagés entre les complices.'}"><span></span>${labels[connection]}</span>`;
}
function header(home = false) {
  return `<header class="site-header"><div class="header-inner"><button class="brand" data-action="home" aria-label="NSOD'OD, choisir un profil"><span class="brand-mark">${icon('sprout')}</span><span>NSOD'OD<small>LE DÉFI QUI FAIT POUSSER</small></span></button>${home ? '<span class="home-badge">7 jours <span>·</span> 4 complices</span>' : `<nav aria-label="Navigation principale"><button class="nav-link ${page === 'dashboard' ? 'active' : ''}" data-action="navigate" data-page="dashboard" ${page === 'dashboard' ? 'aria-current="page"' : ''}>Le jardin</button><button class="nav-link ${page === 'rules' ? 'active' : ''}" data-action="navigate" data-page="rules" ${page === 'rules' ? 'aria-current="page"' : ''}>Le défi</button></nav><div class="header-actions"><button class="invite-button" data-action="invite" aria-label="Inviter mes complices">${icon('link')}<span>Inviter mes complices</span></button><button class="profile-button" data-action="profiles" aria-label="Changer de profil, actuellement ${selected.name}"><span class="avatar ${profileColor(state, selected.id)}">${selected.name[0]}</span><span>${selected.name}</span>${icon('chevron')}</button></div>`}</div></header>`;
}
function footer() {
  return `<footer class="site-footer"><p>Designé et mis en ligne par Abdennour</p><p>No Sugar Or Die of Diabetes</p></footer>`;
}
function challengeRules(showHeading = true) {
  return `<section class="challenge-rules" aria-label="Les règles du défi">
    ${showHeading ? '<h2>Les règles du défi</h2>' : ''}
    <dl>
      <div><dt>Pas de sucres ajoutés</dt><dd>Pendant sept jours, pas de sucre blanc ou roux, miel, sirops, bonbons, biscuits, pâtisseries ni boissons sucrées. Regardez la liste des ingrédients : la ligne « dont sucres » inclut aussi les sucres naturellement présents.</dd></div>
      <div><dt>Pas de produits ultra-transformés</dt><dd>On écarte aussi les sodas light, snacks aromatisés, nuggets industriels ou nouilles instantanées, même sans sucre. Un aliment emballé, en conserve ou surgelé n’est pas automatiquement ultra-transformé : privilégiez les ingrédients simples.</dd></div>
      <div><dt>Les fruits restent</dt><dd>Les fruits entiers gardent leur place dans vos repas et collations. Leurs sucres naturels ne font pas échouer le défi. Préférez-les aux jus, et gardez l’eau comme boisson habituelle.</dd></div>
      <div><dt>Les glucides aussi</dt><dd>Pâtes nature, riz, pain simple, pommes de terre et légumineuses sont les bienvenus : ils apportent de l’énergie. Variez les sources, avec des versions complètes ou semi-complètes selon vos goûts. Le défi ne consiste pas à supprimer les glucides.</dd></div>
      <div><dt>Un bilan chaque jour</dt><dd>Gardez des repas suffisants, selon votre faim et vos besoins. Un écart se note simplement, sans sauter de repas pour compenser. Chaque journée respectant les deux règles vaut un point, jusqu’à sept ; les égalités partagent la même place.</dd></div>
    </dl>
    <p class="rules-sources">Liens utiles : <a href="https://www.mangerbouger.fr/manger-mieux/s-informer-sur-les-produits-qu-on-achete/comprendre-les-informations-nutritionnelles-et-les-etiquettes/les-aliments-ultra-transformes-pourquoi-moins-en-manger" target="_blank" rel="noopener noreferrer">produits ultra-transformés</a> · <a href="https://www.mangerbouger.fr/l-essentiel/les-recommandations-sur-l-alimentation-l-activite-physique-et-la-sedentarite/reduire/reduire-les-boissons-sucrees-aliments-gras-sucres-sales-et-ultra-transformes" target="_blank" rel="noopener noreferrer">fruits et boissons</a> · <a href="https://www.mangerbouger.fr/l-essentiel/les-recommandations-sur-l-alimentation-l-activite-physique-et-la-sedentarite/aller-vers/aller-vers-les-feculents-complets" target="_blank" rel="noopener noreferrer">féculents</a></p>
  </section>`;
}
function home() {
  return `<div class="home-screen"><main id="main" class="minimal-home">
    <h1 class="visually-hidden">Choisir son profil</h1>
    <section class="home-profiles" aria-label="Les quatre participants">
      ${PEOPLE.map(person => {
        const { mood } = personStats(state, person.id);
        const label = mood === 'happy' ? 'En pleine forme' : mood === 'sad' ? 'Un peu raplapla' : person.id === 'abdennour' ? 'Prêt pour le défi' : 'Prête pour le défi';
        return `<button class="home-profile" data-action="select" data-person="${person.id}" aria-label="Ouvrir le profil de ${person.name}, ${label.toLowerCase()}">
          <span class="home-mascot-scene">${mascot(person, mood)}</span>
          <strong>${person.name}</strong><span class="home-profile-state">${label}</span>
        </button>`;
      }).join('')}
    </section>
  </main>${footer()}<div class="home-rules-toggle"><button class="rules-toggle" data-action="toggle-home-rules" aria-expanded="${homeRulesOpen}" aria-controls="home-rules">Les règles du défi ${icon('chevron')}</button></div></div>
  <section id="home-rules" class="home-rules-section" aria-label="Règles du défi" tabindex="-1" ${homeRulesOpen ? '' : 'hidden'}>${challengeRules()}<button class="text-button" data-action="close-home-rules">Revenir aux profils</button></section>`;
}
function selectedDayCard(stats, index) {
  if (index < 0) return preparationCard();
  const date = addDays(state.startDate, activeDay);
  const status = stats.statuses[activeDay];
  const future = activeDay > index;
  const current = activeDay === index;
  const disabled = busy || !store || future || ['connecting', 'offline', 'pending', 'error'].includes(connection);
  return `<section class="tracker-card panel" aria-labelledby="tracker-title"><div class="card-heading"><div><span class="eyebrow">PETIT BILAN, GRANDE POUSSE</span><h2 id="tracker-title">Ta semaine, jour après jour.</h2></div><span class="seven-badge">${icon('calendar')} 7 jours</span></div><div class="week-grid" aria-label="Choisir une journée">${stats.statuses.map((result, day) => {
    const isFuture = day > index;
    return `<button class="day-cell ${day === activeDay ? 'selected' : ''} ${result || ''} ${isFuture ? 'future' : ''}" data-action="day" data-day="${day}" aria-pressed="${day === activeDay}" aria-label="Jour ${day + 1}, ${dateLabel(addDays(state.startDate, day))}, ${result === 'success' ? 'réussi' : result === 'failure' ? 'craqué' : isFuture ? 'à venir' : 'à renseigner'}"><span class="day-name">J${day + 1}</span><span class="day-circle">${result === 'success' ? icon('check') : result === 'failure' ? icon('heart') : isFuture ? icon('lock') : '<span class="day-dot"></span>'}</span><span class="day-date">${day === index ? '<span class="long-date">Aujourd’hui</span><span class="short-date">Auj.</span>' : dateLabel(addDays(state.startDate, day))}</span></button>`;
  }).join('')}</div>${calendarCelebration()}<div class="daily-divider"></div><div class="daily-title"><span>${future ? icon('lock') : icon('sun')} ${current ? 'Aujourd’hui' : `Jour ${activeDay + 1}`} <span class="date-light">· ${dateLabel(date, { weekday: 'long', month: 'long' })}</span></span>${status ? `<span class="saved-status ${status}">${icon('check')} ${connection === 'pending' ? 'En attente' : 'Enregistré'}</span>` : ''}</div><h3>${future ? 'Chaque chose en son temps.' : status === 'success' ? 'Une belle victoire pour ton jardin !' : status === 'failure' ? 'Une pause, puis on repart.' : 'Alors, cette journée sans sucre ?'}</h3><p class="daily-description">${future ? 'Tu pourras noter ton résultat à partir de cette date.' : status === 'success' ? `${selected.plant} te dit merci. Tu peux corriger ton bilan si besoin.` : status === 'failure' ? 'Un écart ne remet pas tes victoires à zéro. Demain, on continue.' : 'Fais ton bilan en fin de journée. Promis, ici on ne juge pas.'}</p><div class="result-buttons"><button class="result-button success ${status === 'success' ? 'chosen' : ''}" data-action="record" data-status="success" ${disabled ? 'disabled' : ''} aria-pressed="${status === 'success'}">${icon('check')}<span>J’ai tenu bon<small>Les deux règles respectées</small></span>${status === 'success' ? '<span class="result-check">✓</span>' : ''}</button><button class="result-button failure ${status === 'failure' ? 'chosen' : ''}" data-action="record" data-status="failure" ${disabled ? 'disabled' : ''} aria-pressed="${status === 'failure'}">${icon('heart')}<span>J’ai craqué<small>Ça arrive, on continue</small></span>${status === 'failure' ? '<span class="result-check">✓</span>' : ''}</button></div>${status ? `<button class="text-button undo" data-action="undo" ${disabled ? 'disabled' : ''}>Effacer ce bilan</button>` : `<p class="daily-hint">${icon('info')} Les jours passés peuvent aussi être renseignés.</p>`}</section>`;
}
function preparationCard() {
  return `<section class="tracker-card panel preparation-panel" aria-labelledby="tracker-title">
    <div class="card-heading"><div><span class="eyebrow">AVANT LE DÉPART</span><h2 id="tracker-title">On se prépare tranquillement.</h2></div><span class="seven-badge">${icon('calendar')} ${dateLabel(state.startDate)}</span></div>
    <p class="daily-description">Le défi commence le ${dateLabel(state.startDate, { day: 'numeric', month: 'long' })}. D’ici là, quelques idées pour faciliter la semaine :</p>
    ${preparationCalendar()}
    <ul class="preparation-tips">
      <li><strong>Prévois quelques repas</strong><span>Fais le plein de légumes, de fruits entiers et d’aliments simples à cuisiner.</span></li>
      <li><strong>Garde les féculents</strong><span>Pâtes, riz et pain restent au menu ; choisis-les complets ou semi-complets quand tu peux.</span></li>
      <li><strong>Prépare tes encas</strong><span>Un fruit entier, un yaourt nature sans sucre ajouté ou quelques noix non salées feront l’affaire.</span></li>
      <li><strong>Change les boissons</strong><span>Prévois de l’eau, du thé ou une infusion sans sucre à la place des boissons sucrées.</span></li>
    </ul>
    <p class="daily-hint">${icon('info')} Le premier bilan sera disponible le ${dateLabel(state.startDate, { day: 'numeric', month: 'long' })}.</p>
    <button class="text-button" data-action="navigate" data-page="rules">Relire les règles du défi</button>
    <p class="rules-sources">Liens utiles : <a href="https://www.mangerbouger.fr/manger-mieux" target="_blank" rel="noopener noreferrer">préparer des repas variés</a> · <a href="https://www.mangerbouger.fr/l-essentiel/les-recommandations-sur-l-alimentation-l-activite-physique-et-la-sedentarite/reduire/reduire-les-boissons-sucrees-aliments-gras-sucres-sales-et-ultra-transformes" target="_blank" rel="noopener noreferrer">boissons et produits ultra-transformés</a></p>
  </section>`;
}
function calendarCelebration() {
  const date = dateLabel(celebrationDate, { weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="calendar-celebration">${icon('people')}<div><strong><time datetime="${celebrationDate}">${date[0].toUpperCase() + date.slice(1)}</time> · On fête la fin du défi</strong><p>Karaoké entre nous 🎤 · 72 € à partager selon nos résultats.</p><button class="karaoke-jump" data-action="karaoke">Voir nos billets karaoké ↓</button></div></div>`;
}
function preparationCalendar() {
  return `<div class="preparation-calendar" aria-label="Calendrier du défi et de la sortie"><div class="week-grid">${Array.from({ length: DAYS }, (_, day) => {
    const date = addDays(state.startDate, day);
    return `<div class="day-cell ${day === DAYS - 1 ? 'final-day' : ''}" aria-label="${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}${day === DAYS - 1 ? ', dernier jour du défi' : ''}"><span class="day-name">${dateLabel(date, { weekday: 'short', day: undefined, month: undefined })}</span><span class="day-circle">${dateLabel(date, { day: 'numeric', month: undefined })}</span><span class="day-date">${day === DAYS - 1 ? 'Fin' : `J${day + 1}`}</span></div>`;
  }).join('')}</div><p class="calendar-end">Dernier bilan : ${dateLabel(addDays(state.startDate, DAYS - 1), { weekday: 'long', day: 'numeric', month: 'long' })}.</p>${calendarCelebration()}</div>`;
}
function extensionVote() {
  if (!['final', 'finished'].includes(challengePhase(state))) return '';
  const summary = voteSummary(state);
  const choice = state.votes?.[selected.id];
  const disabled = busy || !store || ['connecting', 'offline', 'pending', 'error'].includes(connection);
  const decision = summary.decision === 'extend' ? 'La majorité souhaite prolonger. Choisissez ensemble la durée de la suite.' : summary.decision === 'stop' ? 'La majorité souhaite terminer ici. Bravo pour cette semaine !' : summary.decision === 'tie' ? 'Deux voix de chaque côté. Discutez ensemble de la suite.' : `Il reste ${summary.remaining} ${summary.remaining > 1 ? 'votes' : 'vote'} avant de connaître le choix du groupe.`;
  return `<section class="extension-vote panel" aria-labelledby="vote-title">
    <div class="card-heading"><div><span class="eyebrow">ET APRÈS CETTE SEMAINE ?</span><h2 id="vote-title">On prolonge le défi ?</h2></div></div>
    <p>Chacun donne son avis. Un vote par personne, modifiable à tout moment.</p>
    <div class="vote-buttons" role="group" aria-label="Ton vote pour la suite"><button class="vote-button" data-action="vote" data-vote="yes" aria-pressed="${choice === 'yes'}" ${disabled ? 'disabled' : ''}>${icon('check')} Prolonger</button><button class="vote-button" data-action="vote" data-vote="no" aria-pressed="${choice === 'no'}" ${disabled ? 'disabled' : ''}>${icon('close')} S’arrêter ici</button></div>
    <p>${choice ? `Ton vote : ${choice === 'yes' ? 'prolonger' : 's’arrêter ici'}. Tu peux changer d’avis.` : 'Choisis une option pour enregistrer ton vote.'}</p>
    <div class="vote-tally" aria-live="polite"><strong>${summary.yes} pour · ${summary.no} contre</strong><span>${summary.total} / 4 votes</span></div>
    <ul class="vote-participants">${PEOPLE.map(person => `<li><span>${person.name}</span><span>${state.votes?.[person.id] === 'yes' ? 'Pour' : state.votes?.[person.id] === 'no' ? 'Contre' : 'Pas encore voté'}</span></li>`).join('')}</ul>
    <p class="vote-result" role="status">${decision}</p>
  </section>`;
}
function plantCard(stats) {
  const copy = stats.mood === 'happy' ? ['En pleine forme !', 'Ta dernière victoire lui a donné des ailes. Continue à la faire pousser.'] : stats.mood === 'sad' ? ['Un peu raplapla…', 'Elle a besoin d’un peu de douceur. La prochaine victoire lui rendra le sourire.'] : ['Prête à grandir !', 'Elle attend ta première petite victoire. Prenez soin l’un de l’autre.'];
  return `<aside class="plant-card ${profileColor(state, selected.id)}" aria-labelledby="plant-title"><div class="plant-card-top"><span class="eyebrow">TA PETITE COMPAGNE</span><span class="plant-label">${selected.emoji} ${selected.plant}</span></div><div class="plant-stage"><span class="plant-spark">${stats.mood === 'sad' ? '☁' : '✳'}</span>${mascot(selected, stats.mood, 'dashboard-mascot')}</div><span class="mood-pill ${stats.mood}">${stats.mood === 'happy' ? icon('sun') : stats.mood === 'sad' ? icon('heart') : icon('sprout')}${copy[0]}</span><h2 id="plant-title">${selected.plant} croit en toi.</h2><p>${copy[1]}</p><div class="plant-progress"><div><span>Petites victoires</span><strong>${stats.successes} / 7</strong></div><div class="progress-track" role="progressbar" aria-label="Jours réussis" aria-valuemin="0" aria-valuemax="7" aria-valuenow="${stats.successes}"><span style="width:${stats.successes / 7 * 100}%"></span></div></div></aside>`;
}
function leaderboard() {
  const rows = ranking(state);
  const total = rows.reduce((sum, person) => sum + person.successes, 0);
  return `<section class="leaderboard panel" aria-labelledby="leaderboard-title"><div class="card-heading"><div><span class="eyebrow">LA FORCE DU COLLECTIF</span><h2 id="leaderboard-title">Le jardin des complices ${icon('trophy')}</h2></div><span class="group-total">${icon('sprout')}<strong>${total}</strong> / 28 victoires ensemble</span></div><div class="leaderboard-head"><span>COMPLICE</span><span>LA SEMAINE</span><span>JOURS RÉUSSIS</span></div><ol class="ranking-list">${rows.map(person => `<li class="rank-row ${person.id === selected.id ? 'is-you' : ''}"><span class="rank-number ${person.rank === 1 && person.successes ? 'first' : ''}">${person.rank || '—'}</span><span class="rank-avatar ${profileColor(state, person.id)}">${mascot(person, person.mood)}</span><div class="rank-person"><strong>${person.name}${person.id === selected.id ? '<span class="you-badge">Toi</span>' : ''}</strong><span>${person.mood === 'happy' ? `${person.plant} rayonne` : person.mood === 'sad' ? `${person.plant} reprend son souffle` : `${person.plant} attend sa première pousse`}${person.streak > 1 ? ` <span class="streak-inline">· ${person.streak} de suite ${icon('fire')}</span>` : ''}</span></div><div class="mini-week" aria-label="Semaine de ${person.name}">${person.statuses.map((status, day) => `<span class="mini-day ${status || ''} ${day > dayIndex(state.startDate) ? 'future' : ''}" title="Jour ${day + 1} : ${status === 'success' ? 'réussi' : status === 'failure' ? 'craqué' : 'sans bilan'}">${status === 'success' ? icon('check') : status === 'failure' ? '<span>·</span>' : ''}</span>`).join('')}</div><div class="rank-score"><strong>${person.successes}<span>/ 7</span></strong></div></li>`).join('')}</ol><div class="leaderboard-foot"><span><i class="legend-success"></i>Réussi <i class="legend-failure"></i>Craqué <i class="legend-empty"></i>Pas encore de bilan</span><span>À égalité ? Même place, même fierté.</span></div></section>`;
}
function mealsCard() {
  const index = dayIndex(state.startDate);
  const disabled = busy || !store || ['connecting', 'offline', 'pending', 'error'].includes(connection) || activeDay > index;
  return `<section class="meal-journal panel" aria-labelledby="meals-title"><div class="card-heading"><div><span class="eyebrow">DANS MON ASSIETTE</span><h2 id="meals-title">Le carnet de ${selected.name}</h2></div><span class="journal-date">${dateLabel(addDays(state.startDate, activeDay), { weekday: 'short' })}</span></div>
    <p class="journal-intro">Raconte tes repas avec tes mots : plats, boissons, encas… Pas besoin de compter les calories.</p>
    ${jokerCard()}
    <div class="journal-days" role="group" aria-label="Jour du carnet">${Array.from({ length: DAYS }, (_, day) => `<button data-action="day" data-day="${day}" aria-pressed="${day === activeDay}" ${day > index ? 'disabled' : ''}>${dateLabel(addDays(state.startDate, day), { day: 'numeric', month: undefined })} oct</button>`).join('')}</div>
    <div class="meal-grid">${MEAL_TYPES.map(type => {
      const meal = state.meals?.[mealKey(selected.id, activeDay, type.id)];
      const id = mealKey(selected.id, activeDay, type.id);
      const status = meal && state.analysisStates?.[id]?.mealVersion === meal.version ? state.analysisStates[id]?.status : null;
      const analyzing = pendingAnalyses.has(id) || status === 'pending';
      return `<article class="meal-note ${meal ? 'has-meal' : ''}"><h3><span aria-hidden="true">${type.emoji}</span> ${type.label}</h3>${meal ? `<p class="meal-text">${escape(meal.text)}</p><p class="analysis-caption">${analyzing ? '⏳ Analyse en cours…' : status === 'done' ? '✓ Analyse terminée · contrôle d’Abdennour' : status === 'error' ? 'Analyse indisponible · ton repas est sauvegardé' : 'Analyse à lancer'}</p>` : '<p class="meal-empty">Ton assiette attend son histoire.</p>'}<div class="meal-actions"><button class="text-button" data-action="edit-meal" data-type="${type.id}" ${disabled ? 'disabled' : ''}>${meal ? 'Modifier' : '+ Raconter'}</button>${meal && status !== 'done' ? `<button class="text-button" data-action="analyze-meal" data-meal="${id}" ${disabled || pendingAnalyses.has(id) ? 'disabled' : ''}>${analyzing ? 'Vérifier l’analyse' : 'Relancer l’analyse'}</button>` : ''}</div></article>`;
    }).join('')}</div>
    <p class="journal-foot">${index < 0 ? 'Le carnet ouvre le 3 octobre. ' : ''}Le texte est envoyé à GPT‑6 Luna après chaque ajout ou modification. Les alertes sont réservées à Abdennour : seule sa validation consomme un joker. Un repas vide ne compte pas. Ton bilan quotidien reste à renseigner toi-même.</p>
  </section>`;
}
function mealDialog(typeId) {
  const type = MEAL_TYPES.find(item => item.id === typeId);
  if (!type || !selected) return;
  const meal = state.meals?.[mealKey(selected.id, activeDay, typeId)];
  mealDraft = { participantId: selected.id, day: activeDay, type: typeId };
  openDialog(`<h2>${type.emoji} ${type.label}</h2><p>${escape(selected.name)} · ${dateLabel(addDays(state.startDate, activeDay), { weekday: 'long' })}</p><form id="meal-form"><label class="meal-label" for="meal-text">Qu’as-tu mangé et bu ?</label><textarea id="meal-text" name="text" rows="7" required maxlength="2000" placeholder="Par exemple : pâtes aux légumes, yaourt nature et eau. Une pomme dans l’après-midi.">${escape(meal?.text || '')}</textarea><p class="meal-help">Texte libre · 2 000 caractères maximum. Pour les collations, tu peux noter plusieurs encas.</p><div id="meal-error" role="alert"></div><div class="dialog-buttons"><button type="button" class="outline-button" data-action="close-dialog">Annuler</button><button type="submit" class="solid-button">Enregistrer</button></div>${meal ? '<button type="button" class="meal-delete" data-action="delete-meal">Supprimer cette note</button>' : ''}</form>`, 'meal');
}
async function submitMeal(event) {
  if (event.target.id !== 'meal-form') return;
  event.preventDefault();
  if (mealBusy || !mealDraft || !store) return;
  const text = dialog.querySelector('#meal-text').value.trim();
  if (!text) { dialog.querySelector('#meal-error').textContent = 'Écris quelques mots sur ton repas.'; return; }
  mealBusy = true;
  const saved = { ...mealDraft, text };
  let success = false;
  dialog.querySelectorAll('button,textarea').forEach(item => { item.disabled = true; });
  try { await store.saveMeal(saved); success = true; dialog.close(); toast('Ton repas est noté dans le carnet.'); }
  catch (error) { dialog.querySelector('#meal-error').textContent = friendlyError(error); }
  finally { mealBusy = false; dialog.querySelectorAll('button,textarea').forEach(item => { item.disabled = false; }); }
  if (success) await requestAnalysis(mealKey(saved.participantId, saved.day, saved.type));
}
function jokerCard() {
  return `<div class="joker-strip" aria-label="Jokers du défi">${PEOPLE.map(person => {
    const count = state.jokerCounts?.[person.id]?.confirmed || 0;
    return `<div class="joker-person ${person.id === selected.id ? 'is-you' : ''}"><strong>${person.name}</strong><span class="joker-dots" aria-hidden="true">${Array.from({ length: 3 }, (_, index) => `<i class="${index < count ? 'used' : ''}">✦</i>`).join('')}</span><small>${Math.min(count, 3)} / 3 utilisé${count > 1 ? 's' : ''}${count > 3 ? ` · ${count - 3} dépassement${count > 4 ? 's' : ''}` : ''}</small></div>`;
  }).join('')}</div>${selected.id === 'abdennour' ? '<button class="admin-entry" data-action="admin-open">🔐 Mon espace de contrôle</button>' : ''}`;
}
async function requestAnalysis(id) {
  if (!store) return;
  // A newly saved revision must be checked even while its previous analysis runs.
  pendingAnalyses.set(id, (pendingAnalyses.get(id) || 0) + 1); render();
  try { await store.api('analyze', { mealId: id }); }
  catch (error) { toast(`Repas sauvegardé. ${friendlyError(error)}`, true); }
  finally {
    const remaining = pendingAnalyses.get(id) - 1;
    if (remaining) pendingAnalyses.set(id, remaining);
    else pendingAnalyses.delete(id);
    render();
  }
}
function adminLoginDialog(error = '') {
  openDialog(`<span class="eyebrow">RÉSERVÉ À ABDENNOUR</span><h2>Le contrôle des repas</h2><p>Connecte-toi pour examiner les alertes. Une analyse seule ne retire jamais de joker.</p><form id="admin-login-form"><label class="meal-label" for="admin-password">Ton mot de passe administrateur</label><input id="admin-password" type="password" autocomplete="current-password" required /><p class="admin-error" role="alert">${escape(error)}</p><div class="dialog-buttons"><button type="button" class="outline-button" data-action="close-dialog">Fermer</button><button type="submit" class="solid-button">Se connecter</button></div></form>`, 'admin');
}
function adminReviewsDialog(error = '') {
  const reviews = adminData?.reviews || [];
  const pending = reviews.filter(item => item.decision === 'pending' && !item.obsolete).length;
  openDialog(`<span class="eyebrow">TON JUGEMENT, LEURS JOKERS</span><h2>Le contrôle des repas</h2><p>${pending} alerte${pending > 1 ? 's' : ''} à juger. Un joker par repas validé, jamais par modification. Deux repas concernés le même jour = deux jokers.</p><div class="admin-toolbar"><button class="outline-button" data-action="admin-refresh" ${adminBusy ? 'disabled' : ''}>Actualiser</button><button class="text-button" data-action="admin-logout" ${adminBusy ? 'disabled' : ''}>Se déconnecter</button></div><p class="admin-error" role="alert">${escape(error)}</p>
    <div class="admin-reviews">${reviews.length ? reviews.map(review => {
      const person = PEOPLE.find(item => item.id === review.participantId);
      const type = MEAL_TYPES.find(item => item.id === review.type);
      return `<article class="admin-review"><div class="review-heading"><strong>${escape(person?.name || '')} · ${escape(type?.label || '')}</strong><span>${dateLabel(addDays(state.startDate, review.day))}</span></div><span class="review-badge">${review.obsolete ? 'Ancienne version · repas modifié ou supprimé' : review.decision === 'accepted' ? 'Validé par toi' : review.decision === 'rejected' ? 'Rejeté par toi' : review.verdict === 'uncertain' ? 'À clarifier' : 'Produit potentiellement interdit'}</span><p class="meal-text">${escape(review.text)}</p><p class="review-reason">${escape(review.reason)}</p>${review.products.length ? `<p class="review-products">À vérifier : ${review.products.map(escape).join(', ')}</p>` : ''}<div class="review-buttons">${review.decision !== 'accepted' && !review.obsolete ? `<button class="solid-button" data-action="admin-decide" data-review="${review.id}" data-decision="accepted" ${adminBusy ? 'disabled' : ''}>Valider · 1 joker</button>` : ''}${review.decision !== 'rejected' ? `<button class="outline-button" data-action="admin-decide" data-review="${review.id}" data-decision="rejected" ${adminBusy ? 'disabled' : ''}>${review.decision === 'accepted' ? 'Annuler ma validation' : 'Rejeter l’alerte'}</button>` : ''}</div></article>`;
    }).join('') : '<p class="admin-empty">Aucune alerte pour le moment. Les repas sans problème signalé ne demandent pas de jugement.</p>'}</div>
    ${adminData?.unchecked?.length ? `<h3 class="unchecked-heading">Repas sans analyse terminée</h3><div class="admin-reviews">${adminData.unchecked.map(meal => `<article class="admin-review"><strong>${escape(PEOPLE.find(person => person.id === meal.participantId)?.name || '')} · ${escape(MEAL_TYPES.find(type => type.id === meal.type)?.label || '')} · ${dateLabel(addDays(state.startDate, meal.day))}</strong><p class="meal-text">${escape(meal.text)}</p><button class="outline-button" data-action="admin-analyze" data-meal="${meal.mealId}" ${adminBusy ? 'disabled' : ''}>Relancer l’analyse</button></article>`).join('')}</div>` : ''}
    <p class="meal-help">Les versions modifiées ne peuvent plus être validées. Une validation passée reste comptée si le repas est édité ou supprimé ; tu peux l’annuler ici. Les dépassements des trois jokers sont signalés sans toucher au bilan ou au karaoké.</p>`, 'admin');
}
async function refreshAdmin() {
  try { adminData = await store.api('admin', { action: 'list' }); adminReviewsDialog(); }
  catch (error) { adminData = null; adminLoginDialog(friendlyError(error)); }
}
async function loginAdmin(event) {
  if (event.target.id !== 'admin-login-form') return;
  event.preventDefault();
  if (adminBusy || !store) return;
  const password = dialog.querySelector('#admin-password').value;
  dialog.querySelector('#admin-password').value = '';
  adminBusy = true; dialog.querySelectorAll('button,input').forEach(item => { item.disabled = true; });
  try { await store.api('admin', { action: 'login', password }); adminBusy = false; await refreshAdmin(); }
  catch (error) { adminLoginDialog(friendlyError(error)); }
  finally { adminBusy = false; }
}
function money(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
}
function karaokeCard() {
  const bill = karaokeShares(state);
  return `<section class="karaoke panel" aria-labelledby="karaoke-title">
    <div class="card-heading"><div><span class="eyebrow">LE 10 OCTOBRE · TOUS AU MICRO</span><h2 id="karaoke-title">Les billets du karaoké 🎤</h2></div><span class="karaoke-total">${money(bill.totalCents)}<small>pour nous quatre</small></span></div>
    <p class="karaoke-intro">Plus tu tiens le défi, plus ton billet s’allège. La playlist, elle, reste pour tout le monde.</p>
    <div class="karaoke-status"><span class="karaoke-label">${bill.final ? 'Répartition finale' : 'Estimation en direct'}</span><span>${bill.recorded} / 28 bilans renseignés</span></div>
    <ol class="karaoke-tickets">${bill.shares.map(person => `<li class="karaoke-ticket ${person.id === selected.id ? 'is-you' : ''}">
      <div class="ticket-top"><span>${person.rank ? `#${person.rank} au jardin` : 'Au départ'}</span><span aria-hidden="true">♫</span></div>
      <div class="ticket-mascot">${mascot(person, person.mood)}</div>
      <h3>${person.name}${person.id === selected.id ? '<span class="you-badge">Toi</span>' : ''}</h3>
      <p class="ticket-results">${person.successes} réussi${person.successes > 1 ? 's' : ''} · ${person.failures} craqué${person.failures > 1 ? 's' : ''}</p>
      <div class="ticket-price"><strong>${money(person.cents)}</strong><span>${person.cents < 1800 ? 'Bravo, billet allégé !' : person.cents > 1800 ? 'Tu offres un peu plus de décibels' : 'Le juste milieu'}</span></div>
      <div class="ticket-adjustment">${person.cents === 1800 ? 'La part de départ : 18 €' : `${person.cents < 1800 ? '−' : '+'}${money(Math.abs(person.cents - 1800))} par rapport aux 18 € de départ`}</div>
    </li>`).join('')}</ol>
    <p class="karaoke-note">${bill.final ? 'Les sept jours sont terminés et tous les bilans sont remplis. Une correction de bilan recalculera les parts.' : `${bill.remaining ? `Encore ${bill.remaining} bilan${bill.remaining > 1 ? 's' : ''} à renseigner. ` : ''}Montants provisoires : la répartition finale sera disponible le 10 octobre, une fois les 28 bilans remplis. Un jour sans bilan n’est pas compté comme un échec.`}</p>
    <details class="karaoke-formula"><summary>Comment sont calculés nos billets ?</summary><div>
      <p>On part de <strong>18 € chacun</strong>. Ta part = <strong>18 € + 2 € × (moyenne des jours réussis du groupe − tes jours réussis)</strong>.</p>
      <p>Un jour réussi de plus que quelqu’un d’autre donne une part <strong>2 € moins chère</strong> que la sienne. À la fin, avec sept bilans chacun, plus tu as de jours ratés, plus tu contribues. À égalité, même prix.</p>
      <p>Exemple : <strong>7, 5, 3 et 1 jours réussis → 12 €, 16 €, 20 € et 24 €</strong>. À scores égaux : 18 € chacun. Le total reste toujours 72 €, avec des parts entre 7,50 € et 28,50 €.</p>
      <p>Seuls les sept jours du 3 au 9 octobre comptent pour cette sortie, même si vous votez pour prolonger le défi.</p>
    </div></details>
  </section>`;
}
function dashboard() {
  const index = dayIndex(state.startDate);
  const stats = personStats(state, selected.id);
  const range = `${dateLabel(state.startDate)} — ${dateLabel(addDays(state.startDate, 6), { year: 'numeric' })}`;
  const dayText = index < 0 ? `Départ le ${dateLabel(state.startDate, { day: 'numeric', month: 'long' })}` : index >= DAYS ? 'Semaine terminée' : `Jour ${index + 1} sur 7`;
  return `${header()}<main id="main" class="dashboard-main"><section class="dashboard-title"><div><div class="title-eyebrow"><span class="eyebrow">BIENVENUE DANS TON PETIT JARDIN</span>${badge()}</div><h1>Salut, ${selected.name}<span class="greeting-sun">${icon('sun')}</span></h1><p>Chaque jour sans sucre, c’est une nouvelle pousse.</p></div><div class="challenge-date"><span>${icon('calendar')}${range}</span><strong><span class="small-dot"></span>${dayText}</strong></div></section>${['offline', 'pending', 'error'].includes(connection) ? `<div class="connection-banner" role="status">${icon('info')}${connection === 'error' ? 'La connexion au jardin est interrompue. Recharge cette page pour réessayer.' : connection === 'pending' ? 'Ta modification attend sa confirmation. Garde cette page ouverte pendant l’envoi.' : 'Le jardin partagé est momentanément hors connexion. Les bilans seront disponibles quand la connexion reviendra.'}${connection === 'error' ? '<button class="outline-button" data-action="retry">Réessayer</button>' : ''}</div>` : ''}<section class="stats-grid" aria-label="Ton bilan de la semaine"><div class="stat-card"><span class="stat-icon stat-green">${icon('sprout')}</span><div><span>Jours réussis</span><strong>${stats.successes}<small> / 7</small></strong></div><span class="stat-caption">${stats.successes ? 'Bien joué !' : 'Tout peut pousser'}</span></div><div class="stat-card"><span class="stat-icon stat-orange">${icon('fire')}</span><div><span>Série en cours</span><strong>${stats.streak}<small> ${stats.streak > 1 ? 'jours' : 'jour'}</small></strong></div><span class="stat-caption">${stats.streak > 1 ? 'Ça pousse fort' : 'Une pousse à la fois'}</span></div><div class="stat-card"><span class="stat-icon stat-purple">${icon('trophy')}</span><div><span>Ta place au jardin</span><strong>${ranking(state).find(person => person.id === selected.id).rank ? '#' + ranking(state).find(person => person.id === selected.id).rank : '—'}<small> / 4</small></strong></div><span class="stat-caption">${Object.keys(state.entries).length ? 'Ensemble, on avance' : 'Le défi commence'}</span></div></section><div class="dashboard-grid">${selectedDayCard(stats, index)}${plantCard(stats)}</div>${mealsCard()}${extensionVote()}${leaderboard()}${karaokeCard()}<div class="kind-note">${icon('heart')}<p><strong>Une journée ratée n’est pas un défi raté.</strong> Tes victoires restent, ta plante t’attend. On continue ensemble.</p><span>✳</span></div></main>${footer()}`;
}
function rulesPage() {
  return `${header()}<main id="main" class="rules-main"><h1>Les règles du défi</h1>${challengeRules(false)}<section class="start-settings panel"><div><h2>Du ${dateLabel(state.startDate, { day: 'numeric', month: 'long' })} au ${dateLabel(addDays(state.startDate, DAYS - 1), { day: 'numeric', month: 'long', year: 'numeric' })}</h2><p>Les bilans s’ouvrent le premier jour. Le dernier jour, chacun peut voter pour prolonger le défi ou s’arrêter ici.</p></div></section><button class="solid-button back-garden" data-action="navigate" data-page="dashboard">${icon('sprout')} Retour au jardin</button></main>${footer()}`;
}
function render() {
  const focused = document.activeElement?.closest('[data-action]');
  const focusAction = focused?.dataset.action;
  const focusDay = focused?.dataset.day;
  const focusStatus = focused?.dataset.status;
  const focusPerson = focused?.dataset.person;
  const focusPage = focused?.dataset.page;
  const focusVote = focused?.dataset.vote;
  if (fatalError) {
    root.innerHTML = `${header(true)}<main id="main" class="error-page"><span>🌱</span><h1>Le jardin a besoin d’un instant.</h1><p>${escape(fatalError)}</p><button class="solid-button" data-action="retry">${icon('refresh')} Réessayer</button></main>`;
    return;
  }
  root.innerHTML = !selected ? home() : page === 'rules' ? rulesPage() : dashboard();
  if (focusAction) {
    const candidate = Array.from(root.querySelectorAll('[data-action]')).find(element => element.dataset.action === focusAction && element.dataset.day === focusDay && element.dataset.status === focusStatus && element.dataset.person === focusPerson && element.dataset.page === focusPage && element.dataset.vote === focusVote);
    candidate?.focus({ preventScroll: true });
  }
  if (dialog.open && dialog.dataset.view === 'settings') {
    dialog.querySelector('[data-action="save-color"]').disabled = settingsBusy || !store || ['connecting', 'offline', 'pending', 'error'].includes(connection);
  }
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  const element = document.querySelector('#toast');
  element.innerHTML = `${icon(error ? 'info' : 'check')}<span>${escape(message)}</span>`;
  element.className = `visible ${error ? 'error' : ''}`;
  toastTimer = setTimeout(() => { element.className = ''; }, error ? 6500 : 4000);
}
function openDialog(content, view = '') {
  dialog.dataset.view = view;
  dialog.innerHTML = `<button class="dialog-close" aria-label="Fermer" data-action="close-dialog" ${settingsBusy ? 'disabled' : ''}>${icon('close')}</button>${content}`;
  const heading = dialog.querySelector('h2');
  heading.id = 'dialog-title';
  heading.tabIndex = -1;
  dialog.setAttribute('aria-labelledby', heading.id);
  if (!dialog.open) dialog.showModal();
  heading.focus({ preventScroll: true });
}
function profilesDialog() {
  openDialog(`<span class="eyebrow">CHACUN SA PETITE POUSSE</span><h2>Qui entre au jardin ?</h2><div class="dialog-profiles">${PEOPLE.map(person => `<button class="dialog-profile ${profileColor(state, person.id)} ${person.id === selected?.id ? 'current' : ''}" data-action="select" data-person="${person.id}">${mascot(person, personStats(state, person.id).mood)}<strong>${person.name}</strong>${person.id === selected?.id ? icon('check') : ''}</button>`).join('')}</div><button class="profile-settings-link" data-action="settings">${icon('settings')} Paramètres de mon profil</button>`);
}
function settingsDialog(resetDraft = true) {
  if (!selected) return;
  if (resetDraft) colorDraft = profileColor(state, selected.id);
  const mood = personStats(state, selected.id).mood;
  openDialog(`<h2>Paramètres de ${selected.name}</h2><p>Choisis la couleur de ta mascotte.</p><div class="settings-mascot">${mascot(selected, mood, '', colorDraft)}</div><div class="color-options" role="group" aria-label="Couleur de la mascotte">${COLORS.map(color => `<button class="color-option ${colorDraft === color.id ? 'chosen' : ''}" data-action="choose-color" data-color="${color.id}" aria-pressed="${colorDraft === color.id}" ${settingsBusy ? 'disabled' : ''}><span class="color-swatch swatch-${color.id}" aria-hidden="true">${colorDraft === color.id ? icon('check') : ''}</span>${color.label}</button>`).join('')}</div><div class="dialog-buttons"><button class="outline-button" data-action="close-dialog" ${settingsBusy ? 'disabled' : ''}>Annuler</button><button class="solid-button" data-action="save-color" ${settingsBusy || !store || ['connecting', 'offline', 'pending', 'error'].includes(connection) ? 'disabled' : ''}>${settingsBusy ? 'Enregistrement…' : 'Enregistrer'}</button></div>`, 'settings');
}
function inviteDialog() {
  if (store?.mode !== 'shared') {
    openDialog(`<span class="dialog-feature-icon">${icon('people')}</span><h2>Un jardin à partager.</h2><p>Le partage n’est pas encore activé sur ce site. Pour le moment, les résultats sont sauvegardés sur cet appareil.</p><p class="dialog-note">Une fois le jardin connecté, vous pourrez noter vos bilans depuis vos propres téléphones.</p><button class="solid-button full-width" data-action="close-dialog">Compris</button>`);
    return;
  }
  openDialog(`<span class="dialog-feature-icon">${icon('people')}</span><h2>Plus on est de pousses…</h2><p>Envoie ce lien à tes trois complices. Chacun choisit son prénom et rejoint le même jardin.</p><label class="invite-label" for="invite-url">Le lien de votre jardin</label><input id="invite-url" class="invite-input" type="text" readonly value="${escape(store.inviteURL)}"/><button class="solid-button full-width" data-action="copy-invite">${icon('link')} Copier le lien</button><p class="dialog-note">Gardez ce lien entre vous : il permet de consulter et modifier les quatre profils.</p>`);
}
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#bedf65', '#f6b989', '#c4b2f3', '#eeaabd'];
  const container = document.createElement('div');
  container.className = 'confetti';
  container.setAttribute('aria-hidden', 'true');
  container.innerHTML = Array.from({ length: 28 }, (_, index) => `<i style="--x:${(index * 37) % 100}%;--r:${index * 63}deg;--delay:${index % 5 * .04}s;background:${colors[index % colors.length]}"></i>`).join('');
  document.body.append(container);
  setTimeout(() => container.remove(), 1800);
}
async function record(status) {
  if (busy || !store || !selected) return;
  const entry = { participantId: selected.id, day: activeDay, status };
  const previous = state.entries[entryKey(entry.participantId, entry.day)]?.status;
  if (previous === status) { toast('Ce bilan est déjà enregistré.'); return; }
  busy = true; render();
  try {
    await store.save(entry);
    toast(status === 'success' ? 'Une petite victoire de plus. Ça pousse !' : 'Bilan enregistré. Demain est un nouveau jour.');
    if (status === 'success') celebrate();
  } catch (error) { toast(friendlyError(error), true); }
  finally { busy = false; render(); }
}
function friendlyError(error) {
  if (error.code?.includes('permission-denied')) return 'L’accès au jardin est refusé. Vérifie la configuration du partage et réessaie.';
  if (error.code?.includes('network') || error.code?.includes('unavailable')) return 'Le jardin ne répond pas. Vérifie ta connexion et réessaie.';
  if (error.code?.includes('operation-not-allowed')) return 'Le partage n’est pas complètement activé. La connexion anonyme doit être autorisée.';
  return error.code ? 'La connexion au jardin a échoué. Vérifie la configuration du partage et réessaie.' : error.message || 'Le bilan n’a pas pu être enregistré. Réessaie.';
}
async function onAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case 'analyze-meal': await requestAnalysis(button.dataset.meal); break;
    case 'admin-open': case 'admin-refresh': if (!adminBusy) await refreshAdmin(); break;
    case 'admin-logout':
      try { await store.api('admin', { action: 'logout' }); adminData = null; adminLoginDialog(); } catch (error) { toast(friendlyError(error), true); }
      break;
    case 'admin-decide': case 'admin-analyze': {
      if (adminBusy || !store) return;
      const action = button.dataset.action;
      const payload = action === 'admin-decide' ? { action: 'decide', reviewId: button.dataset.review, decision: button.dataset.decision } : { mealId: button.dataset.meal };
      adminBusy = true; adminReviewsDialog();
      let message = '';
      try { await store.api(action === 'admin-decide' ? 'admin' : 'analyze', payload); }
      catch (error) { message = friendlyError(error); }
      finally { adminBusy = false; }
      try { adminData = await store.api('admin', { action: 'list' }); adminReviewsDialog(message); }
      catch (error) { adminLoginDialog(friendlyError(error)); }
      break;
    }
    case 'edit-meal': mealDialog(button.dataset.type); break;
    case 'delete-meal': {
      if (mealBusy || !mealDraft || !store) return;
      mealBusy = true;
      dialog.querySelectorAll('button,textarea').forEach(item => { item.disabled = true; });
      try { await store.removeMeal(mealDraft.participantId, mealDraft.day, mealDraft.type); dialog.close(); toast('La note a été supprimée.'); }
      catch (error) { dialog.querySelector('#meal-error').textContent = friendlyError(error); }
      finally { mealBusy = false; dialog.querySelectorAll('button,textarea').forEach(item => { item.disabled = false; }); }
      break;
    }
    case 'karaoke': {
      const title = document.querySelector('#karaoke-title');
      title?.setAttribute('tabindex', '-1');
      title?.focus({ preventScroll: true });
      title?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      break;
    }
    case 'home': selected = null; preference('person', null); page = 'dashboard'; homeRulesOpen = false; render(); window.scrollTo(0, 0); break;
    case 'select':
      selected = PEOPLE.find(person => person.id === button.dataset.person);
      if (!selected) return;
      preference('person', selected.id); page = 'dashboard'; activeDay = Math.max(0, Math.min(6, dayIndex(state.startDate)));
      if (dialog.open) dialog.close();
      render(); window.scrollTo(0, 0); document.querySelector('.dashboard-title h1')?.setAttribute('tabindex', '-1'); document.querySelector('.dashboard-title h1')?.focus({ preventScroll: true });
      break;
    case 'navigate': page = button.dataset.page; render(); window.scrollTo(0, 0); break;
    case 'day': activeDay = Number(button.dataset.day); render(); break;
    case 'profiles': profilesDialog(); break;
    case 'toggle-home-rules':
      homeRulesOpen = !homeRulesOpen; render();
      if (homeRulesOpen) {
        const rules = document.querySelector('#home-rules');
        rules.focus({ preventScroll: true });
        rules.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      } else window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'close-home-rules': homeRulesOpen = false; render(); window.scrollTo(0, 0); document.querySelector('.rules-toggle')?.focus({ preventScroll: true }); break;
    case 'settings': settingsDialog(); break;
    case 'choose-color':
      if (settingsBusy || !COLORS.some(color => color.id === button.dataset.color)) return;
      colorDraft = button.dataset.color; settingsDialog(false);
      dialog.querySelector(`[data-color="${colorDraft}"]`)?.focus({ preventScroll: true });
      break;
    case 'save-color': {
      if (settingsBusy || !store || !selected) return;
      const personId = selected.id;
      settingsBusy = true; settingsDialog(false);
      try {
        await store.setColor(personId, colorDraft);
        dialog.close(); toast('La couleur de ta mascotte est enregistrée.');
      } catch (error) { toast(friendlyError(error), true); }
      finally { settingsBusy = false; if (dialog.open) settingsDialog(false); render(); }
      break;
    }
    case 'invite': inviteDialog(); break;
    case 'close-dialog': if (!settingsBusy && !mealBusy && !adminBusy) dialog.close(); break;
    case 'record': await record(button.dataset.status); break;
    case 'vote': {
      if (busy || !store || !selected || !['final', 'finished'].includes(challengePhase(state))) return;
      const personId = selected.id;
      const vote = button.dataset.vote;
      if (!['yes', 'no'].includes(vote) || state.votes?.[personId] === vote) return;
      busy = true; render();
      try { await store.setVote(personId, vote); toast('Ton vote est enregistré.'); }
      catch (error) { toast(friendlyError(error), true); }
      finally { busy = false; render(); }
      break;
    }
    case 'undo':
      openDialog(`<span class="dialog-feature-icon">${icon('refresh')}</span><h2>Effacer ce bilan ?</h2><p>Le jour ${activeDay + 1} de ${selected.name} redeviendra une journée à renseigner. Tu pourras le compléter à nouveau.</p><div class="dialog-buttons"><button class="outline-button" data-action="close-dialog">Garder le bilan</button><button class="solid-button" data-action="confirm-undo">Effacer</button></div>`);
      break;
    case 'confirm-undo':
      if (busy || !store) return;
      dialog.close(); busy = true; render();
      try { await store.remove(selected.id, activeDay); toast('Le bilan a été effacé.'); } catch (error) { toast(friendlyError(error), true); } finally { busy = false; render(); }
      break;
    case 'copy-invite':
      try { await navigator.clipboard.writeText(store.inviteURL); toast('Lien copié. À vous quatre de jouer !'); dialog.close(); }
      catch { document.querySelector('#invite-url')?.select(); toast('Sélectionne et copie le lien affiché.', true); }
      break;
    case 'retry': location.reload(); break;
  }
}
root.addEventListener('click', onAction);
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  const main = document.querySelector('#main');
  main?.setAttribute('tabindex', '-1');
  main?.focus();
});
dialog.addEventListener('click', event => {
  if (event.target === dialog && !settingsBusy && !mealBusy && !adminBusy) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); }
  else onAction(event);
});
dialog.addEventListener('submit', submitMeal);
dialog.addEventListener('submit', loginAdmin);
dialog.addEventListener('cancel', event => { if (settingsBusy || mealBusy || adminBusy) event.preventDefault(); });
window.addEventListener('online', () => { if (store?.mode === 'shared') { connection = 'connecting'; render(); } });
window.addEventListener('offline', () => { if (store?.mode === 'shared') { connection = 'offline'; render(); } });
function updateDay() {
  const today = todayISO();
  if (lastToday === today) return;
  lastToday = today;
  activeDay = Math.max(0, Math.min(6, dayIndex(state.startDate)));
  render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDay(); });
setInterval(updateDay, 30000);
render();
try {
  store = await createStore(next => { state = next; render(); }, next => { connection = next; render(); });
  activeDay = Math.max(0, Math.min(6, dayIndex(state.startDate)));
  render();
} catch (error) { fatalError = friendlyError(error); render(); }

// Optional browser standard: expose the same real user actions when supported.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    { name: 'read_nsodod_garden', title: "Lire le jardin NSOD'OD", description: 'Read the seven-day challenge, profile scores and recorded results.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ startDate: state.startDate, selected: selected?.id || null, ranking: ranking(state), votes: state.votes || {}, connection }) },
    { name: 'select_nsodod_profile', title: 'Choisir un profil', description: 'Choose one of the four profiles and open its dashboard. Does not record a result.', inputSchema: { type: 'object', properties: { participantId: { type: 'string', enum: PEOPLE.map(person => person.id) } }, required: ['participantId'], additionalProperties: false }, execute: ({ participantId }) => { const person = PEOPLE.find(item => item.id === participantId); if (!person) throw new Error('Unknown profile'); selected = person; preference('person', person.id); page = 'dashboard'; render(); return { selected: person.id }; } },
  ];
  for (const tool of tools) {
    try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional experimental browser capability. */ }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
