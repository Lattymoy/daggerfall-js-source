// @ts-check
// AUDIT NAV1 (2026-09-29, the helm - Mac: "This task is to be extremely detailed, authentic and easy to use") - THE
// SHIPWRIGHT'S WINDOW: a port's yard, at the helm lying to his quay (scenes/naval/navalHost.js yardHere). The helm audit's
// first finding was that none stood - a hurt boat stayed hurt, a wreck a wreck. Black Flag's harbour master, in
// Daggerfall's words and the stone-and-brass kit: what she wants, what each costs, and the presses that pay for it.
//
// ONE LIST, the order a captain pays in (systems/naval/navalYard.js YARD_ORDER): her HULL, her CANVAS, HANDS to her
// guns (a crewed ship's) and FIRE BARRELS (a ship with a stern that rolls them) - each row what she has of it, what is
// wanting and at what a piece, and its press: all of it, or as much as the purse pays for, or greyed with why. MAKE HER
// WHOLE pays for the four in that order - or, short, makes good what the purse will pay. The last press's word stands
// under the title. The house's shape is the plunder window's (ui/naval/navalPlunderWindow.js - its sheet, its door, its way
// out): `mountNavalYardWindow(host, deps)` answers `{ repaint, unmount }`, and the back key and the scrim leave.
//
// deps = { model, onExit(reason) } - `model` the host's (navalHost.js yardModel): { name, ship() -> { hull, maxHull,
// sail, maxSail, crew, maxCrew, barrels, wrecked, barrelsAboard? }, offer() -> navalYard.js yardOffer's, buy(id) ->
// { ok, id, n, cost, whole, short? }, buyAll() -> { ok, cost, bought, whole }, prices, hasBarrels? }.
//
// CAPT-BOARD (2026-10-11, bible/03-World/Captains-Sea.md): THE HARBOURMASTER'S TAB beside the shipwright's, where the
// world hands an `office()` (scenes/harbourOffice.js model): the port and the captain's rank with its crown, today's
// board - each contract's words, purse, term and the crown's regard it is worth, and its Take - the contracts held, how
// far each has come and its term left, and Give up; the letters a rank buys (a letter of marque, the Admiralty's
// carrack). Each press says its word under the title, as the yard's do.
//
// CAPT-TRADE: THE EXCHANGE'S TAB, where the world hands an `exchange()` (scenes/harbourOffice.js exchange): each good
// the port deals in - what it is to the port (made here, wanted here), its price to buy and to sell today, how many more
// the exchange deals in, what the boat at the quay carries of it - and Buy 1, Buy 10, Sell 1, Sell all. CREW-TRADE
// (bible/03-World/Captains-Sea.md CREW-TRADE): a crewed ship's CREW first - whether the port has sailors to spare or is
// short of them, a man's two prices, her crew aboard against her whole - its presses signing men on to her and off her.
import { closeOnOutsideTap } from '../enhanced/enhancedOverlays.js';
import { overlayAction } from '../input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { injectNavalKit } from './navalHud.js';
import { injectNavalWindowStyle } from './navalPlunderWindow.js';
import { ETHER_SEA_NAME } from '../../world/ethericSea.js';   // ELTHERIC: the sea's name, one home
import { t } from '../../systems/textManager.js';   // GROG-WORD: the day's round said in the player's language
import { townBandWord } from '../../net/townEconLaw.js';   // SEA-TRADE: the port town's economy in the exchange's lede
import { CREW } from '../../systems/naval/tradeGoods.js';   // CREW-TRADE: crew's row
import { CREW_TRADE_TEXT } from '../../systems/naval/crewTrade.js';   // AUDIT CREW-TRADE O3: the row's words, in the player's language

export const NAVAL_YARD_STYLE_ID = 'dagger-naval-yard-style';
/** The yard's own rules beside the naval windows' sheet: a row's three columns. */
export const NAVAL_YARD_CSS = `
.dfnaval-yardrow { display: grid; grid-template-columns: minmax(96px, 1fr) minmax(0, 1.4fr) auto; align-items: center; gap: 10px; white-space: normal; }
.dfnaval-yardrow b { font-weight: normal; letter-spacing: 0.08em; text-transform: uppercase; color: #efe8d6; }
.dfnaval-yardrow span { font-size: 12px; color: #b9ab93; }
.dfnaval-yardrow .dfnaval-btn { min-width: 0; font-size: 13px; padding: 4px 10px; }
@media (max-width: 560px) { .dfnaval-yardrow { grid-template-columns: 1fr; gap: 4px; } }
.dfnaval-tabs { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.dfnaval-tabs .dfnaval-btn { min-width: 0; font-size: 13px; padding: 4px 12px; }
.dfnaval-tabs .dfnaval-btn.on { color: #f3cf86; }
.dfnaval-officerow { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; white-space: normal; }
.dfnaval-officerow b { display: block; font-weight: normal; letter-spacing: 0.04em; color: #efe8d6; }
.dfnaval-officerow span { display: block; font-size: 12px; color: #b9ab93; }
.dfnaval-officerow i { display: block; font-style: normal; font-size: 12px; color: #f3cf86; }
.dfnaval-officerow .dfnaval-btn { min-width: 0; font-size: 13px; padding: 4px 10px; }
.dfnaval-officerow .dfnaval-presses { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
@media (max-width: 560px) { .dfnaval-officerow { grid-template-columns: 1fr; gap: 4px; } }
`;

const WORDS = Object.freeze({
  hull: { label: 'Hull', verb: 'Mend', done: 'Hull repaired', unit: (n) => `${n} ${n === 1 ? 'point' : 'points'}` },
  sail: { label: 'Canvas', verb: 'Mend', done: 'Sails repaired', unit: (n) => `${n} ${n === 1 ? 'yard' : 'yards'}` },
  crew: { label: 'Hands', verb: 'Hire', done: 'Hands hired', unit: (n) => `${n} ${n === 1 ? 'man' : 'men'}` },
  barrels: { label: 'Fire barrels', verb: 'Buy', done: 'Fire barrels stowed', unit: (n) => `${n} ${n === 1 ? 'barrel' : 'barrels'}` },
  // SEA-REPAIR, SHIP-CREW: her provisions - carpenter's stores for her repairs at sea, and a round of grog for her crew
  stores: { label: 'Carpenter\'s stores', verb: 'Buy', done: 'Stores loaded into the hold', unit: (n) => `${n} ${n === 1 ? 'store' : 'stores'}` },
  grog: { label: 'Grog', verb: 'Stand a round', done: 'A round for the crew', unit: () => 'the crew\'s spirits lifted' },
});
/** SHIP-CREW: her crew's spirits in a word (shipCrew.js SPIRITS). */
const spiritsWord = (m) => (m >= 85 ? 'roaring' : m >= 65 ? 'high' : m >= 45 ? 'steady' : m >= 25 ? 'low' : 'grim');
const gold = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;

/** The window's standing words for a model - pure, the pins' reading. */
export function yardText(model) {
  const o = model.offer();
  const sh = model.ship();
  const have = {
    hull: `${Math.floor(sh.hull)} of ${sh.maxHull}`, sail: `${Math.floor(sh.sail)} of ${sh.maxSail}`,
    crew: `${sh.crew} of ${sh.maxCrew}`, barrels: `${sh.barrels} aboard`,
  };
  const shown = (r) => (r.id === 'sail' ? sh.maxSail > 0 : r.id === 'crew' ? sh.maxCrew > 0 : r.id === 'barrels' ? model.hasBarrels !== false : true);
  const rows = o.rows.filter(shown).map((r) => {
    const w = WORDS[r.id];
    return {
      id: r.id, label: w.label,
      state: r.missing === 0 ? `${have[r.id]} - whole` : `${have[r.id]} - ${r.missing} needed at ${gold(r.price)} each`,
      press: r.missing === 0 ? 'Whole' : r.afford === 0 ? `${w.verb} - ${gold(r.price)} each`
        : r.afford === r.missing ? `${w.verb} all - ${gold(r.cost)}` : `${w.verb} ${r.afford} - ${gold(r.cost)}`,
      can: r.missing > 0 && r.afford > 0,
    };
  });
  const bill = rows.reduce((sum, r) => sum + (o.rows.find((x) => x.id === r.id)?.whole ?? 0), 0);
  let purse = o.gold, paid = 0;
  // AUDIT CAPTAIN'S SEA B15: each row's pieces paid in whole gold, as the bill is - a discount's fractions left a purse that
  // pays for everything a coin short of the bill ("Make good what your purse pays" for her whole)
  for (const r of o.rows) { if (!shown(r)) continue; const n = Math.min(r.missing, Math.floor(purse / r.price)); const c = Math.ceil(n * r.price - 1e-9); paid += c; purse -= c; }
  // SEA-REPAIR, SHIP-CREW: her provisions, apart from her needs - never part of making her whole
  const po = model.provisions?.() ?? null;
  const provisions = (po?.rows ?? []).map((r) => {
    const w = WORDS[r.id];
    const state = r.id === 'stores'
      ? (r.missing === 0 ? `${r.have} in the hold. Stores are full` : `${r.have} in the hold - ${r.missing} more at ${gold(r.price)} each`)
      : r.drunk ? t('naval.yard.grogDrunk', 'Crew spirits are {spirits, select, roaring {roaring} high {high} steady {steady} low {low} other {grim}}, and they\'ve had today\'s round', { spirits: spiritsWord(r.have) })   // GROG-WORD: never "as high as they go" below the top
        : (r.missing === 0 ? 'Crew spirits are as high as they go' : `Crew spirits are ${spiritsWord(r.have)}. A round costs ${gold(r.price)}`);
    return {
      id: r.id, label: w.label, state,
      press: r.missing === 0 ? (r.id === 'stores' ? 'Full' : r.drunk ? 'Tomorrow' : 'No need') : r.afford === 0 ? `${w.verb} - ${gold(r.price)}${r.id === 'stores' ? ' each' : ''}`
        : r.id === 'grog' ? `${w.verb} - ${gold(r.cost)}` : r.afford === r.missing ? `${w.verb} ${r.afford} - ${gold(r.cost)}` : `${w.verb} ${r.afford} - ${gold(r.cost)}`,
      can: r.missing > 0 && r.afford > 0,
    };
  });
  return {
    provisions,
    title: 'The shipwright',
    sub: `${model.name} - your purse: ${gold(o.gold)}`,
    lede: bill === 0 ? 'The ship is in full repair. There is nothing to fix.'
      : sh.wrecked ? `The ship came in wrecked. The shipwright can fully repair it for ${gold(bill)}.` : `The shipwright can fully repair it for ${gold(bill)}.`,
    rows,
    whole: bill === 0 ? null : paid >= bill ? `Repair all - ${gold(bill)}` : paid > 0 ? `Repair what you can afford - ${gold(paid)}` : `Repair all - ${gold(bill)}`,
    canWhole: paid > 0,
  };
}

/**
 * CAPT-BOARD: THE HARBOURMASTER'S TAB's words for an office model (scenes/harbourOffice.js model) - pure, the pins'
 * reading: `{ lede, board: [{ id, title, words, terms, press, can, why }], held: [{ id, title, words, state }], letters:
 * [{ id, title, words, press, can }] }`.
 * @param {any} o
 */
export function officeText(o) {
  if (!o) return null;
  if (o.ether) return etherOfficeText(o);   // ETHER-SEA: a freeport past the Veil
  // AUDIT CAPTAIN'S SEA L10: the favours are refused at a quarter of the notoriety its navy hunts at - never "hunts you";
  // B14: "an Admiral"
  const lede = o.hunted ? `${o.port} - ${o.crown}'s harbormaster. Your notoriety in these waters is too high for any favors.`
    : `${o.port} - ${o.crown}'s harbormaster. You are ${o.rank === 'Unsworn' ? 'Unsworn' : `${/^[aeiou]/i.test(o.rank) ? 'an' : 'a'} ${o.rank}`} of ${o.crown} (standing ${o.standing}).`;
  const board = (o.board ?? []).map((b) => ({ id: b.id, title: b.title, words: b.words, terms: `${b.pay} - ${b.term} - ${b.standing}`, press: 'Take', can: !!b.can, why: b.why ?? '' }));
  const held = (o.held ?? []).map((h) => ({ id: h.id, title: h.title, words: h.progress, state: `${h.left} - ${h.pay}` }));
  const letters = [];
  const mq = o.marque;
  if (mq?.held) letters.push({ id: 'marque', title: 'Letter of marque', words: `You sail under ${mq.held.crown}'s letter.`, press: 'Held', can: false });
  else if (mq) letters.push({ id: 'marque', title: 'Letter of marque', words: mq.can ? `${o.crown}'s commission against its rivals' shipping for ${mq.days}.` : mq.why, press: `Buy - ${mq.price}`, can: !!mq.can });
  if (o.admiralty?.open || o.admiralty?.can) letters.push({ id: 'admiralty', title: 'The Admiralty\'s carrack', words: o.admiralty.can ? 'The only carrack for sale in the Bay. The title goes to your Fleet.' : o.admiralty.why, press: `Buy - ${o.admiralty.price}`, can: !!o.admiralty.can });
  else if (o.admiralty) letters.push({ id: 'admiralty', title: 'The Admiralty\'s carrack', words: o.admiralty.why, press: 'Commodores only', can: false });
  return { lede, board, held, letters };
}

/**
 * ETHER-SEA: AN ELTHERIC HARBOURMASTER'S TAB's words (scenes/etherHost.js office) - no crown, no contracts: the port's
 * waters, the legends' rumours as the board, and a chart of these waters among the letters. The same shape as
 * officeText's, `ether` set and `heads` the board's own words.
 * @param {any} o
 */
export function etherOfficeText(o) {
  const g = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;
  const lede = `${o.port} - a freeport of ${ETHER_SEA_NAME}, in ${o.waters}. No crown's writ runs past the Veil, and no crown's favors. Your charts hold ${o.charted} ${o.charted === 1 ? 'isle' : 'isles'}.`;
  const board = (o.rumours ?? []).map((r, i) => ({ id: `rumour:${i}`, title: 'Talk on the quay', words: r, terms: '', press: '', can: false, why: '' }));
  const c = o.chart;
  const letters = c ? [{ id: 'chart', title: 'A chart of these waters', words: c.fresh > 0 ? `${c.fresh} ${c.fresh === 1 ? 'isle' : 'isles'} your charts do not hold, marked on them.${c.can ? '' : ` ${c.why}`}` : c.why, press: `Buy - ${g(c.price)}`, can: !!c.can }] : [];
  return { lede, board, held: [], letters, ether: true, heads: { board: ['The quay\'s talk', 'the legends of these waters'], letters: ['Charts', 'the harbormaster\'s'] }, wanted: o.wanted ? wantedText(o.wanted) : null, season: o.season ? seasonText(o.season) : null };
}

/**
 * SEA-SEASON: A FREEPORT'S SECTION OF THE SEASON'S CAPTAINS, its words for its model (scenes/seaSeasonHost.js office) -
 * pure: `{ head, lede, lists: [{ title, rows: [{ title, words }], none }], line }` - the season and its days left, the
 * deepest voyages and the legends ended (each its rank, its captain and its figure), the player's own places and the
 * last season's firsts.
 * @param {any} s
 */
export function seasonText(s) {
  const g = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
  const leagues = (n) => t('sea.season.leagues', '{n, plural, one {{figure} league} other {{figure} leagues}}', { n, figure: g(n) });
  const legends = (n) => t('sea.season.legends', '{n, plural, one {{figure} legend} other {{figure} legends}}', { n, figure: g(n) });
  const rows = (list, words) => list.map((r, i) => ({ title: `${i + 1}. ${r.name}`, words: words(r.n) }));
  const mine = [
    s.mine?.deep ? t('sea.season.mineDeep', 'You are {rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} for the deepest voyage ({figure}).', { rank: s.mine.deep.rank, figure: leagues(s.mine.deep.n) }) : '',
    s.mine?.legends ? t('sea.season.mineLegends', 'You are {rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} for legends ended ({figure}).', { rank: s.mine.legends.rank, figure: legends(s.mine.legends.n) }) : '',
  ].filter(Boolean).join(' ');
  const firstOf = (list, words) => (list?.[0] ? `${list[0].name} (${words(list[0].n)})` : '');
  const lastDeep = firstOf(s.last?.deep, leagues), lastLegends = firstOf(s.last?.legends, legends);
  const last = [
    lastDeep ? t('sea.season.lastDeep', 'Last season\'s deepest voyage: {who}.', { who: lastDeep }) : '',
    lastLegends ? t('sea.season.lastLegends', 'Last season\'s most legends ended: {who}.', { who: lastLegends }) : '',
  ].filter(Boolean).join(' ');
  return {
    head: [t('sea.season.head', 'The season\'s captains'), s.asking || !s.season ? '' : t('sea.season.headSub', 'Season {n} - {days, plural, one {# day} other {# days}} left', { n: s.season, days: s.daysLeft })],
    lede: s.asking ? t('sea.season.asking', 'The harbormaster is reading the season\'s boards...') : [t('sea.season.lede', 'Every captain of the realm, this season: how far past the Veil they have sailed, and how many of the six legends they have sunk or taken.'), mine, last].filter(Boolean).join(' '),
    lists: s.asking ? [] : [
      { title: t('sea.season.deepTitle', 'Deepest voyages'), rows: rows(s.deep ?? [], leagues), none: t('sea.season.deepNone', 'No captain has sailed past the Veil this season.') },
      { title: t('sea.season.legendsTitle', 'Legends ended'), rows: rows(s.legends ?? [], legends), none: t('sea.season.legendsNone', 'No legend has been sunk or taken this season.') },
    ],
    line: s.line ?? null,
  };
}

/**
 * SEA-BOUNTY: A FREEPORT'S WANTED SECTION's words for its model (scenes/seaBountyHost.js office) - pure: `{ head, lede,
 * rows: [{ id, title, words, presses: [{ label, can, n }] }], owed: { title, words, press, can } | null, mine, prizes,
 * back, line }` - SHIP-PVP: `prizes` and `back` a wreck's prizes held for me and my hold's goods due back, each a row -
 * each wanted captain's kills and bounty with a press for each post, the gold owed the player and its press, the bounty on
 * the player's own head, and the last answer's line.
 * @param {any} w
 */
export function wantedText(w) {
  const g = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
  const rows = (w.rows ?? []).map((r) => ({
    id: r.char, title: r.name,
    words: t('sea.bounty.row', '{kills, plural, =0 {No kills at sea of late} one {# kill at sea} other {# kills at sea}} - {gold} gold on their head', { kills: r.kills, gold: g(r.bounty) }),
    presses: (w.posts ?? []).map((n) => ({ label: t('sea.bounty.post', 'Post {gold}', { gold: g(n) }), can: !w.busy && !(w.purse < n), n })),   // AUDIT SEA VENTURES E7: greyed past the purse
  }));
  return {
    head: [t('sea.bounty.head', 'Wanted'), t('sea.bounty.headSub', 'the open sea\'s killers')],
    lede: w.asking ? t('sea.bounty.asking', 'The harbormaster is reading the board...') : rows.length ? t('sea.bounty.lede', 'Gold posted on a captain\'s head is paid to whoever ends them at sea: a death at their hand, or a wreck at their guns. Each post is your own gold.') : t('sea.bounty.none', 'No captain of the open sea is wanted.'),
    rows,
    owed: w.owed > 0 ? { title: t('sea.bounty.owedTitle', 'Bounties owed you'), words: t('sea.bounty.owed', '{gold} gold for the wanted captains you ended at sea.', { gold: g(w.owed) }), press: t('sea.bounty.collect', 'Collect'), can: !w.busy } : null,
    // AUDIT SEA VENTURES B4: my posts on heads gone, back to me by the same collect
    refund: w.refund > 0 ? { title: t('sea.bounty.refundTitle', 'Bounties returned'), words: t('sea.bounty.refund', '{gold} gold you posted on captains who are gone, back to you.', { gold: g(w.refund) }), press: t('sea.bounty.collect', 'Collect'), can: !w.busy } : null,
    mine: w.mine > 0 ? t('sea.bounty.mine', 'A bounty of {gold} gold stands on your own head.', { gold: g(w.mine) }) : null,
    // SHIP-PVP: a wreck's prizes held for me to collect, and my hold's goods a killer left, mine to reclaim
    prizes: w.prizes > 0 ? { title: t('sea.pvp.prizesTitle', 'Prizes taken at sea'), words: t('sea.pvp.prizes', '{n, plural, one {# piece} other {# pieces}} from wrecks you boarded, held for you.', { n: w.prizes }), can: !w.busy, press: t('sea.bounty.collect', 'Collect') } : null,
    back: w.back > 0 ? { title: t('sea.pvp.backTitle', 'Your hold\'s goods'), words: t('sea.pvp.back', '{n, plural, one {# piece} other {# pieces}} of your hold, never collected by the captain who boarded you.', { n: w.back }), press: t('sea.pvp.reclaim', 'Reclaim'), can: !w.busy } : null,
    line: w.line ?? null,
  };
}

/**
 * CAPT-TRADE: THE EXCHANGE'S TAB's words for an exchange model (scenes/harbourOffice.js exchange) - pure: `{ lede, rows:
 * [{ id, title, words, extra, canBuy, canSell }] }`.
 * @param {any} x
 */
export function exchangeText(x) {
  if (!x) return null;
  const g = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;
  const room = x.room == null ? '' : x.room > 0 ? ` (room for ${x.room} kg more)` : ' (the ship can\'t carry any more)';   // AUDIT CAPTAIN'S SEA B11
  // SEA-TRADE (Town-Economy-Arc section 8): online, the port town's economy, whose prices the exchange keeps
  const band = x.band ? ` ${t('sea.exchange.band', 'Port economy: {band}. Exchange prices follow it.', { band: townBandWord(x.band) })}` : '';
  const lede = (x.weight == null ? `${x.port}'s exchange. Trade from the helm, into the hold.`
    : `${x.port}'s exchange. The hold carries ${Math.round(x.weight)} kg of goods${room}. You have ${g(x.gold)}.`) + band;
  const STAND = { makes: 'Made here: cheap', wants: 'Wanted here: dear', neither: '' };
  const CREW_STAND = { makes: t('sea.crew.standMakes', 'Sailors to spare here: cheap'), wants: t('sea.crew.standWants', 'Short of sailors here: dear'), neither: t('sea.crew.standNeither', 'Sailors to be had here: the usual price') };   // CREW-TRADE; AUDIT CREW-TRADE R4: a port that is neither says so
  /** AUDIT CREW-TRADE O3: crew's row in the player's language - its stand, a man's two prices and how many today. */
  const crewWords = (r) => [CREW_STAND[r.stand], r.sells > 0 ? CREW_TRADE_TEXT.buyAt(r.sell, r.sells) : CREW_TRADE_TEXT.noneToBuy, r.buys > 0 ? CREW_TRADE_TEXT.sellAt(r.buy, r.buys) : CREW_TRADE_TEXT.noneTaken].filter(Boolean).join(' - ');
  const rows = (x.rows ?? []).map((r) => {
    const crew = r.id === CREW.id;   // CREW-TRADE: signed on while she has room, off while any may leave her
    const aboard = crew ? t('sea.crew.aboard', 'Aboard: {have} of {whole} crew', { have: r.have, whole: r.whole }) : '';
    return {
      id: r.id, title: r.name, canBuy: crew ? r.sells > 0 && r.room > 0 && (Number(x.gold) || 0) >= r.sell : r.sells > 0 && x.weight != null, canSell: crew ? r.spare > 0 && r.buys > 0 : r.have > 0 && r.buys > 0,
      words: crew ? crewWords(r) : [STAND[r.stand], r.sells > 0 ? `buy at ${g(r.sell)} a ${r.unit} (${r.sells} left today)` : r.exotic ? 'not sold here' : 'none to buy today', r.buys > 0 ? `sell at ${g(r.buy)} (${r.buys} wanted)` : 'none wanted today'].filter(Boolean).join(' - '),   // AUDIT CAPTAIN'S SEA B16
      extra: crew ? [aboard, r.spare <= 0 && r.buys > 0 ? r.why : ''].filter(Boolean).join(' - ') : r.have > 0 ? `In the hold: ${r.have} ${r.have === 1 ? r.unit : r.units}` : '',   // AUDIT CREW-TRADE O1: why none may leave her, said beside the greyed Sell
    };
  });
  return { lede, rows };
}

/** What a press did, in a line. */
export function yardNote(result) {
  if (!result) return null;
  if (Array.isArray(result.bought)) {
    if (!result.ok) return { text: 'You can\'t afford anything here.', warn: true };
    return result.whole ? { text: `Fully repaired for ${gold(result.cost)}.`, warn: false } : { text: `The yard repaired what you could afford: ${gold(result.cost)}.`, warn: false };
  }
  const w = WORDS[result.id];
  if (!w) return null;
  if (!result.ok) return result.short ? { text: `Not enough gold. It costs ${gold(result.short)} each.`, warn: true } : null;
  return { text: `${w.done}: ${w.unit(result.n)} for ${gold(result.cost)}.`, warn: false };
}

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** @param {string} text @param {string} cls @param {() => void} onPress */
const button = (text, cls, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', cls, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e.stopPropagation(); if (!b.disabled) onPress(); };
  return b;
};
function injectYardStyle(doc = document) {
  if (doc.getElementById?.(NAVAL_YARD_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = NAVAL_YARD_STYLE_ID;
  st.textContent = NAVAL_YARD_CSS;
  (doc.head ?? doc.body).append(st);
}
const able = (b, on) => { if (on) b.removeAttribute('disabled'); else b.setAttribute('disabled', ''); };

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{ model: any, onExit?: ((reason?: string) => void) | null }} deps
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountNavalYardWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectNavalWindowStyle();
  injectYardStyle();
  injectNavalKit(document);
  const m = deps.model;
  const exit = (reason = 'close') => deps.onExit?.(reason);
  let note = null;
  const shell = el('div', 'dfnaval-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', 'The shipwright');
  const win = el('div', 'dfnaval-win');
  shell.append(win);
  const head = el('header', 'dfnaval-winhead');
  const title = el('div', 'dfnaval-wintitle');
  const h2 = el('h2');
  const sub = el('p', 'dfnaval-winsub');
  const noteLine = el('p', 'dfnaval-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(h2, sub, noteLine);
  const close = button('Leave', 'dfnaval-btn dfnaval-close', () => exit('close'));
  close.style.minWidth = '0';
  head.append(title, close);
  const body = el('div', 'dfnaval-winbody');
  const lede = el('p', 'dfnaval-lede');
  const sec = el('section', 'dfnaval-sec');
  const secHead = el('h3', 'dfnaval-sechead');
  secHead.append(el('span', null, 'Repairs and supplies'), el('span', 'dfnaval-count', 'as much as you can afford'));
  const list = el('ul', 'dfnaval-holdlist');
  const acts = el('div', 'dfnaval-acts');
  const whole = button('', 'dfnaval-btn dfnaval-take dfnaval-whole', () => { note = yardNote(m.buyAll?.()); render(); });
  acts.append(whole);
  sec.append(secHead, list, acts);
  // SEA-REPAIR, SHIP-CREW: her provisions - the stores her crew repairs her with at sea, and a round for them
  const pSec = el('section', 'dfnaval-sec');
  const pHead = el('h3', 'dfnaval-sechead');
  pHead.append(el('span', null, 'Provisions'), el('span', 'dfnaval-count', 'for the voyage'));
  const pList = el('ul', 'dfnaval-holdlist');
  pSec.append(pHead, pList);
  // CAPT-BOARD: the harbourmaster's tab - the board, the contracts held, the letters
  const office = () => (typeof m.office === 'function' ? m.office() : null);
  let tab = 'yard';
  const tabs = el('div', 'dfnaval-tabs');
  const yardTab = button('Shipwright', 'dfnaval-btn', () => { tab = 'yard'; note = null; render(); });
  const officeTab = button('Harbormaster', 'dfnaval-btn', () => { tab = 'office'; note = null; render(); });
  const tradeTab = button('Exchange', 'dfnaval-btn', () => { tab = 'trade'; note = null; render(); });
  tabs.append(yardTab, officeTab, tradeTab);
  yardTab.setAttribute('data-dficon', 'saw'); officeTab.setAttribute('data-dficon', 'anchor'); tradeTab.setAttribute('data-dficon', 'treasure');   // MENU-ORDER: each page its picture
  const exchange = () => (typeof m.exchange === 'function' ? m.exchange() : null);
  const tLede = el('p', 'dfnaval-lede');
  const tradeSec = el('section', 'dfnaval-sec'), tradeHead = el('h3', 'dfnaval-sechead'), tradeList = el('ul', 'dfnaval-holdlist');
  tradeHead.append(el('span', null, 'The exchange'), el('span', 'dfnaval-count', 'today\'s prices'));
  tradeSec.append(tradeHead, tradeList);
  const oLede = el('p', 'dfnaval-lede');
  const boardSec = el('section', 'dfnaval-sec'), boardHead = el('h3', 'dfnaval-sechead'), boardList = el('ul', 'dfnaval-holdlist');
  boardHead.append(el('span', null, 'The board'), el('span', 'dfnaval-count', 'today\'s contracts'));
  boardSec.append(boardHead, boardList);
  const heldSec = el('section', 'dfnaval-sec'), heldHead = el('h3', 'dfnaval-sechead'), heldList = el('ul', 'dfnaval-holdlist');
  heldHead.append(el('span', null, 'Your contracts'), el('span', 'dfnaval-count', 'under way'));
  // SEA-BOUNTY: a freeport's Wanted section - the open sea's killers and the gold on their heads (wantedText)
  const wantedSec = el('section', 'dfnaval-sec'), wantedHead = el('h3', 'dfnaval-sechead'), wantedLede = el('p', 'dfnaval-lede'), wantedList = el('ul', 'dfnaval-holdlist'), wantedLine = el('p', 'dfnaval-note');
  wantedHead.append(el('span'), el('span', 'dfnaval-count'));
  wantedSec.append(wantedHead, wantedLede, wantedList, wantedLine);
  // SEA-SEASON: a freeport's section of the season's captains - the deepest voyages and the legends ended (seasonText)
  const seasonSec = el('section', 'dfnaval-sec'), seasonHead = el('h3', 'dfnaval-sechead'), seasonLede = el('p', 'dfnaval-lede'), seasonList = el('ul', 'dfnaval-holdlist'), seasonLine = el('p', 'dfnaval-note');
  seasonHead.append(el('span'), el('span', 'dfnaval-count'));
  seasonSec.append(seasonHead, seasonLede, seasonList, seasonLine);
  heldSec.append(heldHead, heldList);
  const lettersSec = el('section', 'dfnaval-sec'), lettersHead = el('h3', 'dfnaval-sechead'), lettersList = el('ul', 'dfnaval-holdlist');
  lettersHead.append(el('span', null, 'Letters'), el('span', 'dfnaval-count', 'a rank\'s favours'));
  lettersSec.append(lettersHead, lettersList);
  const officeRow = (title, words, extra, press, can, onPress) => {
    const li = el('li', 'dfnaval-item dfnaval-officerow');
    const text = el('div');
    text.append(el('b', null, title), el('span', null, words));
    if (extra) text.append(el('i', null, extra));
    li.append(text);
    if (press) {   // ETHER-SEA: a rumour is read, never pressed
      const b = button(press, 'dfnaval-btn dfnaval-officebuy', onPress);
      able(b, can);
      li.append(b);
    }
    return li;
  };
  /** A section's head words: the Bay's own, or an Eltheric harbourmaster's (`heads`). */
  const headWords = (headEl, words) => { const [a, b] = headEl.children; if (a && b && words) { a.textContent = words[0]; b.textContent = words[1]; } };
  body.append(tabs, lede, sec, pSec, oLede, boardSec, wantedSec, seasonSec, heldSec, lettersSec, tLede, tradeSec);
  win.append(head, body);

  let alive = true;
  const renderOffice = (o) => {
    o.hear?.();   // AUDIT CAPTAIN'S SEA X11: the quay's talk heard where the harbourmaster's tab is shown, never in the model's read
    const ot = officeText(o);
    h2.textContent = 'The harbormaster';
    oLede.textContent = ot.lede;
    headWords(boardHead, ot.heads?.board ?? ['The board', 'today\'s contracts']);   // ETHER-SEA: the quay's talk past the Veil
    headWords(lettersHead, ot.heads?.letters ?? ['Letters', 'a rank\'s favours']);
    for (const c of [...boardList.children]) c.remove();
    for (const b of ot.board) {
      boardList.append(officeRow(b.title, b.words, b.can ? b.terms : [b.terms, b.why].filter(Boolean).join(' - '), b.press, b.can, () => { const r = o.take(b.id); note = r?.text ? { text: r.text, warn: !r.ok } : null; render(); }));   // AUDIT CAPTAIN'S SEA X10: a rumour's row carried a stray " - "
    }
    if (!ot.board.length) boardList.append(el('li', 'dfnaval-item more', ot.ether ? 'Nobody on the quay has a tale today.' : 'Nothing more on the board today.'));
    for (const c of [...heldList.children]) c.remove();
    for (const h of ot.held) heldList.append(officeRow(h.title, h.words, h.state, 'Give up', true, () => { const r = o.abandon(h.id); note = r?.text ? { text: r.text, warn: true } : null; render(); }));
    heldSec.style.display = ot.held.length ? '' : 'none';
    for (const c of [...lettersList.children]) c.remove();
    for (const x of ot.letters) lettersList.append(officeRow(x.title, x.words, null, x.press, x.can, () => { const r = x.id === 'marque' ? o.buyMarque() : x.id === 'chart' ? o.buyChart() : o.buyCarrack(); note = r?.text ? { text: r.text, warn: !r.ok } : null; render(); }));   // ETHER-SEA: a chart of these waters
    lettersSec.style.display = ot.letters.length ? '' : 'none';
    renderWanted(ot.wanted, o.wanted);   // SEA-BOUNTY
    renderSeason(ot.season);   // SEA-SEASON
  };
  /** SEA-SEASON: the season's captains - shown with a freeport's model online; each board's title, then its rows. */
  const renderSeason = (st) => {
    seasonSec.style.display = st ? '' : 'none';
    if (!st) return;
    headWords(seasonHead, st.head);
    seasonLede.textContent = st.lede;
    for (const c of [...seasonList.children]) c.remove();
    for (const list of st.lists) {
      seasonList.append(el('li', 'dfnaval-item more', list.title));
      if (!list.rows.length) seasonList.append(officeRow(list.none, ''));
      for (const r of list.rows) seasonList.append(officeRow(r.title, r.words));
    }
    seasonLine.textContent = st.line?.text ?? '';
    seasonLine.className = `dfnaval-note${st.line?.warn ? ' warn' : ''}`;
    if (st.line) seasonLine.removeAttribute('hidden'); else seasonLine.setAttribute('hidden', '');
  };
  /** SEA-BOUNTY: the Wanted section - shown with a freeport's model online, its presses the bounty's own (a post, a collect;
   *  their answers said on the section's line when they come). */
  const renderWanted = (wt, w) => {
    wantedSec.style.display = wt ? '' : 'none';
    if (!wt) return;
    headWords(wantedHead, wt.head);
    wantedLede.textContent = [wt.lede, wt.mine].filter(Boolean).join(' ');
    for (const c of [...wantedList.children]) c.remove();
    if (wt.owed) wantedList.append(officeRow(wt.owed.title, wt.owed.words, null, wt.owed.press, wt.owed.can, () => w.collect()));
    if (wt.refund) wantedList.append(officeRow(wt.refund.title, wt.refund.words, null, wt.refund.press, wt.refund.can, () => w.collect()));   // AUDIT SEA VENTURES B4
    if (wt.prizes) wantedList.append(officeRow(wt.prizes.title, wt.prizes.words, null, wt.prizes.press, wt.prizes.can, () => w.collectPrizes()));   // SHIP-PVP
    if (wt.back) wantedList.append(officeRow(wt.back.title, wt.back.words, null, wt.back.press, wt.back.can, () => w.reclaim()));
    for (const r of wt.rows) {
      const li = el('li', 'dfnaval-item dfnaval-officerow');
      li.setAttribute('data-row', r.id);
      const text = el('div');
      text.append(el('b', null, r.title), el('span', null, r.words));
      const presses = el('div', 'dfnaval-presses');
      for (const p of r.presses) { const b = button(p.label, 'dfnaval-btn dfnaval-tradebuy', () => w.post({ char: r.id, name: r.title }, p.n)); able(b, p.can); presses.append(b); }
      li.append(text, presses);
      wantedList.append(li);
    }
    wantedLine.textContent = wt.line?.text ?? '';
    wantedLine.className = `dfnaval-note${wt.line?.warn ? ' warn' : ''}`;
    if (wt.line) wantedLine.removeAttribute('hidden'); else wantedLine.setAttribute('hidden', '');
  };
  const renderTrade = (x) => {
    const xt = exchangeText(x);
    h2.textContent = 'The exchange';
    tLede.textContent = xt.lede;
    for (const c of [...tradeList.children]) c.remove();
    const press = (r, fn) => { note = r?.text ? { text: r.text, warn: !r.ok } : null; render(); return fn; };
    for (const r of xt.rows) {
      const li = el('li', 'dfnaval-item dfnaval-officerow');
      li.setAttribute('data-row', r.id);
      const text = el('div');
      text.append(el('b', null, r.title), el('span', null, r.words));
      if (r.extra) text.append(el('i', null, r.extra));
      const presses = el('div', 'dfnaval-presses');
      const mk = (label, can, fn) => { const b = button(label, 'dfnaval-btn dfnaval-tradebuy', fn); able(b, can); presses.append(b); };
      mk('Buy 1', r.canBuy, () => press(x.buy(r.id, 1)));
      mk('Buy 10', r.canBuy, () => press(x.buy(r.id, 10)));
      mk('Sell 1', r.canSell, () => press(x.sell(r.id, 1)));
      // AUDIT CREW-TRADE R2: crew sells ten at a time as it buys - one "Sell all" press took a Small Ship from 13 men to 1
      if (r.id === CREW.id) mk('Sell 10', r.canSell, () => press(x.sell(r.id, 10)));
      else mk('Sell all', r.canSell, () => press(x.sell(r.id, Infinity)));
      li.append(text, presses);
      tradeList.append(li);
    }
  };
  const render = () => {
    if (!alive) return;
    const o = office(), x = exchange();
    tabs.style.display = o || x ? '' : 'none';
    officeTab.style.display = o ? '' : 'none';
    tradeTab.style.display = x ? '' : 'none';
    if ((tab === 'office' && !o) || (tab === 'trade' && !x)) tab = 'yard';
    yardTab.className = `dfnaval-btn${tab === 'yard' ? ' on' : ''}`;
    officeTab.className = `dfnaval-btn${tab === 'office' ? ' on' : ''}`;
    tradeTab.className = `dfnaval-btn${tab === 'trade' ? ' on' : ''}`;
    const onYard = tab === 'yard';
    for (const n of [lede, sec, pSec]) n.style.display = onYard ? '' : 'none';
    for (const n of [oLede, boardSec, heldSec, lettersSec, wantedSec, seasonSec]) n.style.display = tab === 'office' ? '' : 'none';
    for (const n of [tLede, tradeSec]) n.style.display = tab === 'trade' ? '' : 'none';
    const t = yardText(m);
    h2.textContent = t.title;
    sub.textContent = t.sub;
    lede.textContent = t.lede;
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `dfnaval-note${note?.warn ? ' warn' : ''}`;
    if (note) noteLine.removeAttribute('hidden'); else noteLine.setAttribute('hidden', '');
    for (const c of [...list.children]) c.remove();
    for (const r of t.rows) {
      const li = el('li', 'dfnaval-item dfnaval-yardrow');
      li.setAttribute('data-row', r.id);
      const press = button(r.press, 'dfnaval-btn dfnaval-yardbuy', () => { note = yardNote(m.buy?.(r.id)); render(); });
      able(press, r.can);
      li.append(el('b', null, r.label), el('span', null, r.state), press);
      list.append(li);
    }
    for (const c of [...pList.children]) c.remove();
    for (const r of t.provisions) {
      const li = el('li', 'dfnaval-item dfnaval-yardrow');
      li.setAttribute('data-row', r.id);
      const press = button(r.press, 'dfnaval-btn dfnaval-yardbuy', () => { note = yardNote(m.buyProvision?.(r.id)); render(); });
      able(press, r.can);
      li.append(el('b', null, r.label), el('span', null, r.state), press);
      pList.append(li);
    }
    pSec.style.display = onYard && t.provisions.length ? '' : 'none';
    whole.style.display = t.whole ? '' : 'none';
    whole.textContent = t.whole ?? '';
    able(whole, t.canWhole);
    if (tab === 'office') renderOffice(o);
    if (tab === 'trade') renderTrade(x);
  };
  render();
  host.append(shell);
  (whole.style.display !== 'none' && !whole.disabled ? whole : close).focus?.({ preventScroll: true });
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit('close'); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.dfnaval-win', () => exit('close'));
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
