// @ts-check
// GATE-UX (2026-10-01, Mac: "Develop a detailed damage chart after the boss kill, showing and ranking everyone's
// damage"): THE DAMAGE CHART - once the Warden has fallen, every challenger who had a part in the fight, ranked by what
// they dealt: their name and level, a bar of their damage against the most anyone dealt, the number, their share of the
// court's whole, the blows they landed on him and the heaviest of them, what went into the crystals of Oblivion, and how
// many times they fell. The relay makes it at the kill (net/gateBrain.js damageChart - every number is its own count,
// never a screen's) and says it with the fall (`fell.dm`); a relay that says none shows none.
//
// A READOUT, NOT A WINDOW (the bar's and the marks' card's law, ui/gateBossBar.js, ui/gateMarksView.js): no click, no
// overlay stack, no key taken - a fighter going for their spoils is never held by it. To the side of the screen (the
// marks' card's own place, gone by the fall - never the middle: GATE-UX's first ask), from a beat after the fall for
// DAMAGE_CHART_MS, the last DAMAGE_CHART_FADE_MS a fade; hidden with the HUD and under the step's fire. One node made on
// the first chart and UPDATED, NOT REBUILT: the rows written only when the chart they show changes.
//
// The first DAMAGE_CHART_ROWS are shown; when I am further down, my own row is shown under them at my rank, and the
// fighters not shown are counted. `damageChartModel` is pure - the pins' door.
//
// GATE-HEAL (2026-10-01, Mac: "Can we add a line on the damage round up showing the amount healed?" - each challenger's;
// "Like for healers" - allies only): a Healed column, last, whenever anyone in the court healed another - what each
// challenger healed in others (net/gateBrain.js applyHeal: each one healed says it, the caster is credited); on a narrow
// screen it takes the share's place. The ranking is the damage's still.
//
// Not a DFU member. Ledger A (WB).
import { injectEnhancedFonts } from './enhancedStyle.js';   // WB13c: the classic face, loaded by the gate's own screens

/** The chart stands from this long after the fall was first seen on this screen (his body's fall and the spoils' burst
 *  first), for DAMAGE_CHART_MS, fading out over its last DAMAGE_CHART_FADE_MS. */
export const DAMAGE_CHART_DELAY_MS = 1500;
export const DAMAGE_CHART_MS = 60_000;
export const DAMAGE_CHART_FADE_MS = 1000;
/** The rows shown before the rest are counted (my own row is shown under them when I am further down). */
export const DAMAGE_CHART_ROWS = 10;
/** WB13c: the rows come in one after another, CHART_ROW_STEP_MS apart, each bar growing over CHART_FILL_MS; the chart
 *  is ENTERING for CHART_IN_MS (a class, gone after - so the HUD shown again never plays it twice). */
export const CHART_ROW_STEP_MS = 40;
export const CHART_FILL_MS = 600;
export const CHART_IN_MS = (DAMAGE_CHART_ROWS + 3) * CHART_ROW_STEP_MS + CHART_FILL_MS;

/** The words. */
export const DAMAGE_CHART_TEXT = Object.freeze({
  title: 'Damage Dealt',
  sub: (boss, n) => `${boss} has fallen - ${n} ${n === 1 ? 'challenger' : 'challengers'}`,
  head: Object.freeze(['#', 'Challenger', 'Damage', 'Share', 'Blows', 'Best', 'Crystals', 'Falls']),
  host: 'Host',   // WB11c: the column of his host's share - a Legion-Lord's court's alone
  heal: 'Healed',   // GATE-HEAL: the column of what each healed in others - a court someone healed another in alone
  level: (lv) => `Lv ${lv}`,
  you: '(you)',
  more: (k) => `and ${k} more`,
});

/** A whole number as the chart says it: "12,480". Pure. */
export const chartNumber = (v) => String(Math.max(0, Math.round(Number(v) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** A share as the chart says it: "34%", "<1%" for a part under one, "0%" for none. Pure. */
export const chartShare = (part, whole) => {
  if (!(whole > 0) || !(part > 0)) return '0%';
  const p = (part / whole) * 100;
  return p < 1 ? '<1%' : `${Math.round(p)}%`;
};
const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== '';

/**
 * What the chart shows now, or null (nothing to show). `fell` the court's fall (net/gateLink.js - its `dm` the relay's
 * chart, its `n` the fighters the fight held), `boss` his name, `me` my name on the relay (net/online.js `name`), `since`
 * when this screen first saw the fall and `now`, on one clock. Each row: its rank, name, level, damage (and the bar's
 * share of the most anyone dealt), share of the whole, blows, best, crystals, falls, and whether it is mine. WB11c: under
 * the Legion-Lord (a row carries `a`), `hosted` and each row's share of his host, a column after the falls. GATE-HEAL:
 * where anyone healed another (a row carries `hl`), `healed` and what each row healed in others, the last column.
 * WB13c: `entering` its first CHART_IN_MS. AUDIT SD II (L6 F11): `crystals` the crystals column's head (the Hour's
 * Hearts), `theme` a look of the chart's own (`brass`, the Hour's). Pure.
 * @param {any} fell @param {{ boss?: string, me?: string|null, since?: number, now?: number, crystals?: string, theme?: string|null }} [o]
 */
export function damageChartModel(fell, { boss = 'The Warden', me = null, since = 0, now = 0, crystals = DAMAGE_CHART_TEXT.head[6], theme = null } = {}) {
  const dm = Array.isArray(fell?.dm) ? fell.dm : null;
  if (!dm || !dm.length) return null;
  const age = now - since;
  if (!(age >= DAMAGE_CHART_DELAY_MS) || age >= DAMAGE_CHART_DELAY_MS + DAMAGE_CHART_MS) return null;
  const shown = age - DAMAGE_CHART_DELAY_MS;
  const alpha = Math.min(1, shown / 250, (DAMAGE_CHART_MS - shown) / DAMAGE_CHART_FADE_MS);
  const whole = dm.reduce((s, r) => s + (r.d > 0 ? r.d : 0), 0), most = dm[0].d > 0 ? dm[0].d : 0;
  const hosted = dm.some((r) => r.a !== undefined);   // WB11c: his host stood in this court
  const healed = dm.some((r) => r.hl !== undefined);   // GATE-HEAL: someone healed another in it
  const row = (r, i) => ({
    rank: i + 1, name: r.n, level: DAMAGE_CHART_TEXT.level(r.l), damage: chartNumber(r.d), frac: most > 0 ? Math.max(0, Math.min(1, r.d / most)) : 0,
    share: chartShare(r.d, whole), blows: chartNumber(r.h), best: chartNumber(r.b), crystals: chartNumber(r.x), falls: chartNumber(r.f), mine: sameName(r.n, me),
    ...(hosted ? { host: chartNumber(r.a ?? 0) } : {}),
    ...(healed ? { heal: chartNumber(r.hl ?? 0) } : {}),
  });
  const rows = dm.slice(0, DAMAGE_CHART_ROWS).map(row);
  const at = dm.findIndex((r) => sameName(r.n, me));
  const mine = at >= DAMAGE_CHART_ROWS ? row(dm[at], at) : null;
  const n = Math.max(Number.isSafeInteger(fell.n) ? fell.n : 0, dm.length);
  const more = n - rows.length - (mine ? 1 : 0);
  return {
    key: `${crystals}:${dm.length}:${dm.map((r) => `${r.n}|${r.l}|${r.d}|${r.x}|${r.h}|${r.b}|${r.f}|${r.a ?? ''}|${r.hl ?? ''}`).join(';')}:${at}:${n}`,
    alpha: Math.round(alpha * 100) / 100, entering: shown < CHART_IN_MS,
    title: DAMAGE_CHART_TEXT.title, sub: DAMAGE_CHART_TEXT.sub(boss, n), hosted, healed,
    head: ((h) => (healed ? [...h, hosted ? DAMAGE_CHART_TEXT.host : '', DAMAGE_CHART_TEXT.heal] : hosted ? [...h, DAMAGE_CHART_TEXT.host] : h))(crystals === DAMAGE_CHART_TEXT.head[6] ? DAMAGE_CHART_TEXT.head : DAMAGE_CHART_TEXT.head.map((c, i) => (i === 6 ? crystals : c))),
    theme: typeof theme === 'string' && /^[a-z]+$/.test(theme) ? theme : null,   // AUDIT SD II (L6 F11): a fight's own palette - the Brass Remnant's
    rows, mine, more: more > 0 ? DAMAGE_CHART_TEXT.more(more) : '',
  };
}

/** PLUS-DRESS's law: the chart's look as classes, so a skin's sheet can dress it (ui/enhancedPlusStyle.js). One hue for
 *  the bars (the court's fire, the bar's own); my row says itself in words as well as in its ring. */
export const DAMAGE_CHART_STYLE_ID = 'dagger-gate-damage-style';
export const DAMAGE_CHART_CSS = `
.wb-dmg-chart { position: fixed; right: 18px; bottom: max(96px, 14vh); z-index: 31; pointer-events: none; box-sizing: border-box;
  width: 540px; max-width: calc(100vw - 32px); padding: 10px 14px 9px; font: 600 13px 'Cormorant', Georgia, serif; letter-spacing: 0.03em;
  color: #f3d9c4; background: linear-gradient(180deg, rgba(34,6,3,0.93), rgba(14,3,2,0.9)); border: 1px solid rgba(255,120,60,0.6);
  box-shadow: 0 0 22px rgba(0,0,0,0.85), inset 0 0 18px rgba(120,20,6,0.45); text-shadow: 0 0 3px #000; font-variant-numeric: lining-nums tabular-nums; }
/* AUDIT SD IV (T4): the message line over the chart while it stands - the collapse's first readout and the way home's
   word stood under its corner on a phone and on a laptop, its sixty seconds after the kill (gateMarksView.js's own rule) */
body:has(.wb-dmg-chart:not([style*="display: none"])) .hudmid { z-index: 32; }
.wb-dmg-title { font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #ff8a4a; text-align: center; }
.wb-dmg-sub { font-size: 15px; text-align: center; margin: 1px 0 7px; color: #ffe2c8; }
.wb-dmg-row { display: grid; grid-template-columns: 20px minmax(0, 1fr) 60px 46px 46px 44px 62px 42px; column-gap: 6px; align-items: center;
  padding: 2px 4px; min-height: 22px; }
.wb-dmg-head { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #c9a78a; min-height: 14px; padding-bottom: 3px;
  border-bottom: 1px solid rgba(255,120,60,0.3); margin-bottom: 2px; }
.wb-dmg-row > div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
.wb-dmg-row > .wb-dmg-rank { text-align: center; color: #c9a78a; }
.wb-dmg-row > .wb-dmg-who { text-align: left; }
.wb-dmg-line { display: flex; align-items: baseline; min-width: 0; }
.wb-dmg-name { font-size: 13px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-dmg-lv { flex: none; font-size: 10.5px; opacity: 0.75; margin-left: 5px; font-weight: 500; }
.wb-dmg-you { flex: none; font-size: 10.5px; color: #ffd27a; margin-left: 5px; }
.wb-dmg-you:empty { display: none; }
.wb-dmg-track { height: 4px; margin-top: 2px; background: rgba(255,255,255,0.08); border-radius: 0 2px 2px 0; }
.wb-dmg-fill { height: 100%; width: 0; background: #ff7a3a; border-radius: 0 2px 2px 0; }
.wb-dmg-num { font-size: 12.5px; }
.wb-dmg-mine { outline: 1px solid rgba(255,210,122,0.75); background: rgba(255,190,90,0.10); }
/* AUDIT SD II (L6 F11): the Brass Remnant's chart in the Hour's brass, not Dagon's fire */
.wb-dmg-chart.wb-dmg-brass { color: #f2e6c8; background: linear-gradient(180deg, rgba(30,22,6,0.93), rgba(12,9,3,0.9)); border-color: rgba(230,190,90,0.6); }
.wb-dmg-chart.wb-dmg-brass .wb-dmg-title { color: #f0c060; }
.wb-dmg-chart.wb-dmg-brass .wb-dmg-fill { background: #e8b84a; }
.wb-dmg-gap { height: 6px; }
.wb-dmg-more { font-size: 11px; text-align: center; opacity: 0.8; margin-top: 4px; font-style: italic; }
.wb-dmg-row > .wb-dmg-host { display: none; }
.wb-dmg-chart.wb-dmg-hosted { width: 590px; }
.wb-dmg-hosted .wb-dmg-row { grid-template-columns: 20px minmax(0, 1fr) 60px 46px 46px 44px 62px 42px 46px; }
.wb-dmg-hosted .wb-dmg-row > .wb-dmg-host { display: block; }
.wb-dmg-row > .wb-dmg-heal { display: none; }
.wb-dmg-chart.wb-dmg-healed { width: 596px; }
.wb-dmg-healed .wb-dmg-row { grid-template-columns: 20px minmax(0, 1fr) 60px 46px 46px 44px 62px 42px 56px; }
.wb-dmg-chart.wb-dmg-hosted.wb-dmg-healed { width: 646px; }
.wb-dmg-hosted.wb-dmg-healed .wb-dmg-row { grid-template-columns: 20px minmax(0, 1fr) 60px 46px 46px 44px 62px 42px 46px 56px; }
.wb-dmg-healed .wb-dmg-row > .wb-dmg-heal { display: block; }
/* WB13c: THE ENTRANCE - row after row, each bar growing from nothing */
.wb-dmg-in .wb-dmg-row:not(.wb-dmg-head), .wb-dmg-in .wb-dmg-more { animation: wb-dmg-row-in 220ms ease-out both; }
.wb-dmg-in .wb-dmg-fill { transform-origin: left center; animation: wb-dmg-fill-in ${CHART_FILL_MS}ms cubic-bezier(.2,.7,.3,1) both; }
${Array.from({ length: DAMAGE_CHART_ROWS + 3 }, (_, i) => `.wb-dmg-in > :nth-child(${i + 4}), .wb-dmg-in > :nth-child(${i + 4}) .wb-dmg-fill { animation-delay: ${i * CHART_ROW_STEP_MS}ms; }`).join('\n')}
@keyframes wb-dmg-row-in { from { opacity: 0; transform: translateX(10px); } }
@keyframes wb-dmg-fill-in { from { transform: scaleX(0); } }
/* WB13c: beside the party's frames where the screen holds both, never over them */
@media (min-width: 900px) {
  body:has(.dfparty:not([style*="display: none"])) .wb-dmg-chart { right: 220px; }
}
/* WB13c: on a phone held upright the party's frames hold the foot on the right - with them up, the chart stands where
   his bar was */
@media (max-width: 560px) {
  body:has(.dfparty:not([style*="display: none"])) .wb-dmg-chart { top: 72px; bottom: auto; }
}
/* WB13c: Blows and Best fold away under 1000px (ten columns at 9px in the Plus face) */
@media (max-width: 1000px) {
  .wb-dmg-chart { width: 440px; }
  .wb-dmg-row { grid-template-columns: 20px minmax(0, 1fr) 60px 46px 62px 42px; }
  .wb-dmg-row > .wb-dmg-blows, .wb-dmg-row > .wb-dmg-best { display: none; }
  .wb-dmg-chart.wb-dmg-hosted { width: 490px; }
  .wb-dmg-hosted .wb-dmg-row { grid-template-columns: 20px minmax(0, 1fr) 60px 46px 62px 42px 46px; }
  .wb-dmg-chart.wb-dmg-healed { width: 496px; }
  .wb-dmg-healed .wb-dmg-row { grid-template-columns: 20px minmax(0, 1fr) 60px 46px 62px 42px 56px; }
  .wb-dmg-chart.wb-dmg-hosted.wb-dmg-healed { width: 546px; }
  .wb-dmg-hosted.wb-dmg-healed .wb-dmg-row { grid-template-columns: 20px minmax(0, 1fr) 60px 46px 62px 42px 46px 56px; }
}
/* WB13c: a phone held sideways is narrow too - 844 wide, it had the desk's grid */
@media (max-width: 640px), (max-height: 480px) {
  .wb-dmg-chart { width: 340px; }
  .wb-dmg-row { grid-template-columns: 18px minmax(0, 1fr) 58px 44px 40px; }
  .wb-dmg-row > .wb-dmg-blows, .wb-dmg-row > .wb-dmg-best, .wb-dmg-row > .wb-dmg-cx { display: none; }
  .wb-dmg-chart.wb-dmg-hosted { width: 340px; }
  /* AUDIT WB11 C9/U5: a Legion-Lord night's chart keeps its Host column on a narrow screen, in the place of the falls
     (it folded away whole, and the patch's word was a Host column on those nights) - wider than the falls', for a
     host's five figures in the pixel face */
  .wb-dmg-hosted .wb-dmg-row { grid-template-columns: 18px minmax(0, 1fr) 58px 44px 50px; }
  .wb-dmg-hosted .wb-dmg-row > .wb-dmg-falls { display: none; }
  .wb-dmg-hosted .wb-dmg-row > .wb-dmg-host { display: block; }
  /* GATE-HEAL: what each healed keeps its column on a narrow screen too, in the share's place - as wide as the damage's
     (six figures in the Plus skin's pixel face) */
  .wb-dmg-chart.wb-dmg-healed, .wb-dmg-chart.wb-dmg-hosted.wb-dmg-healed { width: 340px; }
  .wb-dmg-healed .wb-dmg-row { grid-template-columns: 18px minmax(0, 1fr) 58px 40px 58px; }
  .wb-dmg-hosted.wb-dmg-healed .wb-dmg-row { grid-template-columns: 18px minmax(0, 1fr) 58px 50px 58px; }
  .wb-dmg-healed .wb-dmg-row > .wb-dmg-share { display: none; }
  .wb-dmg-healed .wb-dmg-row > .wb-dmg-heal { display: block; }
}
/* WB13c: a phone held sideways: on the left under the menu's button - his bar gone by now, clear of the crosshair and
   the party - never off the screen; the rows closer */
@media (max-height: 480px) {
  .wb-dmg-chart { left: 8px; right: auto; top: 72px; bottom: auto; max-height: calc(100vh - 80px); overflow: hidden; padding: 6px 10px 5px; }
  .wb-dmg-sub { margin: 0 0 4px; }
  .wb-dmg-row { min-height: 17px; padding: 0 4px; }
}
`;

/** The cells of a row, in the head's order (the rank, the challenger, then the numbers) - WB11c: the host's, shown only
 *  for a court his host stood in; GATE-HEAL: the healed, last, shown only for a court someone healed in. */
const CELLS = Object.freeze(['rank', 'who', 'damage', 'share', 'blows', 'best', 'cx', 'falls', 'host', 'heal']);

let root = null, parts = null;
let shown = { vis: '', key: '', alpha: -1, sub: '' };

function div(doc, cls) { const n = doc.createElement('div'); n.className = cls; return n; }

function rowNodes(doc, head) {
  const n = div(doc, head ? 'wb-dmg-row wb-dmg-head' : 'wb-dmg-row');
  const cells = CELLS.map((c) => div(doc, `wb-dmg-${c}`));
  n.append(...cells);
  if (head) return { n, cells };
  const who = cells[1];
  const line = div(doc, 'wb-dmg-line'), name = doc.createElement('span'), lv = doc.createElement('span'), you = doc.createElement('span');
  name.className = 'wb-dmg-name'; lv.className = 'wb-dmg-lv'; you.className = 'wb-dmg-you';
  line.append(name, lv, you);
  const track = div(doc, 'wb-dmg-track'), fill = div(doc, 'wb-dmg-fill');
  track.append(fill);
  who.append(line, track);
  cells[2].className += ' wb-dmg-num';
  return { n, cells, name, lv, you, fill };
}

function build(doc) {
  if (doc.getElementById && !doc.getElementById(DAMAGE_CHART_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = DAMAGE_CHART_STYLE_ID;
    st.textContent = DAMAGE_CHART_CSS;
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);   // WB13c: Cormorant on the classic skin too (it came only if another window had asked)
  }
  root = div(doc, 'wb-dmg-chart');
  root.setAttribute?.('aria-hidden', 'true');   // a readout over the game: the chat says the kill
  const title = div(doc, 'wb-dmg-title'), sub = div(doc, 'wb-dmg-sub');
  const head = rowNodes(doc, true);
  const rows = Array.from({ length: DAMAGE_CHART_ROWS }, () => rowNodes(doc, false));
  const gap = div(doc, 'wb-dmg-gap');
  const mine = rowNodes(doc, false);
  const more = div(doc, 'wb-dmg-more');
  root.append(title, sub, head.n, ...rows.map((r) => r.n), gap, mine.n, more);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { title, sub, head, rows, gap, mine, more };
}

/** Write one row - a fighter's rank, name, level, bar and numbers - or hide it (no fighter for it). */
function writeRow(r, m) {
  if (!m) { r.n.style.display = 'none'; return; }
  r.n.style.display = '';
  r.n.className = m.mine ? 'wb-dmg-row wb-dmg-mine' : 'wb-dmg-row';
  r.cells[0].textContent = String(m.rank);
  r.name.textContent = m.name;
  r.lv.textContent = m.level;
  r.you.textContent = m.mine ? DAMAGE_CHART_TEXT.you : '';
  r.fill.style.width = `${(m.frac * 100).toFixed(1)}%`;
  r.cells[2].textContent = m.damage;
  r.cells[3].textContent = m.share;
  r.cells[4].textContent = m.blows;
  r.cells[5].textContent = m.best;
  r.cells[6].textContent = m.crystals;
  r.cells[7].textContent = m.falls;
  r.cells[8].textContent = m.host ?? '';   // WB11c
  r.cells[9].textContent = m.heal ?? '';   // GATE-HEAL
}

/** Draw the chart for a model (null hides it); `hidden` is the HUD's own hide. */
export function drawGateDamageChart(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  if (!want || !model) return;
  // WB11c: the host's column shown or not; GATE-HEAL: the healed; WB13c: entering
  const cls = `wb-dmg-chart${model.hosted ? ' wb-dmg-hosted' : ''}${model.healed ? ' wb-dmg-healed' : ''}${model.entering ? ' wb-dmg-in' : ''}${model.theme ? ` wb-dmg-${model.theme}` : ''}`;
  if (root.className !== cls) root.className = cls;
  if (model.key !== shown.key) {
    shown.key = model.key;
    parts.title.textContent = model.title;
    parts.head.cells.forEach((c, i) => { c.textContent = model.head[i] ?? ''; });
    parts.rows.forEach((r, i) => writeRow(r, model.rows[i] ?? null));
    parts.gap.style.display = model.mine ? '' : 'none';
    writeRow(parts.mine, model.mine);
    parts.more.textContent = model.more;
    parts.more.style.display = model.more ? '' : 'none';
  }
  if (model.sub !== shown.sub) { shown.sub = model.sub; parts.sub.textContent = model.sub; }
  if (model.alpha !== shown.alpha) { shown.alpha = model.alpha; root.style.opacity = String(model.alpha); }
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroyGateDamageChart() {
  root?.remove?.();
  root = null; parts = null;
  shown = { vis: '', key: '', alpha: -1, sub: '' };
}
