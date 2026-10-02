import { PEOPLE, COLORS, DAYS, CHALLENGE_START, addDays, challengePhase, dateLabel, dayIndex, emptyState, entryKey, personStats, profileColor, ranking, todayISO, voteSummary } from './domain.mjs';
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
  return `<div class="mascot ${color} mood-${mood} ${extra}" style="--mascot-delay:-${phase * .7}s" role="img" aria-label="${person ? escape(person.plant) : 'Une petite pousse'}, ${mood === 'happy' ? 'en pleine forme' : mood === 'sad' ? 'un peu raplapla' : 'prête pour le défi'}"></div>`;
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
  return `<div class="calendar-celebration">${icon('people')}<div><strong><time datetime="${celebrationDate}">${date[0].toUpperCase() + date.slice(1)}</time> · On fête la fin du défi</strong><p>Sortie entre nous pour célébrer cette semaine. 🎉</p></div></div>`;
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
function dashboard() {
  const index = dayIndex(state.startDate);
  const stats = personStats(state, selected.id);
  const range = `${dateLabel(state.startDate)} — ${dateLabel(addDays(state.startDate, 6), { year: 'numeric' })}`;
  const dayText = index < 0 ? `Départ le ${dateLabel(state.startDate, { day: 'numeric', month: 'long' })}` : index >= DAYS ? 'Semaine terminée' : `Jour ${index + 1} sur 7`;
  return `${header()}<main id="main" class="dashboard-main"><section class="dashboard-title"><div><div class="title-eyebrow"><span class="eyebrow">BIENVENUE DANS TON PETIT JARDIN</span>${badge()}</div><h1>Salut, ${selected.name}<span class="greeting-sun">${icon('sun')}</span></h1><p>Chaque jour sans sucre, c’est une nouvelle pousse.</p></div><div class="challenge-date"><span>${icon('calendar')}${range}</span><strong><span class="small-dot"></span>${dayText}</strong></div></section>${['offline', 'pending', 'error'].includes(connection) ? `<div class="connection-banner" role="status">${icon('info')}${connection === 'error' ? 'La connexion au jardin est interrompue. Recharge cette page pour réessayer.' : connection === 'pending' ? 'Ta modification attend sa confirmation. Garde cette page ouverte pendant l’envoi.' : 'Le jardin partagé est momentanément hors connexion. Les bilans seront disponibles quand la connexion reviendra.'}${connection === 'error' ? '<button class="outline-button" data-action="retry">Réessayer</button>' : ''}</div>` : ''}<section class="stats-grid" aria-label="Ton bilan de la semaine"><div class="stat-card"><span class="stat-icon stat-green">${icon('sprout')}</span><div><span>Jours réussis</span><strong>${stats.successes}<small> / 7</small></strong></div><span class="stat-caption">${stats.successes ? 'Bien joué !' : 'Tout peut pousser'}</span></div><div class="stat-card"><span class="stat-icon stat-orange">${icon('fire')}</span><div><span>Série en cours</span><strong>${stats.streak}<small> ${stats.streak > 1 ? 'jours' : 'jour'}</small></strong></div><span class="stat-caption">${stats.streak > 1 ? 'Ça pousse fort' : 'Une pousse à la fois'}</span></div><div class="stat-card"><span class="stat-icon stat-purple">${icon('trophy')}</span><div><span>Ta place au jardin</span><strong>${ranking(state).find(person => person.id === selected.id).rank ? '#' + ranking(state).find(person => person.id === selected.id).rank : '—'}<small> / 4</small></strong></div><span class="stat-caption">${Object.keys(state.entries).length ? 'Ensemble, on avance' : 'Le défi commence'}</span></div></section><div class="dashboard-grid">${selectedDayCard(stats, index)}${plantCard(stats)}</div>${extensionVote()}${leaderboard()}<div class="kind-note">${icon('heart')}<p><strong>Une journée ratée n’est pas un défi raté.</strong> Tes victoires restent, ta plante t’attend. On continue ensemble.</p><span>✳</span></div></main>${footer()}`;
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
    case 'close-dialog': if (!settingsBusy) dialog.close(); break;
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
  if (event.target === dialog && !settingsBusy) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); }
  else onAction(event);
});
dialog.addEventListener('cancel', event => { if (settingsBusy) event.preventDefault(); });
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
