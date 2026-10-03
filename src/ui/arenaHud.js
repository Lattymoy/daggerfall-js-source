// @ts-check
// ARENA2 (2026-10-02, Mac: "All UI elements and text must be enhanced UI plus"): THE BOUT ON THE HUD - the versus bar
// (each fighter's name, their banner's mark, their health; my stamina when I fight), the crowd's meter (booing to
// roaring, its darling and its villain marked on the bar), the fight's clock, and under them the line that says I may
// yield. The Herald's words and the "3 - 2 - 1 - Fight!" are said mid-screen (ui/midScreenText.js, the host's). Design:
// bible/11-Multiplayer/Arena.md "5. The Arena window" (its HUD paragraph).
//
// A READOUT, NOT A WINDOW (the gate bar's law, ui/gateBossBar.js): no key taken, no click, nothing paused - a fighter is
// never held by it. One node made at the first bout and UPDATED, NOT REBUILT: each part written only when what it says
// changes (`textContent` only - a fighter's name is the bout's, never markup), hidden (never removed) when there is no
// bout, and hidden with the HUD. In BOTH skins: the bar's own sheet (ARENA_HUD_CSS) draws it plainly in the pixel face;
// the Enhanced Plus sheet dresses it in the stone-and-brass kit (ui/enhancedFrame.js roles - the plate a panel, the
// marks chips - and ui/enhancedPlusStyle.js ARENA_DRESS_CSS for the fills). Only what MOVES is written inline: a fill's
// width. Reduced motion: no fill slides. A touch screen: the words a size up.
//
// The banner's mark (`data-banner`) is a placeholder the teams fill (ARENA3): today the player's side wears 'you' and
// the other 'them'. `arenaHudModel` is pure - the pins' door.
//
// ARENA3: THE BANNERS' MARKS - each fighter of a banner wears its pennant before the name (`data-team` red | blue, the
// `.arena-team` mark, its colour the sheet's): mine in a ladder bout when I fight under one, and an exhibition's two
// fighters, the Red Banner's against the Blue's (scenes/arenaBouts.js boutTeams). The house's fighters wear none.
//
// ARENA4b: THE STANDS' TWO PRESSES (Mac, 2026-10-02: "During fights, the crowd is present and can cheer/boo you") - a
// spectator in the stands of a relay's bout (scenes/arenaBouts.js startRelay, `me` '') may Cheer or Boo: two touch-sized
// presses under the plate and two keys (STANDS_KEYS - the + and - keys, which no game action holds), each the host's
// door (`drawArenaHud`'s `cheer`), shut while the relay's allowance runs (the model's `stands.ready`, scenes/arenaBouts.js
// CHEER_GAP_MS). The one part of the HUD that takes a press, and only while I watch: its row its own (`.arena-stands`,
// pointer-events its buttons' alone, a press swallowed so it is never a swing), the readout under it still hidden from a
// screen reader while the presses are not; the keys heard only while the row stands, never in a field nor with a
// modifier, never one another window took first. The kit's button role dresses them on Plus (ui/enhancedFrame.js).
//
// Not a DFU member. Ledger A (ARENA).

import { ARENA_TEXT } from '../systems/arenaText.js';
import { boutTimeLeft, fighterShare, YIELD_SHARE } from '../systems/arenaBout.js';
import { moodBand, darlingOf, villainOf } from '../systems/arenaCrowd.js';
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';

/** Where it stands: under the compass strip, centred (the gate bar's place - never both: the court has no arena). */
export const ARENA_HUD_TOP = '58px';
export const ARENA_HUD_WIDTH = 560;
/** The most fighters a side lists (a Grand Melee's opponents three, a two-against-one's two). */
export const HUD_ROWS_MAX = 3;
/** ARENA4b: the stands' keys (`KeyboardEvent.code`): Cheer and Boo - the + and the - of the main row, which no default
 *  binding holds (systems/inputActions.js DEFAULT_BINDINGS; the keypad's two are Eye of the Beholder's and the boat's). */
export const STANDS_KEYS = Object.freeze({ Equal: 1, Minus: -1 });

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * WHAT THE HUD SAYS for `bout` (systems/arenaBout.js) and `crowd` (systems/arenaCrowd.js) at `now`, or null (no bout,
 * or one done). `you` my fighter's id when I fight (null when I watch), `stamina` my fatigue's share (0..1).
 * `bark` the crowd's last shout (systems/arenaCrowd.js crowdBark), shown under its meter while it rings.
 * `{ phase, left: Row[], right: Row[], timer, crowd: { frac, band, word } | null (`quiet`: no crowd), stamina, hint, bark }` - each
 * Row `{ id, name, frac, out, you, tag, banner, team }`. ARENA3: `teams` each fighter's banner by id ('red' | 'blue'). Pure.
 * ARENA4b: `stands` `{ ready }` while I watch a relay's bout from the stands (null otherwise): the model's `stands`
 * `{ cheer, boo, cheerKey, booKey, ready }` - the two presses' words, their keys, whether the allowance lets one now.
 */
export function arenaHudModel(bout, crowd, now, { you = null, stamina = null, bark = '', quiet = false, teams = null, stands = null } = {}) {
  if (!bout || bout.phase === 'done' || !Array.isArray(bout.fighters)) return null;
  const mine = you != null ? bout.fighters.find((f) => f.id === String(you)) ?? null : null;
  const leftSide = mine ? mine.side : bout.fighters[0].side;
  const darling = darlingOf(crowd), villain = villainOf(crowd);
  const row = (f) => ({
    id: f.id, name: f.name, frac: Math.round(fighterShare(f) * 1000) / 1000,
    out: f.out ? ARENA_TEXT.hud.out[f.out] ?? '' : '', you: !!mine && f.id === mine.id,
    tag: f.id === darling ? ARENA_TEXT.hud.darling : f.id === villain ? ARENA_TEXT.hud.villain : '',
    banner: f.side === leftSide ? (mine ? 'you' : 'a') : (mine ? 'them' : 'b'),
    team: teams?.[f.id] === 'red' || teams?.[f.id] === 'blue' ? teams[f.id] : '',
  });
  const left = bout.fighters.filter((f) => f.side === leftSide).slice(0, HUD_ROWS_MAX).map(row);
  const right = bout.fighters.filter((f) => f.side !== leftSide).slice(0, HUD_ROWS_MAX).map(row);
  const secs = Math.ceil(boutTimeLeft(bout, now) / 1000);
  const mood = Math.max(-1, Math.min(1, crowd?.mood ?? 0));
  const band = moodBand(mood);
  const live = bout.phase === 'fight';
  return {
    phase: bout.phase, left, right, timer: ARENA_TEXT.hud.timeLeft(Math.max(0, secs)),
    crowd: quiet ? null : { frac: Math.round(((mood + 1) / 2) * 1000) / 1000, band, word: ARENA_TEXT.mood[band] },   // ARENA-FIX 4: the training pit has no crowd - no meter
    stamina: mine && Number.isFinite(stamina) ? Math.round(clamp01(/** @type {number} */ (stamina)) * 1000) / 1000 : null,
    hint: mine && live && !mine.out && fighterShare(mine) <= YIELD_SHARE ? ARENA_TEXT.hud.yieldHint : '',
    bark: typeof bark === 'string' ? bark : '',
    stands: stands && !mine && !quiet ? { cheer: ARENA_TEXT.online.cheer, boo: ARENA_TEXT.online.boo, cheerKey: ARENA_TEXT.online.cheerKey, booKey: ARENA_TEXT.online.booKey, ready: !!stands.ready } : null,
  };
}

/** The bar's own sheet: the layout and a plain dress, in the pixel face - what the classic skin draws, and what the
 *  Plus sheet dresses over. No colour the Plus sheet must outweigh is written inline anywhere. */
export const ARENA_HUD_STYLE_ID = 'dagger-arena-hud-style';
export const ARENA_HUD_CSS = `${PIXELIFY_FIVE_FACE}
.arena-hud { position: fixed; left: 50%; top: calc(${ARENA_HUD_TOP} * var(--hud-scale, 1)); transform: translateX(-50%);
  width: ${ARENA_HUD_WIDTH}px; max-width: 94vw; pointer-events: none; z-index: 30; ${PIXEL_FONT_CSS}
  font-size: 13px; letter-spacing: 0.04em; color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7);
  font-variant-numeric: tabular-nums; }
.arena-plate { padding: 6px 10px 7px; background: rgba(12,14,18,0.78); border: 2px solid #5a5446; }
.arena-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 10px; }
.arena-side { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.arena-side.right { text-align: right; }
.arena-ftr { min-width: 0; }
.arena-ftr-head { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
.arena-side.right .arena-ftr-head { flex-direction: row-reverse; }
.arena-ftr-name { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.arena-ftr[data-you="1"] .arena-ftr-name { color: #f3cf86; }
.arena-ftr[data-out]:not([data-out=""]) .arena-ftr-name { opacity: 0.6; }
.arena-tag { flex: 0 0 auto; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 0 4px; border: 1px solid #7a5424; }
.arena-tag:empty { display: none; }
.arena-team { flex: 0 0 auto; display: none; width: 8px; height: 11px; align-self: center; box-shadow: 1px 1px 0 #050608;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%); }
.arena-team[data-team="red"] { display: inline-block; background: linear-gradient(180deg, #f2a597 0 2px, #c23a2b 2px); }
.arena-team[data-team="blue"] { display: inline-block; background: linear-gradient(180deg, #a9c8f2 0 2px, #3768b8 2px); }
.arena-out { flex: 0 0 auto; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #d98074; }
.arena-out:empty { display: none; }
.arena-track { position: relative; height: 10px; margin-top: 2px; background: rgba(5,6,8,0.75); border: 1px solid #3a352a; }
.arena-fill { position: absolute; top: 0; bottom: 0; left: 0; width: 100%; background: #b53a2e; transition: width 160ms linear; }
.arena-side.right .arena-fill { left: auto; right: 0; }
.arena-mid { display: flex; flex-direction: column; align-items: center; gap: 2px; padding-top: 1px; }
.arena-timer { font-size: 16px; letter-spacing: 0.08em; padding: 0 6px; border: 1px solid #5a5446; }
.arena-vs { font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.85; }
.arena-stam { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px; margin-top: 4px; font-size: 10px;
  letter-spacing: 0.1em; text-transform: uppercase; }
.arena-stam .arena-track { height: 6px; margin: 0; }
.arena-stam .arena-fill { background: #2f9152; }
.arena-crowd { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; margin-top: 5px; font-size: 10px;
  letter-spacing: 0.1em; text-transform: uppercase; }
.arena-crowd .arena-track { height: 8px; margin: 0; }
.arena-crowd .arena-fill { background: #c08a3e; }
.arena-crowd-mid { position: absolute; top: -2px; bottom: -2px; left: 50%; width: 2px; background: rgba(239,232,214,0.6); }
.arena-crowd-word { min-width: 74px; text-align: right; }
.arena-bark { margin-top: 4px; text-align: center; font-size: 13px; letter-spacing: 0.06em; color: #efe8d6; }
.arena-bark:empty { display: none; }
.arena-hint { margin-top: 5px; text-align: center; font-size: 12px; color: #f3cf86; }
.arena-hint:empty { display: none; }
.arena-hud.touch { font-size: 15px; }
.arena-hud.touch .arena-bark { font-size: 15px; }
.arena-hud.touch .arena-tag, .arena-hud.touch .arena-out, .arena-hud.touch .arena-crowd, .arena-hud.touch .arena-stam { font-size: 12px; }
.arena-hud.touch .arena-timer { font-size: 18px; }
.arena-stands { display: flex; justify-content: center; gap: 10px; margin-top: 6px; }
.arena-shout { pointer-events: auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px;
  min-width: 96px; padding: 4px 12px; font: inherit; font-size: 13px; letter-spacing: 0.06em; color: #efe8d6; cursor: pointer;
  background: rgba(12,14,18,0.82); border: 2px solid #5a5446; text-shadow: inherit; }
.arena-shout:hover:not([disabled]), .arena-shout:focus-visible { border-color: #c08a3e; }
.arena-shout[disabled] { opacity: 0.55; cursor: default; }
.arena-shout[data-shout="boo"] { border-color: #6b3a32; }
.arena-key { font-size: 10px; padding: 0 4px; border: 1px solid #5a5446; opacity: 0.85; }
.arena-hud.touch .arena-shout { min-height: 48px; min-width: 120px; font-size: 15px; }
.arena-hud.touch .arena-key { display: none; }
@media (max-width: 640px) { .arena-row { gap: 6px; } .arena-plate { padding: 5px 6px; } .arena-crowd-word { min-width: 0; } }
@media (prefers-reduced-motion: reduce) { .arena-fill { transition: none; } }
`;

let root = null, parts = null;
let shown = null;
const fresh = () => ({ vis: '', rows: { left: [], right: [] }, timer: '', stam: -2, crowd: -1, word: '', bark: '', hint: '', touch: null, stands: '', standsReady: false });
/** ARENA4b: the stands' door now (the last draw's `cheer`) and the window whose keys are heard while the presses stand. */
let cheerDoor = null, keyWin = null;
/** A press of the stands (1 cheer, -1 boo): the host's door, while the row stands and the allowance lets one. */
function shout(dir) {
  if (!shown?.standsReady || typeof cheerDoor !== 'function') return false;
  return cheerDoor(dir) === true;
}
/** The stands' keys: + cheers and - boos, heard only while the presses stand - never in a text field, never with a
 *  modifier or a held repeat, never a key another window already took. */
function onStandsKey(e) {
  if (!e || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const dir = STANDS_KEYS[e.code];
  if (!dir) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(String(t.tagName ?? '')))) return;
  if (shout(dir)) e.preventDefault?.();
}
/** The stands' keys heard (`on`) or let go. */
function listenKeys(on, doc) {
  const win = doc?.defaultView ?? globalThis;
  if (on && !keyWin && typeof win?.addEventListener === 'function') { keyWin = win; win.addEventListener('keydown', onStandsKey); }
  else if (!on && keyWin) { keyWin.removeEventListener?.('keydown', onStandsKey); keyWin = null; }
}

function build(doc) {
  if (doc.getElementById && !doc.getElementById(ARENA_HUD_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = ARENA_HUD_STYLE_ID;
    st.textContent = ARENA_HUD_CSS;
    (doc.head ?? doc.body)?.append(st);
  }
  const part = (tag, cls, text = '') => { const n = doc.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
  root = part('div', 'arena-hud');
  root.setAttribute('aria-hidden', 'true');   // a readout over the world: the Herald's lines say what it shows
  const plate = part('div', 'arena-plate');
  const row = part('div', 'arena-row');
  const sideOf = (cls) => {
    const side = part('div', `arena-side ${cls}`);
    const rows = [];
    for (let i = 0; i < HUD_ROWS_MAX; i++) {
      const r = part('div', 'arena-ftr');
      const head = part('div', 'arena-ftr-head');
      const name = part('span', 'arena-ftr-name'), tag = part('span', 'arena-tag'), out = part('span', 'arena-out');
      const team = part('span', 'arena-team');   // ARENA3: the banner's pennant
      head.append(team, name, tag, out);
      const track = part('div', 'arena-track'), fill = part('div', 'arena-fill');
      track.append(fill);
      r.append(head, track);
      r.style.display = 'none';
      side.append(r);
      rows.push({ r, name, tag, out, fill, team });
    }
    return { side, rows };
  };
  const L = sideOf('left'), R = sideOf('right');
  const mid = part('div', 'arena-mid');
  const timer = part('div', 'arena-timer'), vs = part('div', 'arena-vs', 'vs');
  mid.append(timer, vs);
  row.append(L.side, mid, R.side);
  const stam = part('div', 'arena-stam');
  const stamTrack = part('div', 'arena-track'), stamFill = part('div', 'arena-fill');
  stamTrack.append(stamFill);
  stam.append(part('span', 'arena-stam-label', ARENA_TEXT.hud.stamina), stamTrack);
  const crowd = part('div', 'arena-crowd');
  const crowdTrack = part('div', 'arena-track'), crowdFill = part('div', 'arena-fill'), crowdMid = part('div', 'arena-crowd-mid');
  crowdTrack.append(crowdFill, crowdMid);
  const word = part('span', 'arena-crowd-word');
  crowd.append(part('span', 'arena-crowd-label', ARENA_TEXT.hud.crowd), crowdTrack, word);
  const bark = part('div', 'arena-bark');
  const hint = part('div', 'arena-hint');
  plate.append(row, stam, crowd);   // the fight, my stamina and the crowd on one plate
  // ARENA4b: THE STANDS' PRESSES - built hidden, shown only while I watch a relay's bout; the readout's parts carry their
  // own aria-hidden, so while the row stands (the root's lifted) the presses are the one part a screen reader meets
  const stands = part('div', 'arena-stands');
  stands.style.display = 'none';
  const swallow = (e) => { e?.stopPropagation?.(); };   // a press on the row is the row's - never a swing, never the pointer's lock
  stands.onpointerdown = swallow; stands.onmousedown = swallow; stands.ontouchstart = swallow; stands.oncontextmenu = swallow;
  const press = (dir, kind) => {
    const b = part('button', 'arena-shout');
    b.setAttribute('type', 'button');
    b.dataset.shout = kind;
    const said = part('span', 'arena-shout-word'), key = part('span', 'arena-key');
    key.setAttribute('aria-hidden', 'true');
    b.append(said, key);
    b.onclick = (e) => { e?.stopPropagation?.(); shout(dir); };
    stands.append(b);
    return { b, said, key };
  };
  const cheer = press(1, 'cheer'), boo = press(-1, 'boo');
  for (const n of [plate, bark, hint]) n.setAttribute('aria-hidden', 'true');
  root.append(plate, bark, hint, stands);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { L: L.rows, R: R.rows, timer, stam, stamFill, crowd, crowdFill, word, bark, hint, stands, cheer, boo };
  shown = fresh();
}

/** ARENA4b: the stands' row for `m` (null: not in the stands of a relay's bout, or no door handed) - written on change. */
function writeStands(m, door) {
  cheerDoor = m ? door : null;
  shown.standsReady = !!m?.ready;
  const key = m ? `${m.cheer}|${m.boo}|${m.cheerKey}|${m.booKey}|${m.ready}` : '';
  if (key === shown.stands) return;
  const was = shown.stands;
  shown.stands = key;
  if (!m) { parts.stands.style.display = 'none'; root.setAttribute('aria-hidden', 'true'); return; }
  if (!was) { parts.stands.style.display = ''; root.removeAttribute('aria-hidden'); }
  for (const [p, said, k, code] of [[parts.cheer, m.cheer, m.cheerKey, '='], [parts.boo, m.boo, m.booKey, '-']]) {
    if (p.said.textContent !== said) p.said.textContent = said;
    if (p.key.textContent !== k) p.key.textContent = k;
    p.b.setAttribute('aria-label', `${said} (${k})`);
    p.b.setAttribute('aria-keyshortcuts', code);
    if (m.ready) p.b.removeAttribute('disabled'); else p.b.setAttribute('disabled', '');
  }
}

function writeRows(list, rows, was) {
  rows.forEach((p, i) => {
    const m = list[i] ?? null;
    const key = m ? `${m.id}|${m.name}|${m.frac}|${m.out}|${m.you}|${m.tag}|${m.banner}|${m.team ?? ''}` : '';
    if (was[i] === key) return;
    was[i] = key;
    if (!m) { p.r.style.display = 'none'; return; }
    p.r.style.display = '';
    p.r.dataset.you = m.you ? '1' : '0';
    p.r.dataset.out = m.out;
    p.r.dataset.banner = m.banner;
    p.r.dataset.team = m.team ?? '';
    p.team.dataset.team = m.team ?? '';
    if (p.name.textContent !== m.name) p.name.textContent = m.name;
    if (p.tag.textContent !== m.tag) p.tag.textContent = m.tag;
    p.tag.dataset.tag = m.tag ? (m.tag === ARENA_TEXT.hud.darling ? 'darling' : 'villain') : '';
    if (p.out.textContent !== m.out) p.out.textContent = m.out;
    p.fill.style.width = `${(m.frac * 100).toFixed(1)}%`;
  });
}

/** Draw the HUD for a model (null hides it); `hidden` the HUD's own hide, `touch` a touch screen's sizes. ARENA4b:
 *  `cheer` the stands' door (`(dir) => boolean`, 1 cheer, -1 boo - scenes/arenaBouts.js), the presses drawn while the
 *  model carries `stands` and a door is handed. */
export function drawArenaHud(model, { hidden = false, touch = false, doc = globalThis.document, cheer = null } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  const standing = want && !!model?.stands && typeof cheer === 'function';
  writeStands(standing ? model.stands : null, cheer);
  listenKeys(standing, doc);
  if (!want || !model) return;
  if (touch !== shown.touch) { shown.touch = touch; root.classList.toggle('touch', !!touch); }
  writeRows(model.left, parts.L, shown.rows.left);
  writeRows(model.right, parts.R, shown.rows.right);
  if (model.timer !== shown.timer) { shown.timer = model.timer; parts.timer.textContent = model.timer; }
  const st = model.stamina == null ? -1 : model.stamina;
  if (st !== shown.stam) {
    shown.stam = st;
    parts.stam.style.display = st < 0 ? 'none' : '';
    if (st >= 0) parts.stamFill.style.width = `${(st * 100).toFixed(1)}%`;
  }
  const cf = model.crowd ? model.crowd.frac : -2;
  if (cf !== shown.crowd) {
    shown.crowd = cf;
    parts.crowd.style.display = model.crowd ? '' : 'none';   // ARENA-FIX 4: no crowd, no meter
    if (model.crowd) parts.crowdFill.style.width = `${(model.crowd.frac * 100).toFixed(1)}%`;
  }
  if (model.crowd && model.crowd.word !== shown.word) { shown.word = model.crowd.word; parts.word.textContent = model.crowd.word; parts.word.dataset.band = model.crowd.band; }
  if (model.bark !== shown.bark) { shown.bark = model.bark; parts.bark.textContent = model.bark; }
  if (model.hint !== shown.hint) { shown.hint = model.hint; parts.hint.textContent = model.hint; }
}

/** The page is going (a test's reset): the node leaves with it, and the stands' keys. */
export function destroyArenaHud() {
  listenKeys(false, null);
  root?.remove?.();
  root = null; parts = null; shown = null; cheerDoor = null;
}
