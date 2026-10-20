// @ts-check
// REVENANT-PAGE (2026-10-02, Mac: "Definitely finish this with love. Any new UI elements need to be enhanced UI plus"):
// THE REVENANTS PAGE on the Enhanced pause menu's Holdings rail (ui/enhanced/enhancedMenu.js pauseHoldings; HOLDINGS moved it off
// the Stats rail, 2026-10-03) - every foe that has earned
// the character's name (systems/revenant/revenant.js), the living first, strongest first: its portrait in a sunk well with its
// rank on a chip, its name and what it is, what it has done to you, when it will come, and its deeds in order; then
// the FALLEN, greyed and struck through, with the day each fell. A character with none is told how one is made.
//
// Dressed by the stone-and-brass kit's roles (ui/enhanced/enhancedFrame.js FRAME_ROLES: a row a tile, the portrait a well, the
// rank a chip) - this sheet writes geometry and the words' colours alone, as the stats card's does.

import { revenantsFor, revenantOn, revenantHeld, revenantPortrait, revenantRankNumeral, REVENANT_MAX, REVENANT_MAX_RANK, REVENANT_MIN_RENOWN, takenName } from '../../systems/revenant/revenant.js';   // RENOWN-GATE: a held one says so
import { ownMinutes } from '../../systems/worldTick.js';
import { requestFittedIcon, fittedImg } from '../textureCanvas.js';
import { PERSONALITIES } from '../../systems/revenant/revenantPersonality.js';   // REVENANT-VOICE: who each is
import { WEAK_NAMES, WEAK_HINTS, weaknessKind, willMatters, LAST_STAND_RANK, lastStandHealth, signatureStamp, bandMembers, bandName, WRATH_MAX, loyaltyLabel } from '../../systems/revenant/revenantFeud.js';   // RVN3: its weakness, its will; RVN4: its last stand; RVN5: its signature; RVN6: its band
import { tacticsSwitchOn } from '../../ai/tactics.js';   // RVN5: a signature is a telegraph - the Enhanced AI switch's
import { artWords } from '../../systems/revenant/revenantArts.js';   // RVN-ARTS: its art, as it would use it on me - or for me, sworn
import { ambitionOf, ambitionWords, woundWords, craftWords, revenantCraft, CRAFT, DREAD, sanitizeWounds, trailWarm, trailHours, daysToHeal, healWords } from '../../systems/revenant/revenantUnquiet.js';   // UNQUIET (Revenants.md section 46): its craft, its wounds, its ambition, the Dread
import { t } from '../../systems/textManager.js';   // L10N4: UNQUIET's words through the text core

export const REVENANT_PAGE_SECTIONS = Object.freeze([['revenants', 'Revenants']]);
export const REVENANT_PAGE_STYLE_ID = 'revenant-page-css';
const FACE_BOX = 56;
let _icon = (p, onReady) => requestFittedIcon(p.archive, p.record, { box: FACE_BOX, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady });
/** Tests: the portrait source. */
export function _setRevenantPageIconForTests(fn) { _icon = fn ?? ((p, onReady) => requestFittedIcon(p.archive, p.record, { box: FACE_BOX, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady })); }

/** The rail shows the page while revenants are made (the loot-rarity row), or while any is remembered. */
export const revenantPageShown = (player = null) => revenantOn() || revenantsFor(player).length > 0;

export const REVENANT_PAGE_CSS = `
.px-sys .rvn-list { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 10px; }
.px-sys .rvn-row { display: grid; grid-template-columns: ${FACE_BOX + 8}px 1fr; gap: 10px; padding: 7px 10px 8px 7px;
  border-width: 2px; border-style: solid; box-sizing: border-box; text-align: left; }
.px-sys .rvn-face { position: relative; box-sizing: border-box; width: ${FACE_BOX + 8}px; height: ${FACE_BOX + 8}px; border-width: 2px;
  border-style: solid; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
.px-sys .rvn-face img.fit { image-rendering: pixelated; }
.px-sys .rvn-face .rvn-glyph { margin: auto; font-size: 24px; color: #8b8578; }
.px-sys .rvn-rank { position: absolute; right: 2px; bottom: 2px; z-index: 1; min-width: 18px; padding: 0 3px; box-sizing: border-box;
  border-width: 1px; border-style: solid; font-size: 10px; line-height: 1.3; text-align: center; color: #f3cf86; }
.px-sys .rvn-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.px-sys .rvn-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.px-sys .rvn-name { font-size: 15px; color: #f3cf86; overflow-wrap: anywhere; }
.px-sys .rvn-when { flex: none; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #d0604f; }
.px-sys .rvn-when.is-waiting { color: #b8b0a0; }
.px-sys .rvn-when.is-out { color: #e0a54a; }
.px-sys .rvn-sub { font-size: 11px; color: #8b8578; }
.px-sys .rvn-mood { display: inline-block; margin-right: 6px; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 9px; line-height: 1.5; letter-spacing: 0.12em; text-transform: uppercase; color: #e9c46a; vertical-align: 1px; }
.px-sys .rvn-blurb { font-size: 11px; font-style: italic; color: #b8b0a0; }
.px-sys .rvn-deeds { font-size: 12px; color: #e9e4d9; }
.px-sys .rvn-come { font-size: 12px; color: #b8b0a0; }
.px-sys .rvn-scars { font-size: 11px; color: #c9a27a; }
.px-sys .rvn-learned { font-size: 11px; color: #e0a54a; display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }
.px-sys .rvn-chip { padding: 0 5px; border: 1px solid #8a6a3a; font-size: 10px; letter-spacing: 0.06em; color: #f0c27a; cursor: help; }
.px-sys .rvn-effects { font-size: 11px; color: #b8b0a0; }
.px-sys .rvn-pips { display: inline-flex; gap: 3px; margin-top: 2px; }
.px-sys .rvn-pip { width: 8px; height: 8px; border: 1px solid #8c3a32; background: transparent; }
.px-sys .rvn-pip.is-on { background: #c0503a; }
.px-sys .rvn-weak { font-size: 11px; color: #9fc2d8; }
.px-sys .rvn-will { font-size: 11px; font-style: italic; color: #d0604f; }
.px-sys .rvn-history { margin: 3px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 2px 10px; font-size: 10px; color: #8b8578; }
.px-sys .rvn-history li::before { content: '\\25C6 '; color: #c08a3e; }
.px-sys .rvn-row.is-fallen .rvn-face img { filter: grayscale(1) brightness(0.6); }
.px-sys .rvn-row.is-fallen .rvn-face::before { content: ''; position: absolute; left: -10%; right: -10%; top: 50%; z-index: 1;
  border-top: 3px solid #8c3a32; transform: rotate(-38deg); }
.px-sys .rvn-row.is-fallen .rvn-name { color: #b8b0a0; text-decoration: line-through; text-decoration-color: #8c3a32; }
:root[data-plus-theme="stone"] .px-sys .rvn-sub, :root[data-plus-theme="stone"] .px-sys .rvn-history { color: #e2d9c4; }
:root[data-plus-theme="stone"] .px-sys .rvn-come, :root[data-plus-theme="stone"] .px-sys .rvn-scars, :root[data-plus-theme="stone"] .px-sys .rvn-learned { color: #efe8d8; }
`;

function ensureStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(REVENANT_PAGE_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = REVENANT_PAGE_STYLE_ID;
  st.textContent = REVENANT_PAGE_CSS;
  (doc.head ?? doc.body)?.append(st);
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** How long ago a minute was, in the words a journal uses. */
export function agoWords(minute, now) {
  const days = Math.floor(Math.max(0, now - minute) / 1440);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}
/** When a living revenant will come, in words: out in the world now, due (any road), or in so long. RENOWN-GATE: or
 *  held under its Renown (systems/revenant/revenant.js revenantHeld), when neither "any road" nor a day would be true. */
export function comeWords(r, now, held = revenantHeld()) {
  // UNQUIET (Revenants.md section 46): the Dread waits at home, whoever is out (AUDIT UNQUIET: but held, none is at home -
  // revenant.js revenantForLair - and it says so)
  if (r.dread && !held) return { tag: t('rvn.unq.page.dreadTag', 'The Dread'), cls: 'is-out', line: t('rvn.unq.page.dreadCome', 'It waits for you in {lair} and will not come to you again. Go to it.', { lair: r.lair?.name ?? '' }) };
  if (r.out) return { tag: 'Abroad', cls: 'is-out', line: 'Out in the world, looking for you.' };
  if (held) return { tag: 'Held', cls: 'is-waiting', line: `It will not come for you before Renown ${REVENANT_MIN_RENOWN}.` };
  // UNQUIET II (section 47): its trail warm - gone to ground to recover, and findable there (AUDIT UNQUIET: "weakened", never
  // "wounded" - its wounds are what the player left on it, and heal by their own law)
  if (trailWarm(r, now)) return { tag: t('rvn.unq.page.woundedTag', 'Weakened'), cls: '', line: t('rvn.unq.page.woundedCome', 'Recovering in {lair}, whole again in {hours, plural, one {# hour} other {# hours}}. Find it there.', { lair: r.lair?.name ?? '', hours: trailHours(r, now) }) };
  const left = r.dueAt - now;
  if (left <= 0) return { tag: 'Hunting', cls: '', line: 'Hunting you. It may appear on any road.' };
  const days = Math.round(left / 1440);
  return { tag: 'Biding', cls: 'is-waiting', line: days >= 1 ? `It will come for you in about ${plural(days, 'day')}.` : `It will come for you within the day.` };
}
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
/** What it has done to you. */
export function deedWords(r) {
  const parts = [];
  if (r.kills) parts.push(`killed you ${times(r.kills)}`);
  if (r.escapes) parts.push(`escaped you ${times(r.escapes)}`);
  if (r.returns) parts.push(`came back ${times(r.returns)}`);
  const s = parts.join(', ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : '';
}
const DEED_WORDS = Object.freeze({
  slew: 'killed you', fled: 'escaped', returned: 'came back', fell: 'fell', yielded: 'yielded', executed: 'executed', spared: 'spared', released: 'released',
  // RVN1 (bible/12-Enhanced-AI/Feud-Arc.md section 26): the deeds FEUD adds, worded with the union
  felled: 'felled your companion', routed: 'routed you', festered: 'grew bolder', deserted: 'deserted you', betrayed: 'betrayed you', laststand: 'made its last stand',
  ascended: 'became the Dread',   // UNQUIET (Revenants.md section 46)
});
/** A deed in words - RVN10 (bible/12-Enhanced-AI/Feud-Arc.md 21.1): a felling by the companion's name it keeps. */
export const historyWords = (d) => (d?.deed === 'felled' && typeof d.ally === 'string' && d.ally ? `felled ${d.ally}` : d?.deed === 'fled' && d.unbroken === true ? 'escaped unbroken' : DEED_WORDS[d?.deed] ?? String(d?.deed ?? ''));   // RVN12b (24.1): an escape unbroken
/** RVN1 (section 12; RVN12 completes the page): what a scar says - the way it was hurt, or what it learned of the fight. */
const SCAR_WORDS = Object.freeze({
  blade: 'blades', blunt: 'blunt weapons', axe: 'axes', h2h: 'fists', arrow: 'arrows', fire: 'fire', frost: 'frost', shock: 'shock',
  poison: 'poison', magic: 'magic', other: 'strange blows', silver: 'silver', mixed: 'many ways', staggered: 'staggered', dodged: 'outmanoeuvred',
  back: 'struck from behind', night: 'fought by night',
});
/** RVN2 (section 13.2; RVN12 completes the page): an adaptation's name. */
export const ADAPT_NAMES = Object.freeze({
  mailed: 'Mailed', braced: 'Braced', hewnHard: 'Hewn-hard', unflinching: 'Unflinching', arrowWise: 'Arrow-wise',
  fireproof: 'Fireproof', rimebound: 'Rimebound', grounded: 'Grounded', venomBlooded: 'Venom-blooded', spellScarred: 'Spell-scarred',
  silverScarred: 'Silver-scarred', steadfast: 'Steadfast', patient: 'Patient', watchful: 'Watchful', relentless: 'Relentless', nightStalker: 'Night-stalker',
});
/** RVN12b (bible/12-Enhanced-AI/Feud-Arc.md 24.1): what each adaptation does to me, in a chip's words (13.2's table). */
export const ADAPT_EFFECTS = Object.freeze({
  mailed: 'your blades bite less', braced: 'your blunt blows bite less; it stands firmer', hewnHard: 'your axes bite less',
  unflinching: 'your fists bite less', arrowWise: 'your arrows bite less; it closes fast', fireproof: 'it shrugs off fire',
  rimebound: 'it shrugs off frost', grounded: 'it shrugs off shock', venomBlooded: 'it shrugs off poison', spellScarred: 'it shrugs off magic',
  silverScarred: 'silver no longer doubles on it', steadfast: 'it stands firmer; its blows often cannot be broken',
  patient: 'it tracks you, feints and times its swings', watchful: 'it is never caught unaware', relentless: 'it is faster, and never gives up the hunt',
  nightStalker: 'it comes only by night, and strikes harder in the dark',
});
/** What it learned, oldest first (the order it forgets them in). */
export function learnedWords(r) {
  const names = (r?.learned ?? []).map((a) => ADAPT_NAMES[a]).filter(Boolean);
  return names.length ? `Learned: ${names.join(', ')}.` : '';
}
/** RVN12b (24.1): what it learned as chips - each its name and what it does ("Arrow-wise - your arrows bite less; it
 *  closes fast"), oldest first. */
export const learnedChips = (r) => (r?.learned ?? []).filter((a) => ADAPT_NAMES[a]).map((a) => ({ id: a, name: ADAPT_NAMES[a], effect: ADAPT_EFFECTS[a] ?? '', title: `${ADAPT_NAMES[a]} - ${ADAPT_EFFECTS[a] ?? ''}` }));
/** RVN12b (24.1): RVN8's theft - the pieces it carries of mine. */
export function tookWords(r) {
  const names = (r?.took ?? []).map((it) => takenName(it)).filter(Boolean);   // RVN12b: the pieces it took, by the names the pack shows (AUDIT FEUD: their article gone after "your")
  if (!names.length) return '';
  return `Took: your ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]}. Take ${names.length > 1 ? 'them' : 'it'} back from it.`;
}
/** RVN12b (24.1): RVN9's festering - its wrath as pips (filled of WRATH_MAX), and its words; none without a wrath. */
export function festerPips(r) {
  const w = Math.max(0, Math.min(WRATH_MAX, r?.wrath | 0));
  return { filled: w, of: WRATH_MAX, words: w ? `Festering: ${w} of ${WRATH_MAX}. It grows stronger the longer you leave it.` : '' };
}
/** RVN12b (24.1): a sworn one's loyalty on this page - its number and its word (the Companions page draws its bar). */
export const swornLoyaltyWords = (r) => (Number.isFinite(r?.companion?.loyalty) ? `Loyalty: ${r.companion.loyalty} - ${loyaltyLabel(r.companion.loyalty)}.` : '');
/** RVN3 (section 14; RVN12 completes the page): its weakness as the player knows it - unknown, its kind (a flinch's or a
 *  rumour's hint), or what it is. */
export function weaknessWords(r) {
  const k = r?.weakKnown | 0;
  if (k >= 2 && WEAK_NAMES[r.weak]) return `Weakness: ${WEAK_NAMES[r.weak]}.`;
  if (k === 1) return `Weakness: ${WEAK_HINTS[weaknessKind(r.weak)] ?? 'Something'}.`;
  return 'Weakness: unknown.';
}
/** RVN3 (14.2): from its will's rank (revenantFeud.js WILL_RANK - UNQUIET: rank 2, it was 3), the rule of its will. */
export const willWords = (r) => (willMatters(r?.rank) ? 'Its will must be broken. Strike its weakness, stagger it, or evade its blow at the last moment.' : '');   // FEUD BALANCE (Feud-Arc.md OPEN 22)
/** RVN4 (section 15): from rank 3, its last stand - once a fight it rises again from the edge of death. */
export const lastStandWords = (r) => ((r?.rank | 0) >= LAST_STAND_RANK ? `Last stand: once a fight it rises again, at ${Math.round(lastStandHealth(r.rank) * 100)}% of its health.` : '');
/** RVN5 (section 16; RVN12 completes the page): what its signature does, by its shape (a pyre's by its element). */
const SIG_SHAPES = Object.freeze({
  slam: 'an overhead slam', sweep: 'a sweeping arc', lunge: 'a lunge', charge: 'a charge', leap: 'a leap', ring: 'a ring about it',
});
const PYRE_WORDS = Object.freeze(['fire', 'frost', 'poison', 'shock', 'magic']);
/** RVN5 (16.1): from rank 2, its signature - its name and what it is; with the Enhanced AI switch off it never winds one
 *  up, and the page says so. */
export function signatureWords(r, enhanced = tacticsSwitchOn()) {
  const sig = signatureStamp(r);
  if (!sig?.name) return '';
  const what = sig.kind === 'pyre' ? `a blast of ${PYRE_WORDS[sig.element] ?? 'magic'} at your feet` : SIG_SHAPES[sig.kind];
  return `Signature: ${sig.name}${what ? ` - ${what}` : ''}${sig.iron ? ', unstoppable' : ''}${enhanced ? '' : ' (with Enhanced AI)'}.`;
}
/** RVN6 (section 17; RVN12 completes the page): a kind's name, many of it ("two Orcs", "three Thieves"). */
const COUNT_WORDS = Object.freeze(['', 'a', 'two', 'three']);
export function pluralKind(name, n) {
  if (n === 1) return `${/^[AEIOU]/i.test(name) ? 'an' : 'a'} ${name}`;
  const many = /fish$/i.test(name) ? name : /f$/i.test(name) ? `${name.slice(0, -1)}ves` : /[^aeiou]y$/i.test(name) ? `${name.slice(0, -1)}ies` : /(s|sh|ch|x)$/i.test(name) ? `${name}es` : `${name}s`;
  return `${COUNT_WORDS[n] ?? n} ${many}`;
}
/** RVN6 (17): from rank 2, who rides with it - its band's kinds, counted in the order they ride, and its name ("Band:
 *  rides with two Orcs and an Orc Shaman - Grushnak's Warband."). */
export function bandWords(r, kindName = (t) => String(t)) {
  const name = bandName(r);
  const members = name ? bandMembers(r, 1) : [];
  if (!members.length) return '';
  const counts = new Map();
  for (const m of members) counts.set(m.mobileType, (counts.get(m.mobileType) ?? 0) + 1);
  const parts = [...counts].map(([t, n]) => pluralKind(kindName(t), n));
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `Band: rides with ${list} - ${name}.`;
}
/** RVN7 (18.1; RVN12 completes the page): where it goes to ground - its lair as the player knows it. RENOWN-GATE: held,
 *  neither the map's mark nor the towns' word (systems/revenant/revenant.js revenantMapMarks, revenantRumor) is promised. */
export function lairWords(r, held = revenantHeld()) {
  if (!r?.lair?.name) return 'Lair: none. It roams.';
  if (held) return r.lairKnown ? `Lair: ${r.lair.name}.` : 'Lair: unknown.';
  return r.lairKnown ? `Lair: ${r.lair.name}, marked on your map.` : 'Lair: unknown. Nearby towns may have heard of it.';   // RVN7c: and marked
}
/** UNQUIET (Revenants.md section 46): the wounds the player left on it, each with what it does. */
export function woundLine(r, now = null, held = revenantHeld()) {
  const ws = sanitizeWounds(r?.wounds).map((w) => woundWords(w)).filter(Boolean);
  if (!ws.length) return '';
  const line = t('rvn.unq.page.wounds', 'Wounds you left: {list}.', { list: ws.map((w) => `${w.name} (${w.effect})`).join(', ') });
  // UNQUIET III (section 48): left alone, they heal. AUDIT UNQUIET: only where they do - never the Dread's (it festers no
  // more), one out in the world, nor while held (revenant.js revenantFester passes all three by)
  const heals = Number.isFinite(now) && !r?.dread && !r?.out && !held;
  const days = heals ? daysToHeal(r?.woundDay, Math.floor(now / 1440), r?.wounds) : 0;
  return days ? `${line} ${healWords(days)}` : line;
}
/** UNQUIET: how it gets away - its craft from rank II, a plain run before; the Dread never runs. */
export function craftLine(r) {
  if (r?.dread) return t('rvn.unq.page.dreadWill', 'At home it has nowhere to run: it never flees, and kneels at the end.');
  const c = craftWords(revenantCraft(r?.mobileType, r?.rank));
  return c ? t('rvn.unq.page.craft', 'Its flight: {name} - {effect}.', { name: c.name, effect: c.effect })
    : t('rvn.unq.page.craftYoung', 'Its flight: it runs. From rank {rank} it will break away in its own way.', { rank: revenantRankNumeral(CRAFT.RANK) });
}
/** UNQUIET: what it does while it waits (none for the Dread - it waits at home). */
export function ambitionLine(r) {
  if (r?.dread) return '';
  const a = ambitionWords(ambitionOf(r?.personality));
  return a ? t('rvn.unq.page.ambition', 'Its ambition: {name} - {effect}.', { name: a.name, effect: a.effect }) : '';
}
/** UNQUIET: its blood since its last rank - one more kill and it climbs (AUDIT UNQUIET: a companion is felled, never
 *  killed); and its tear-aways (revenantUnquiet.js TEAR_RANK) - once more its will holds, and it climbs. */
export const bloodLine = (r) => ((r?.blood | 0) >= 1 && (r?.rank | 0) < REVENANT_MAX_RANK ? t('rvn.unq.page.blood', 'If it kills you once more, or fells one more companion, it grows bolder.') : '');
export const tearLine = (r) => ((r?.tears | 0) >= 1 && (r?.rank | 0) < REVENANT_MAX_RANK ? t('rvn.unq.page.tears', 'If its will holds at your killing blow once more, it grows bolder.') : '');
/** UNQUIET: the Dread's two last stands. */
export const dreadStandLine = (r) => (r?.dread ? t('rvn.unq.page.dreadStand', 'Last stands: twice in a fight it rises again, at {first}% and at {second}% of its health.', { first: Math.round(lastStandHealth(r.rank) * 100), second: Math.round(DREAD.SECOND_STAND * 100) }) : '');
/** Its scars, newest first and each once - the ways it was hurt and what it learned (a deed's scar is the history's). */
export function scarWords(r) {
  const seen = new Set();
  const out = [];
  for (const s of [...(r?.scars ?? [])].reverse()) {
    const w = SCAR_WORDS[s?.k];
    if (w && !seen.has(w)) { seen.add(w); out.push(w); }
  }
  return out.length ? `Scarred by ${out.join(', ')}.` : '';
}
/** REVENANT-FATE: how a fallen one ended, in the page's words. */
const FATE_WORDS = Object.freeze({ executed: 'Executed', released: 'Released' });

function face(el, r) {
  const f = el('div', 'rvn-face');
  f.setAttribute('aria-hidden', 'true');
  const p = revenantPortrait(r);
  const put = (pic) => {
    if (!pic?.src) return false;
    f.querySelector?.('.rvn-glyph')?.remove();
    f.insertBefore(fittedImg(pic), f.firstChild ?? null);
    return true;
  };
  let shown = false;
  if (p) {
    const ask = (onReady) => _icon(p, onReady);
    try { shown = put(ask(() => { if (f.isConnected !== false) { try { put(ask(null)); } catch { /* the glyph stands */ } } })); } catch { shown = false; }
  }
  if (!shown) f.append(el('span', 'rvn-glyph', '☠'));
  if (r.rank > 0) f.append(el('span', 'rvn-rank', revenantRankNumeral(r.rank)));
  return f;
}

function row(el, r, now, kindName) {
  const fallen = !!r.defeated;
  const item = el('div', `rvn-row${fallen ? ' is-fallen' : ''}`);
  const text = el('div', 'rvn-text');
  const head = el('div', 'rvn-head');
  head.append(el('span', 'rvn-name', r.name));
  const come = fallen || r.sworn ? null : comeWords(r, now);
  if (come) head.append(el('span', `rvn-when ${come.cls}`.trim(), come.tag));
  else if (r.sworn) head.append(el('span', 'rvn-when is-waiting', 'Sworn'));   // REVENANT-COMPANION
  const trait = typeof r.trait === 'string' && r.trait ? r.trait.charAt(0).toUpperCase() + r.trait.slice(1) : null;
  const sub = el('span', 'rvn-sub', [`Rank ${revenantRankNumeral(r.rank)}`, kindName(r.mobileType), trait, r.elite ? 'Elite' : null].filter(Boolean).join(' · '));
  const P = PERSONALITIES[r.personality];
  if (P) sub.insertBefore(el('span', 'rvn-mood', P.label), sub.firstChild ?? null);   // REVENANT-VOICE: who it is
  text.append(head, sub);
  if (P) text.append(el('span', 'rvn-blurb', P.blurb));
  if (r.sworn) {   // REVENANT-COMPANION: it walks with the player now - the Companions page keeps it
    const st = r.companion?.state ?? 'with';
    text.append(el('span', 'rvn-come', st === 'with' ? 'Sworn to you, at your side.' : st === 'resting' ? 'Sworn to you, recovering from a fall.' : 'Sworn to you, away until you call it.'));
    const loy = swornLoyaltyWords(r);   // RVN12b (24.1): for the sworn, its loyalty
    if (loy) text.append(el('span', 'rvn-will', loy));
    item.append(face(el, r), text);
    return item;
  }
  const deeds = deedWords(r);
  if (deeds) text.append(el('span', 'rvn-deeds', deeds));
  text.append(el('span', 'rvn-come', fallen ? `${FATE_WORDS[r.fate] ?? 'Fell'} ${agoWords(r.defeatedAt ?? now, now)}.` : come.line));
  const scars = fallen ? '' : scarWords(r);   // RVN1: what its fights left on it
  if (scars) text.append(el('span', 'rvn-scars', scars));
  const chips = fallen ? [] : learnedChips(r);   // RVN2: and what it learned of them - RVN12b (24.1): as chips, each with its effect
  if (chips.length) {
    const box = el('span', 'rvn-learned');
    box.append(el('span', 'rvn-learned-head', 'Learned:'));
    for (const c of chips) { const chip = el('span', 'rvn-chip', c.name); chip.title = c.title; box.append(chip); }
    text.append(box);
    text.append(el('span', 'rvn-effects', chips.map((c) => `${c.name} - ${c.effect}.`).join(' ')));
  }
  if (!fallen) text.append(el('span', 'rvn-weak', weaknessWords(r)));   // RVN3: its weakness, as I know it
  const will = fallen || r.dread ? '' : willWords(r);
  if (will) text.append(el('span', 'rvn-will', will));
  const stand = fallen ? '' : r.dread ? dreadStandLine(r) : lastStandWords(r);   // RVN4; UNQUIET: the Dread's two
  if (stand) text.append(el('span', 'rvn-will', stand));
  // UNQUIET (Revenants.md section 46): how it gets away, the wounds I left on it, what it does while it waits, its blood
  for (const line of fallen ? [] : [craftLine(r), woundLine(r, now), ambitionLine(r), bloodLine(r), tearLine(r)]) if (line) text.append(el('span', 'rvn-will', line));
  const sig = fallen ? '' : signatureWords(r);   // RVN5
  if (sig) text.append(el('span', 'rvn-will', sig));
  const art = fallen ? '' : artWords(r);   // RVN-ARTS (Revenants.md section 41)
  if (art) text.append(el('span', 'rvn-will', art));
  const band = fallen ? '' : bandWords(r, kindName);   // RVN6
  if (band) text.append(el('span', 'rvn-will', band));
  if (!fallen) text.append(el('span', 'rvn-will', lairWords(r)));   // RVN7
  const took = fallen ? '' : tookWords(r);   // RVN12b (24.1): RVN8's pieces
  if (took) text.append(el('span', 'rvn-will', took));
  const fester = fallen ? null : festerPips(r);   // RVN12b (24.1): RVN9's wrath, three pips
  if (fester?.filled) {
    const pips = el('span', 'rvn-pips');
    pips.setAttribute('aria-label', fester.words);
    for (let i = 0; i < fester.of; i++) pips.append(el('span', `rvn-pip${i < fester.filled ? ' is-on' : ''}`, ''));
    text.append(pips, el('span', 'rvn-will', fester.words));
  }
  const hist = (r.history ?? []).slice(-5);
  if (hist.length) {
    const ul = el('ul', 'rvn-history');
    for (const d of hist) ul.append(el('li', '', `${historyWords(d)}, ${agoWords(d.at, now)}`));
    text.append(ul);
  }
  item.append(face(el, r), text);
  return item;
}

/**
 * THE PAGE (ui/enhanced/enhancedMenu.js pauseStats' dispatch): `detail` the rail's detail pane, `kit` the menu's own makers
 * ({ el, divider }) and the player whose revenants these are.
 */
export function drawRevenantsPage(detail, rerender, { el, divider, player = null, kindName = (t) => String(t) } = /** @type {any} */ ({})) {
  ensureStyle(typeof document === 'undefined' ? null : document);
  const now = Math.floor(ownMinutes());
  const all = revenantsFor(player);
  const living = all.filter((r) => !r.defeated && !r.sworn).sort((a, b) => b.rank - a.rank || a.dueAt - b.dueAt);
  const sworn = all.filter((r) => r.sworn && !r.defeated).sort((a, b) => b.rank - a.rank);   // REVENANT-COMPANION
  const fallen = all.filter((r) => r.defeated).sort((a, b) => (b.defeatedAt ?? 0) - (a.defeatedAt ?? 0));
  detail.append(divider(`Revenants (${living.filter((r) => !r.dread).length} of ${REVENANT_MAX})`));   // AUDIT UNQUIET: the cap counts those that hunt - the Dread waits
  if (!living.length) {
    // UNQUIET (Revenants.md section 46): only a foe marked Unquiet rises - and far likelier by getting away than by a kill
    const lead = all.length ? t('rvn.unq.page.noneNow', 'None hunts you now.') : t('rvn.unq.page.noneYet', 'No foe has earned your name yet.');
    const how = revenantHeld()
      ? t('rvn.unq.page.howHeld', 'From Renown {renown}, an elite or champion marked Unquiet that escapes you, or kills you, will remember you and come back for you.', { renown: REVENANT_MIN_RENOWN })
      : t('rvn.unq.page.how', 'An elite or champion marked Unquiet that escapes you, or kills you, will remember you and come back for you.');
    detail.append(el('p', 'px-note', revenantOn()
      ? `${lead} ${how}`   // AUDIT (2026-10-02): the sworn and the fallen below are revenants too; RENOWN-GATE: and when they begin
      : 'Revenants need Loot rarity, which is off.'));
  } else {
    const list = el('div', 'rvn-list');
    for (const r of living) list.append(row(el, r, now, kindName));
    detail.append(list);
  }
  if (sworn.length) {
    detail.append(divider('Sworn to you'));
    const list = el('div', 'rvn-list');
    for (const r of sworn) list.append(row(el, r, now, kindName));
    detail.append(list);
  }
  if (fallen.length) {
    detail.append(divider('Fallen'));
    const list = el('div', 'rvn-list');
    for (const r of fallen) list.append(row(el, r, now, kindName));
    detail.append(list);
  }
}
