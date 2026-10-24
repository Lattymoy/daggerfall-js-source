// EG-G1 (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 27 and 25.7): THE HUD, THE
// BEATS AND THE FIRST BREACH - the Spire's HUD by form factor (ui/eliteGates/egSpireHud.js), THE COUNT CHIP, the arrival card, the
// objective and the door; the party rows (ui/eliteGates/egParty.js, ui/partyPanel.js's `setSpire`); every event seen, heard and said
// (ui/eliteGates/egBeats.js EG_BEATS); THE RECAP whole (ui/eliteGates/egHud.js); the first breach's lines and the Rehearsal's; touch and the
// pad; the danger palette, the fill and reduced motion (ui/eliteGates/egAccess.js) - each pure model pinned, the drawing run against
// a fake document, and the client (scenes/eliteGates/egClient.js) played against the director's own words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  egFormFactor, EG_LAYOUTS, EG_FORM_FACTORS, egCountChip, egHoldWhy, egGainText, egChipWarnings, egCourtNeedMs, EG_HALL_REF_MS, EG_COURT_APPROACH_MS, EG_CHIP_GLYPHS, EG_HOLD_WORDS,
  egArrivalCard, egArrivalShown, EG_CARD_MS, egDoorMarker, egLordBar, egSpireHudModel, drawEgSpireHud, drawEgArrivalCard, destroyEgSpireHud, egTouchButtons, egPadAct, egPadPrompts, egPadUp,
  EG_PAD_DIRS, EG_CLASSIC_TEXT_CSS, EG_CLASSIC_SHADOW_CSS, EG_SPIRE_CSS,
} from '../../../src/ui/eliteGates/egSpireHud.js';
import { EG_BEATS, EG_BEAT_KEYS, EG_BEAT_SOUNDS, egRuneChime, egBeatPlan, egBeatMemo, egBeatWatch, EG_TEXT_FIRST, EG_FIRST_KEYS, egFirstDue, egRehearsalDue, egFirstRead, egFirstKey, EG_FIRST_KEY, EG_PRES_TEXT, EG_HAPTICS, egBuzz, egBeatUnder, egPerilsNew, EG_BEAT_WARN_S } from '../../../src/ui/eliteGates/egBeats.js';
import { egAbsentStep, egPartyRows, egPartyDeco, egRoadOf, EG_NUMERALS } from '../../../src/ui/eliteGates/egParty.js';
import { EG_DANGER_PALETTES, EG_DANGER_PALETTE_KEYS, egCvdDistance, egReducedMotion, egFillOf } from '../../../src/ui/eliteGates/egAccess.js';
import { egRecapModel, egRecapKeep, egRecapsKept, EG_RECAPS_KEPT, drawEgPanel, egPanelModel } from '../../../src/ui/eliteGates/egHud.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { EG_SAY, egLookShapes } from '../../../src/scenes/eliteGates/egFight.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, egCountText, EG_TEXT, EG_SEALED_MS, EG_LAST_WORD_MS, EG_ABSENT_TRIAL_MS, EG_TWIST_LINES, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { EG_V_BY_KEY } from '../../../src/net/eliteGates/egVestige.js';
import { egTtkRef, EG_OBJ } from '../../../src/net/eliteGates/egLords.js';
import { EG_BEAT_CYCLE_S, EG_BEAT_SOLID_S } from '../../../src/net/eliteGates/egSpanLaw.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { TELEGRAPH_EDGE_DAGON, TELEGRAPH_EDGE_SAFE } from '../../../src/render/gate/gateTelegraph.js';
import { DEFAULT_TEXT_COLOR, DEFAULT_SHADOW_COLOR } from '../../../src/ui/native/nativePanel.js';
import { whereIs } from '../../../src/ui/settings/settingsMap.js';
import { PREF_DEFAULTS, setPref } from '../../../src/systems/uiPrefs.js';
import { SocialState } from '../../../src/net/social.js';
import { createPartyPanel } from '../../../src/ui/partyPanel.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const ME = 'acct-0';
const B = '0123456789abcdef';

// ── a fake document (party8b's shape, with the DOM calls the HUD makes) ───────────────────────────────────────
function fakeDocument() {
  const doc = { writes: 0 };
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, id: '', _text: '', _cls: '' };
    n.style = { _p: {}, setProperty(k, v) { this._p[k] = String(v); }, getPropertyValue(k) { return this._p[k] ?? ''; } };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); doc.writes++; } });
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = String(v); doc.writes++; } });
    Object.defineProperty(n, 'parentNode', { get: () => n.parent });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.insertBefore = (c, ref) => { c.parent = n; const i = n.children.indexOf(ref); if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); };
    n.replaceChildren = (...cs) => { n.children = []; n.append(...cs); };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); doc.writes++; };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.click = () => { for (const fn of n.listeners.click ?? []) fn(); };
    n.querySelectorAll = (sel) => { const m = /^\[([a-z-]+)\]$/.exec(sel); const out = []; const walk = (x) => { for (const c of x.children) { if (m && c.attrs[m[1]] != null) out.push(c); walk(c); } }; walk(n); return out; };
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0] ?? null;

/** A breach's state as the link holds it, at hall `h`'s `sg`, the count `cl` running from `ca`. */
const stateAt = (over = {}) => ({ ...EG_STATE_EMPTY, b: B, seed: 77, op: T0, wk: T0 + 1000, h: 3, sg: 'trial', cl: 20 * 60_000, ca: T0 + 60_000, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1], ['acct-1', 'Ann', 2, 1, 0, 1, 0, 0, 0, 1]], ...over });

/** A client inside a breach of two, its words the director's own (test/net/eliteGates/egfull_client.test.js's harness), with an audio
 *  stub, a store and a fake window. */
function inBreach({ h = 2, sg = 'trial', seed = 77, store = null, win = null } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  Br.h = h; Br.sg = sg; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 };
  const sent = [], said = [], mids = [], played = [];
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => Br.b, egHallCircle: () => Math.ceil(h / 5), egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  let peers = [];
  const mem = new Map();
  const st = store ?? { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); } };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => { entity.health -= n; }, peers: () => peers, store: st,
    audio: { playOneShot: (rec, vol, pitch) => played.push({ rec, vol, pitch }) }, win: win ?? { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(Br, clock));
  const spec = egHallOf(seed, h, 0);
  if (spec.arrive) player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, B: Br, entity, player, sent, said, mids, played, tell, spec, store: st, step: (ms) => { clock += ms; }, now: () => clock, setPeers: (p) => { peers = p; } };
}

test('EG-G1 THE LAYOUTS (section 27.1): a desk at 1280x720, a phone held upright at 390x844 and sideways at 844x390 - the desk\'s chips beside the compass with the decrees under them, the potion pip and how many stand; the upright phone one chip (the count and the Reliquaries) and its decrees folded to *N decrees*; the sideways phone the count\'s chip and a 44 px lord\'s bar, its decrees on the arrival card; every part at the HUD\'s own scale; the classic skin in DFU\'s own text colour and shadow (mutants: the phone read as a desk; the upright decrees unfolded; the potion pip on a phone)', () => {
  assert.deepEqual([egFormFactor({ w: 1280, h: 720 }), egFormFactor({ w: 390, h: 844 }), egFormFactor({ w: 844, h: 390 })], ['desktop', 'upright', 'sideways']);
  assert.equal(egFormFactor({ w: 600, h: 900 }), 'desktop', 'a short side past 560 is no phone');
  assert.deepEqual(EG_FORM_FACTORS, ['desktop', 'upright', 'sideways']);
  assert.deepEqual(Object.fromEntries(Object.entries(EG_LAYOUTS).map(([k, L]) => [k, [L.dec, L.lordH, L.relInChip, L.potion, L.standing]])),
    { desktop: ['row', 30, false, true, true], upright: ['fold', 30, true, false, false], sideways: ['fold', 44, false, false, false] });   // PIN MOVED (AUDIT EG V, c: L7-22 - a phone held sideways folds its decrees to a press, besides each arrival card's)
  const E = stateAt({ dc: [[EG_DECREE_BY_KEY.pack.id, 1], [EG_DECREE_BY_KEY.ashfall.id, 2]], ms: [[ME, 3, 10, 0, 0, [], [], -1]] });
  const now = T0 + 120_000;
  const desk = egSpireHudModel(E, ME, now, { ff: 'desktop' }), up = egSpireHudModel(E, ME, now, { ff: 'upright' }), side = egSpireHudModel(E, ME, now, { ff: 'sideways' });
  assert.deepEqual(desk.dec, ['Hunting Pack', 'Ashfall II']);
  assert.equal(desk.decFold, '');
  assert.equal(desk.potion, '2/2');
  assert.equal(desk.standing, '2 of 2');
  assert.equal(desk.rel, 'Reliquaries 3');
  assert.equal(desk.recall, '', 'the recall in hand says nothing');
  assert.equal(egSpireHudModel({ ...E, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 1, 0], E.co[1]] }, ME, now, { ff: 'desktop' }).recall, 'Last life', 'spent: my last life on the chip');
  assert.equal(up.decFold, '2 decrees', 'folded to a press');
  assert.equal(up.relInChip, true);
  assert.equal(up.potion, '');
  assert.equal(side.decFold, '2 decrees', 'folded to a press, and on the card');   // PIN MOVED (AUDIT EG V, c: L7-22)
  assert.equal(side.lordH, 44);
  assert.equal(desk.objective, egHallOf(77, 3).objective);
  // the drawing: one root, its layout and skin its classes, the chip in place, the scale read
  destroyEgSpireHud();
  const doc = fakeDocument();
  drawEgSpireHud(up, { doc, skin: 'classic', scale: '1.5' });
  const root = one(doc.body, 'eg-spire');
  assert.ok(root, 'drawn');
  assert.match(root.className, /\bupright\b/); assert.match(root.className, /\bclassic\b/);
  assert.equal(root.style.getPropertyValue('--hud-scale'), '1.5');
  assert.match(one(root, 'eg-time').textContent, /^20:00 - R3$|^\d+:\d\d - R3$/, 'the count and the Reliquaries in one chip');
  assert.equal(one(root, 'eg-fold').textContent, '2 decrees');
  assert.equal(one(root, 'eg-dec').textContent, '', 'folded until pressed');
  drawEgSpireHud({ ...up, foldOpen: true }, { doc, skin: 'classic' });
  assert.equal(one(root, 'eg-dec').textContent, 'Hunting Pack - Ashfall II', 'pressed open');
  drawEgSpireHud(desk, { doc, skin: 'enhanced' });
  assert.match(root.className, /\bdesktop\b/); assert.match(root.className, /\benhanced\b/);
  assert.equal(EG_CLASSIC_TEXT_CSS, `rgb(${DEFAULT_TEXT_COLOR.slice(0, 3).map((v) => Math.round(v * 255)).join(', ')})`, 'DaggerfallUI.DefaultTextColor');
  assert.equal(EG_CLASSIC_SHADOW_CSS, `rgb(${DEFAULT_SHADOW_COLOR.slice(0, 3).map((v) => Math.round(v * 255)).join(', ')})`);
  assert.match(EG_SPIRE_CSS, /var\(--hud-scale, 1\)/, 'every part reads the HUD\'s scale');
  drawEgSpireHud(null, { doc });
  assert.equal(root.style.display, 'none', 'hidden, never removed');
  destroyEgSpireHud();
});

test('EG-G1 THE COUNT CHIP (section 27.2): mm:ss - gold above 10:00, white to 2:00, red below, pulsing in the last 30 s; *Held* with a pause glyph and its reason (the Redoubt, a respite, the door, the stair) while it holds; the last word\'s figure with a seal when nearer; the gains as they fly in; each warning once a count (mutants: the gold at ten minutes flat; red at two; a held count pulsing; the seal never shown; a warning said twice)', () => {
  const run = (left) => stateAt({ h: 5, cl: left, ca: T0 + 10_000 });   // in a Court: the Court's own warning out of the way
  const at = T0 + 10_000;
  assert.equal(egCountChip(run(10 * 60_000 + 1000), at).tone, 'gold');
  assert.equal(egCountChip(run(10 * 60_000), at).tone, 'white');
  assert.equal(egCountChip(run(2 * 60_000), at).tone, 'white');
  assert.equal(egCountChip(run(2 * 60_000 - 1000), at).tone, 'red');
  assert.equal(egCountChip(run(31_000), at).pulse, false);
  assert.equal(egCountChip(run(29_000), at).pulse, true);
  assert.equal(egCountChip(run(29_000), at).text, '0:29');
  const held = egCountChip(stateAt({ cl: 29_000, ca: 0, sg: 'rest' }), at);
  assert.deepEqual([held.held, held.pulse, held.why, held.glyph], [true, false, 'rest', EG_CHIP_GLYPHS.held]);
  assert.equal(EG_HOLD_WORDS.rest, 'Redoubt');
  assert.equal(egHoldWhy(stateAt({ ca: 0, sg: 'closing' }), at), 'closing');
  assert.equal(egHoldWhy(stateAt({ ca: 0, sg: 'arrive' }), at), 'stair');
  const resting = stateAt({ ca: 0, sg: 'rest', fight: { ...EG_STATE_EMPTY.fight, says: [{ w: 'respite', n: '', t: '120', at }] } });
  assert.equal(egHoldWhy(resting, at + 60_000), 'respite');
  assert.equal(egHoldWhy(resting, at + 121_000), 'rest', 'the respite spent');
  assert.equal(egHoldWhy(run(60_000), at), '', 'running');
  // the last word nearer than the count: its figure and the seal
  const late = stateAt({ cl: 20 * 60_000, ca: T0 + EG_LAST_WORD_MS - 6 * 60_000 });
  const seal = egCountChip(late, T0 + EG_LAST_WORD_MS - 5 * 60_000);
  assert.deepEqual([seal.seal, seal.text, seal.glyph], [true, '5:00', EG_CHIP_GLYPHS.seal]);
  assert.equal(egCountChip(stateAt({ end: 'tear' }), at), null);
  // the gains
  assert.equal(egGainText({ g: 15 * 60_000 }, {}), '+15:00');
  assert.equal(egGainText({ g: 10 * 60_000 }, { press: true }), "+10:00 - the Covenant's Press");
  assert.equal(egGainText({ g: 3 * 60_000 }, { leftAfter: 9 * 60_000, lastWordLeft: 9 * 60_000 }), '+3:00 - the last word');
  assert.equal(egGainText({ g: 5 * 60_000 }, { leftAfter: 30 * 60_000, lastWordLeft: 3 * 3600_000 }), '+5:00', 'the cap: the Surplus says the rest');
  assert.equal(egGainText({ g: 0, cov: 1 }, {}), null, 'the Covenant spoke: no time');
  // the warnings, once a count
  const said = new Set();
  assert.deepEqual(egChipWarnings(said, run(6 * 60_000), at), []);
  assert.deepEqual(egChipWarnings(said, run(5 * 60_000), at), ['press5']);
  assert.deepEqual(egChipWarnings(said, run(4 * 60_000), at), [], 'once');
  assert.deepEqual(egChipWarnings(said, run(60_000), at), ['toll1']);
  assert.deepEqual(egChipWarnings(said, run(15 * 60_000), at), [], 'a Redoubt raised it - never again');
  assert.deepEqual(egChipWarnings(said, run(9_000), at), ['toll10']);
  assert.deepEqual(egChipWarnings(new Set(), stateAt({ cl: 9_000, ca: 0 }), at), [], 'a held count warns of nothing');
  assert.equal(egCourtNeedMs(3), 2 * EG_HALL_REF_MS + EG_COURT_APPROACH_MS + Math.round(egTtkRef(1) * 1000));
  assert.equal(egCourtNeedMs(5), 0, 'in the Court itself');
  assert.equal(EG_HALL_REF_MS, 140_000, 'section 18\'s model: 55 s fixed, 70 s of damage, 15 s of closing counted');
  const c = new Set();
  assert.deepEqual(egChipWarnings(c, stateAt({ h: 3, cl: egCourtNeedMs(3) + 1000, ca: at }), at), []);
  assert.deepEqual(egChipWarnings(c, stateAt({ h: 3, cl: egCourtNeedMs(3) - 1000, ca: at }), at), ['court']);
  assert.deepEqual(egChipWarnings(c, stateAt({ h: 3, cl: egCourtNeedMs(3) - 2000, ca: at }), at), [], 'once');
});

test('EG-G1 THE ARRIVAL CARD, THE OBJECTIVE, THE DOOR, THE LORD\'S BAR (section 27.3): *Hall 12 - the Broken Galleries* under the hall\'s name, the objective beneath, the twist\'s line, the decrees; the band\'s card at a band\'s first hall; *Hall 15 - the Court* with the lord\'s card; it stands EG_CARD_MS on its own node in the gate card\'s sheet; the objective chip with its progress; the door\'s marker by its bearing; the lord\'s bar off its body (mutants: the band\'s card on every hall; the twist dropped; the marker on the wrong side)', () => {
  const E = stateAt({ h: 12, seed: 77, dc: [[EG_DECREE_BY_KEY.pack.id, 1]] });
  const card = egArrivalCard(E);
  const spec = egHallOf(77, 12);
  assert.equal(card.main, 'Hall 12 - the Broken Galleries');
  assert.equal(card.kicker, spec.name);
  assert.equal(card.sub, spec.objective);
  assert.equal(card.dec, 'Hunting Pack');
  assert.equal(card.band, '', 'not a band\'s first hall');
  const first = egArrivalCard(stateAt({ h: 1 }));
  assert.equal(first.kicker, 'The Broken Galleries');
  assert.equal(first.band, "The academy's upper halls, still over the Deadlands.");
  assert.equal(egArrivalCard(stateAt({ h: 26 })).main, 'Hall 26 - the Soul Cairn');
  assert.equal(egArrivalCard(stateAt({ h: 12 }), { first: true }).band.length > 0, true, 'the breach\'s own first hall');
  const court = egArrivalCard(stateAt({ h: 15 }));
  assert.equal(court.main, 'Hall 15 - the Court');
  assert.equal(court.sub, egHallOf(77, 15).name, 'the lord\'s card');
  const tw = egArrivalCard(stateAt({ seed: 1, h: 6 }));
  assert.equal(tw.twist, EG_TWIST_LINES.captive, 'the twist as a second line');
  const shown = egArrivalShown(card, 1000, 1200);
  assert.ok(shown && shown.alpha > 0 && shown.alpha < 1 && shown.fresh);
  assert.equal(egArrivalShown(card, 1000, 1000 + EG_CARD_MS), null);
  const doc = fakeDocument();
  destroyEgSpireHud();
  drawEgArrivalCard(egArrivalShown(card, 1000, 2000), { doc });
  const node = one(doc.body, 'eg-card');
  assert.ok(node && /wb-title-card/.test(node.className), 'the gate card\'s sheet, its own node');
  assert.equal(one(node, 'wb-title-main').textContent, 'Hall 12 - the Broken Galleries');
  assert.ok(doc.getElementById('dagger-gate-title-style'), 'the gate card\'s sheet injected');
  drawEgArrivalCard(egArrivalShown(card, 1000, 1200), { doc, still: true });
  assert.doesNotMatch(node.className, /\bin\b/, 'reduced motion: no rise');
  destroyEgSpireHud();
  // the objective and its progress in the model
  const yard = stateAt({ h: 1, fight: { ...EG_STATE_EMPTY.fight, h: 1, pg: { rifts: [2, 5] } } });
  const m = egSpireHudModel(yard, ME, T0 + 120_000, {});
  assert.equal(m.objective, 'Close the rifts.');
  assert.equal(m.progress, 'Rifts 3 of 5 closed');
  // the door: ahead, to the right, behind
  assert.equal(egDoorMarker({ x: 0, z: 0 }, { x: 0, z: 40 }, 0).ahead, true);
  assert.equal(egDoorMarker({ x: 0, z: 0 }, { x: 0, z: 40 }, 0).dist, 40);
  const right = egDoorMarker({ x: 0, z: 0 }, { x: 30, z: 0 }, 0);
  assert.ok(!right.ahead && right.rel > 0 && right.x > 0.9, 'on the right edge');
  const behind = egDoorMarker({ x: 0, z: 0 }, { x: 0, z: -30 }, 0);
  assert.ok(Math.abs(behind.rel) > 3 && behind.y > 0.9, 'at the foot');
  assert.ok(egDoorMarker({ x: 0, z: 0 }, { x: 30, z: 0 }, Math.PI / 2).ahead, 'turned toward it');
  // the lord's bar
  const lordState = stateAt({ h: 5, fight: { ...EG_STATE_EMPTY.fight, h: 5, bodies: [{ i: 1, role: 0, k: 0, pt: 0, hp: 250, max: 1000, fl: 0, ph: 2 }] } });
  assert.deepEqual(egLordBar(lordState), { name: 'Grath', court: true, frac: 0.25, phase: 'II', ward: false });   // PIN MOVED (FB1018D WARD-BAR): the bar says its ward
  assert.equal(egLordBar(stateAt({ h: 5, fight: { ...EG_STATE_EMPTY.fight, h: 5, bodies: [{ i: 1, role: 0, k: 0, hp: 9, max: 10, fl: 0, ph: 0 }] } })), null, 'asleep');
  assert.ok(egSpireHudModel(lordState, ME, T0 + 120_000, {}).lord, 'a Court\'s lord on the bar');
  const champ = stateAt({ h: 3, fight: { ...EG_STATE_EMPTY.fight, h: 3, bodies: [{ i: 1, role: 0, k: 13, pt: 0, hp: 5, max: 10, fl: 0, ph: 1 }] } });
  assert.equal(egSpireHudModel(champ, ME, T0 + 120_000, {}).lord, null, 'the lord\'s bar only in a Court');
});

test('EG-G1 THE PARTY ROWS (section 27.4): each member\'s numeral in Battlemage blue, a cracked sigil once their recall is spent, a witness grey with an eye, home\'s arch, the forsaken struck through, an amber ring draining the 180 s for an unseen body, their Memento, *High Road* / *Low Road* while the company is split, Fire- and Frost-touched as sigils - painted on the party panel through `setSpire`, only where it moved, the place line given back (mutants: the ring never draining; a split read where there is none; the cracked sigil on the living recall)', () => {
  const now = T0 + 100_000;
  const E = stateAt({
    co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1], ['acct-1', 'Ann', 2, 1, 0, 1, 0, 0, 1, 0], ['acct-2', 'Bo', 3, 0, 0, 1, 1, 0, 1, 1], ['acct-3', 'Cy', 4, 1, 1, 1, 0, 0, 0, 1], ['acct-4', 'Di', 5, 0, 0, 1, 0, 1, 2, 0]],
    mm: [['acct-2', 3, 1, 2, 'acct-1']], fight: { ...EG_STATE_EMPTY.fight, mk: [['acct-1', 2, now + 5000], ['acct-1', 0, now + 5000]] },
  });
  let absent = egAbsentStep(new Map(), E, ME, new Set(['acct-2']), now - 90_000);
  assert.deepEqual([...absent.keys()], ['acct-1'], 'only the living, entered, unseen companion');
  absent = egAbsentStep(absent, E, ME, new Set(), now);
  assert.equal(absent.get('acct-1'), now - 90_000, 'the silence\'s start kept');
  assert.equal(egAbsentStep(absent, E, ME, new Set(['acct-1']), now).size, 0, 'a pose seen clears it');
  const rows = egPartyRows(E, now, { absent, roads: new Map([['acct-1', 0], [ME, 1]]) });
  const ann = rows.get('acct-1');
  assert.deepEqual([ann.numeral, ann.state, ann.cracked, ann.carries, ann.road, ann.sigils], ['II', 'alive', true, true, 'High Road', ['Fire-touched']]);
  assert.deepEqual(ann.absent, { left: EG_ABSENT_TRIAL_MS - 90_000, frac: 0.5 });
  assert.deepEqual([rows.get('acct-2').state, rows.get('acct-2').memento, rows.get('acct-2').cracked], ['witness', true, false]);
  assert.equal(rows.get('acct-3').state, 'home');
  assert.equal(rows.get('acct-4').state, 'forsaken');
  assert.equal(egPartyRows(E, now, { absent, roads: new Map([['acct-1', 0], [ME, 0]]) }).get('acct-1').road, '', 'one road: no split');
  assert.equal(egPartyRows({ ...E, sg: 'rest' }, now, { absent }).get('acct-1').absent, null, 'the ring drains in a trial alone');
  assert.equal(EG_NUMERALS[8], 'VIII');
  const deco = egPartyDeco(rows);
  assert.deepEqual([deco.get('acct-1').num, deco.get('acct-1').cls, deco.get('acct-1').ring, deco.get('acct-1').where], ['II', 'eg-spent eg-absent', 0.5, 'High Road']);
  assert.equal(deco.get('acct-2').cls, 'eg-wit');
  assert.equal(deco.get('acct-4').cls, 'eg-forsaken');
  // a fork's roads by the steps' own `road`
  const fork = egHallOf(1, 7);
  assert.ok(fork.fork);
  const hi = fork.steps.find((s) => s.road === 0), lo = fork.steps.find((s) => s.road === 1);
  assert.equal(egRoadOf(fork, hi.x, hi.y, hi.z), 0);
  assert.equal(egRoadOf(fork, lo.x, lo.y, lo.z), 1);
  assert.equal(egRoadOf(egHallOf(1, 1), 0, 0, 0), null, 'no fork, no road');
  // the party panel paints it
  const clock = { t: 1e12 };
  const social = new SocialState({ now: () => clock.t });
  const member = (n, acct) => ({ acct, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null });
  social.apply({ t: 'social', k: 'state', acct: ME, name: 'Mac', friends: [], in: [], out: [], invites: [], party: { id: 'q', leader: ME, members: [member('Mac', ME), member('Ann', 'acct-1')] } });
  const doc = fakeDocument();
  const panel = createPartyPanel({ social, doc, faceLoader: async () => null, touch: false, here: () => null });
  let d = deco;
  panel.setSpire(() => d);
  panel.render({});
  const card = panel.cardFor('acct-1');
  assert.equal(card.egNum.textContent, 'II');
  assert.match(card.node.className, /eg-spent/); assert.match(card.node.className, /eg-absent/);
  assert.equal(card.egRing.style.getPropertyValue('--eg-ring'), '0.5');
  assert.equal(card.where.textContent, 'High Road');
  assert.equal(card.name.parentNode.children.indexOf(card.egNum) < card.name.parentNode.children.indexOf(card.name), true, 'the numeral before the name');
  const w0 = doc.writes;
  panel.render({});
  assert.equal(doc.writes, w0, 'nothing moved, nothing written');
  d = null;
  panel.render({}); panel.render({});
  assert.doesNotMatch(card.node.className, /eg-/, 'out of the breach: the classes gone');
  assert.equal(card.egNum.textContent, '');
  assert.notEqual(card.where.textContent, 'High Road', 'the place line given back');
});

test('EG-G1 EVERY EVENT IS SEEN, HEARD AND SAID (section 27.5, EG_BEATS pinned): the twenty-eight events in the table\'s order (AUDIT EG III, PIN MOVED: the Vestiges\' eleven rows after the seventeen), each its sight, its sound off DAGGER.SND and its words; a fight\'s words are the fight\'s own beat lines; a beat\'s line said once - by the fight, the client\'s chat or itself; THE WATCH hears each new word once and replays nothing it saw at its first look (mutants: a sound dropped; a line said twice; the watch replaying a reload\'s old words)', () => {
  assert.deepEqual(EG_BEAT_KEYS, ['castBack', 'pull', 'door', 'cache', 'fork', 'niche', 'memento', 'goldRun', 'phase', 'fall', 'recall', 'redoubt', 'key', 'orrery', 'twist', 'home', 'lastWord',
    'secondWind', 'rally', 'lifeline', 'shieldHymn', 'spellweave', 'rallyingCry', 'bladestorm', 'deadeye', 'accord', 'accordLapse', 'resonance', 'wake']);   // PIN MOVED (AUDIT EG V, c: L7-16 - a lord's wake said, after the twenty-eight)
  assert.deepEqual(EG_BEAT_KEYS.map((k) => EG_BEATS[k].sound), ['rewind', 'veil', 'door', 'chime', null, 'softChime', 'bell', 'fanfare', 'drum', 'lowToll', 'chime', 'score', 'rare', 'chord', null, null, 'toll',
    'chime', 'chime', 'softChime', 'softChime', 'softChime', 'chime', 'sweep', 'pierce', 'softChime', null, 'chord', 'score']);
  assert.deepEqual(Object.fromEntries(Object.entries(EG_BEAT_SOUNDS).map(([k, v]) => [k, v.rec ?? v.by])), { rewind: 66, veil: 'veil', door: 25, chime: 364, softChime: 364, bell: 107, fanfare: 32, drum: 374, lowToll: 107, toll: 107, rare: 364, chord: 365, score: 'score', sweep: 105, pierce: 3 });
  // the fight's own words
  assert.equal(EG_BEATS.door.words(), EG_SAY.door());
  assert.equal(EG_BEATS.goldRun.words(), EG_SAY.goldrun());
  assert.equal(EG_BEATS.memento.words('Ann', 'Bo'), EG_SAY.memento('Ann', 'Bo'));
  assert.equal(EG_BEATS.recall.words('Ann'), EG_SAY.recalled('Ann'));
  assert.equal(EG_BEATS.home.words('Ann'), EG_SAY.home('Ann'));
  assert.equal(EG_BEATS.orrery.words(), EG_SAY.orrerytrue());
  assert.equal(EG_BEATS.pull.words(), EG_TEXT.pulled);
  assert.equal(EG_BEATS.lastWord.words(), 'The last word. The breach closes.');
  assert.equal(EG_BEATS.castBack.words(), '-10%');
  // the plans
  assert.deepEqual(egBeatPlan('door'), { sound: EG_BEAT_SOUNDS.door, screen: null, chat: null }, 'the fight says it');
  assert.deepEqual(egBeatPlan('castBack'), { sound: EG_BEAT_SOUNDS.rewind, screen: '-10%', chat: null });
  assert.deepEqual(egBeatPlan('memento', { n: 'Ann', t: 'Bo' }).chat, "Ann carries Bo's Memento.", 'in the chat too');
  assert.equal(egBeatPlan('pull').sound, null, 'the veil plays its own close');
  assert.equal(egBeatPlan('pull').chat, null, 'the client says it already');
  assert.deepEqual(egBeatPlan('redoubt', { t: 5 }), { sound: null, screen: 'Redoubt 5', chat: null });
  assert.deepEqual(egBeatPlan('twist', { t: 'sutler' }), { sound: null, screen: EG_TWIST_LINES.sutler, chat: EG_TWIST_LINES.sutler });
  assert.equal(egBeatPlan('key').sound.rec, 364);
  // THE WATCH
  const memo = egBeatMemo();
  const fight = (says) => ({ ...EG_STATE_EMPTY.fight, h: 1, says });
  const old = stateAt({ h: 1, fight: fight([{ w: 'door', n: '', t: '', at: 5 }]), falls: [{ s: 'acct-1', n: 'Ann', at: 6, fin: 0 }] });
  assert.deepEqual(egBeatWatch(memo, old, ME), { beats: [], firsts: [], runes: [] }, 'the first look learns, says nothing');
  const next = { ...old, fight: fight([{ w: 'door', n: '', t: '', at: 5 }, { w: 'goldrun', n: '', t: '', at: 9 }, { w: 'fury', n: 'Grath', t: '', at: 9 }]), falls: [...old.falls, { s: ME, n: 'Mac', at: 10, fin: 1 }], got: [{ w: 'shard', at: 11 }],
    redoubt: { w: 1, h: 5, at: 12, cl: 1, g: 900_000 } };
  const w1 = egBeatWatch(memo, next, ME);
  assert.deepEqual(w1.beats.map((b) => b.k), ['goldRun', 'fall', 'cache', 'redoubt']);
  assert.ok(w1.firsts.includes('fury') && w1.firsts.includes('count') && !w1.firsts.includes('recall'), 'a final fall teaches no recall');
  assert.deepEqual(egBeatWatch(memo, next, ME).beats, [], 'each once');
  // a wake: the twist and the fork
  const m2 = egBeatMemo();
  egBeatWatch(m2, stateAt({ seed: 1, h: 6, sg: 'arrive' }), ME);
  assert.deepEqual(egBeatWatch(m2, stateAt({ seed: 1, h: 6, sg: 'trial' }), ME).beats, [{ k: 'twist', t: 'captive' }]);
  const w3 = egBeatWatch(m2, stateAt({ seed: 1, h: 7, sg: 'trial' }), ME);
  assert.deepEqual(w3.beats, [{ k: 'fork' }]); assert.ok(w3.firsts.includes('fork'));
  assert.deepEqual(egBeatWatch(m2, stateAt({ seed: 1, h: 7, end: 'last', sg: 'end' }), ME).beats, [{ k: 'lastWord' }]);
  // THE EXAMINATION HEARD (section 25.7): a chime as each rune lights, pitched up its numeral
  const m3 = egBeatMemo();
  const runeAt = (st) => stateAt({ h: 5, fight: { ...EG_STATE_EMPTY.fight, h: 5, bodies: [{ i: 9, role: 2, k: EG_OBJ.rune, pt: 2, st, hp: 0, max: 0, fl: 0 }] } });
  egBeatWatch(m3, runeAt(0), ME);
  assert.deepEqual(egBeatWatch(m3, runeAt(1), ME).runes, [2]);
  assert.deepEqual(egBeatWatch(m3, runeAt(1), ME).runes, [], 'each rune once');
  assert.deepEqual(egBeatWatch(m3, runeAt(2), ME).runes, [], 'stood on: no chime');
  const m4 = egBeatMemo();
  egBeatWatch(m4, runeAt(0), ME);
  assert.deepEqual(egBeatWatch(m4, runeAt(2), ME).runes, [], 'a rune stood on is no rune lit');
  assert.deepEqual(egRuneChime(2), { rec: 364, vol: 0.7, pitch: 1.008 });
});

test('EG-G1 THE RECAP (section 27.6): the depth (the hall, the Redoubt, the band), the time and why in words, a strip per circle (its glyphs, its lord, its falls), each member (numeral, falls, the recall, how they left), the Vestiges and the Accords, the Reliquaries opened only by walking home or the last word - drawn whole, opened one each 400 ms with the Rare chime; the last five runs kept (mutants: the Reliquaries opened by a tear; a sixth run kept)', async () => {
  const E = stateAt({ h: 7, rd: 1, end: 'home', co: [[ME, 'Mac', 1, 1, 1, 1, 0, 0, 1, 0], ['acct-1', 'Ann', 2, 0, 0, 1, 1, 0, 1, 1]],
    ms: [[ME, 3, 0, 0, 0, [], [[EG_V_BY_KEY.oath.id, 1]], -1], ['acct-1', 0, 0, 0, 0, [], [[EG_V_BY_KEY.huntersmark.id, 2]], -1]] });
  const log = [{ h: 1, glyph: 'Y' }, { h: 2, glyph: 'S', fall: true }, { h: 5, glyph: 'C', lordName: 'Grath' }, { h: 6, glyph: 'R' }];
  const R = egRecapModel(E, ME, log, E.wk + 3_600_000, { whyText: 'You walk home.' });
  assert.deepEqual(R.depth, { h: 7, rd: 1, band: 'The Broken Galleries' });
  assert.equal(R.time, '60:00');
  assert.equal(R.whyText, 'You walk home.');
  assert.deepEqual(R.strip, [{ c: 1, glyphs: ['Y', 'S', 'C'], lord: 'Grath', falls: 1 }, { c: 2, glyphs: ['R'], lord: '', falls: 0 }]);
  assert.deepEqual(R.members.map((m) => [m.numeral, m.left, m.recall, m.falls]), [['I', 'home', 'spent', 1], ['II', 'fallen', 'held', 1]]);
  assert.deepEqual(R.accords, ['Hammer and Anvil']);
  assert.equal(R.opened, 3);
  assert.equal(egRecapModel({ ...E, end: 'tear' }, ME, log, 0).opened, 0, 'a tear loses them');
  assert.equal(egRecapModel({ ...E, end: 'last' }, ME, log, 0).opened, 3, 'the last word opens them');
  // kept: the last five
  const mem = new Map(), store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  for (let i = 0; i < 7; i++) egRecapKeep(store, { ...R, title: `run ${i}` }, i);
  assert.equal(EG_RECAPS_KEPT, 5);
  assert.deepEqual(egRecapsKept(store).map((r) => r.title), ['run 2', 'run 3', 'run 4', 'run 5', 'run 6']);
  assert.equal(JSON.parse(mem.get('eg.recaps')).length, 5, 'no sixth kept');
  // drawn whole
  const doc = fakeDocument();
  drawEgPanel(null, { doc, recap: R, relShown: 1, words: EG_PRES_TEXT });
  const panel = one(doc.body, 'eg-panel');
  const text = JSON.stringify(panel, (k, v) => (k === 'parent' ? undefined : v));
  for (const s of ['Hall 7 - Redoubt 1 - The Broken Galleries', 'Reliquaries opened: 1', 'Circle 1: Y S C - Grath (a fall)', 'I Mac - walked home, 1 fall, recall spent', 'Hammer and Anvil']) assert.ok(text.includes(s), s);
  drawEgPanel(null, { doc, recap: R, relShown: 2, words: EG_PRES_TEXT });
  assert.equal(one(panel, 'eg-rel').textContent, 'Reliquaries opened: 2', 'opened in place, one by one');
  drawEgPanel(null, { doc });
  // the client opens them one each 400 ms, each with the Rare chime
  const P = inBreach({ h: 2 });
  P.client.frame();
  P.B.mem[ME].rel = [1, 1]; P.B.mem[ME].home = 1;
  P.tell(egStateOf(P.B, P.now()));
  P.client.frame();   // I walk home: the recap stands for me (section 27.6), the breach goes on for the rest
  const chimes = () => P.played.filter((p) => p.rec === EG_BEAT_SOUNDS.rare.rec && p.vol === EG_BEAT_SOUNDS.rare.vol).length;
  assert.equal(chimes(), 0);
  for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 420)); P.client.frame(); }
  assert.equal(chimes(), 2, 'one each, two in all');
  assert.equal(egRecapsKept(P.store).length, 1, 'the run kept');
});

test('EG-G1 THE FIRST BREACH (section 27.7): the nine lines, each at its first occurrence and once a device - the void\'s at the first cast-back and never the second; the Rehearsal\'s own teaching line once; the bits kept in the device\'s store (mutants: a line said again; the bits never kept; a line before it applies)', () => {
  assert.deepEqual(EG_FIRST_KEYS, ['count', 'door', 'void', 'fork', 'fury', 'decrees', 'recall', 'memento', 'home']);
  assert.deepEqual(Object.values(EG_TEXT_FIRST), [
    'The count runs. Take a Redoubt to hold it back.', 'The first across opens the door. The others have 45 seconds.', 'The void casts you back.', 'High and fast, or low and safe.',
    'A slow lord turns to fury.', "Choose the circle's decrees.", 'A Redoubt can call the fallen back once.', "Carry a fallen friend's Memento to a niche.", 'Walk home to open your Reliquaries.',
  ]);
  const a = egFirstDue(0, ['void', 'count']);
  assert.deepEqual(a.due, [EG_TEXT_FIRST.count, EG_TEXT_FIRST.void], 'in the page\'s order');
  assert.deepEqual(egFirstDue(a.bits, ['void', 'count', 'home']).due, [EG_TEXT_FIRST.home]);
  const r = egRehearsalDue(0);
  assert.equal(r.line, EG_PRES_TEXT.rehearsal);
  assert.equal(egRehearsalDue(r.bits).line, null);
  // the client: the void's line at the first cast-back, never again; -10% on the screen; the rewind heard
  const P = inBreach({ h: 2 });
  P.client.frame();
  assert.ok(!P.said.includes(EG_TEXT_FIRST.count), 'the first look only learns');
  P.client.frame();
  assert.ok(P.said.includes(EG_TEXT_FIRST.count), 'the count runs: said at the trial');
  P.entity.health = 80;
  P.client.castBack();
  P.entity.health = 20;
  P.client.castBack();
  assert.equal(P.said.filter((t) => t === EG_TEXT_FIRST.void).length, 1, 'once');
  assert.equal(P.mids.filter((t) => t === '-10%').length, 1, 'the cost where one was taken - under a quarter, none');
  assert.equal(P.played.filter((p) => p.rec === EG_BEAT_SOUNDS.rewind.rec).length, 2, 'the rewind each time');
  const bits = egFirstRead(P.store, egFirstKey(ME));   // PIN MOVED (AUDIT EG V, c: L7-23 - the device keeps each account's own bits)
  assert.ok(bits & (1 << EG_FIRST_KEYS.indexOf('void')) && bits & (1 << EG_FIRST_KEYS.indexOf('count')), 'kept on the device');
  assert.equal(P.store.getItem(egFirstKey(ME)), String(bits));
  assert.equal(EG_FIRST_KEY, 'eg.first');
  // a second breach on this device says neither again
  const Q = inBreach({ h: 2, store: P.store });
  Q.client.frame(); Q.client.frame(); Q.entity.health = 80; Q.client.castBack();
  assert.ok(!Q.said.includes(EG_TEXT_FIRST.void) && !Q.said.includes(EG_TEXT_FIRST.count));
  // never before it applies: no home line before a Redoubt's rest
  assert.ok(!P.said.includes(EG_TEXT_FIRST.home));
  P.B.sg = 'rest'; P.tell(egStateOf(P.B, P.now())); P.client.frame();
  assert.ok(P.said.includes(EG_TEXT_FIRST.home), 'at the first rest');
});

test('EG-G1 TOUCH AND THE PAD (section 27.8): the d-pad is the Spire\'s while its panel, a witness\'s eye or its recap stands - left and right choose, up takes, down says no; a witness\'s left and right change whom, a held down forsakes; told by the prompt bar; the touch buttons for the witness and the way home; the pad\'s own codes on the classic skin; 15 ms on the Beat\'s last 0.4 s, 30 ms on a peril, the pad\'s dual rumble, behind the touch layer\'s switch (mutants: the d-pad taken with nothing open; a peril buzzed twice; the buzz with the switch off)', () => {
  assert.equal(egPadUp({}), false);
  assert.equal(egPadUp({ panel: true }), true);
  assert.deepEqual(egPadAct('left', 'tap', { panel: true }), { k: 'focus', d: -1 });
  assert.deepEqual(egPadAct('up', 'tap', { panel: true }), { k: 'take' });
  assert.deepEqual(egPadAct('down', 'tap', { panel: true }), { k: 'no' });
  assert.deepEqual(egPadAct('right', 'tap', { witness: true }), { k: 'watch', d: 1 });
  assert.deepEqual(egPadAct('down', 'hold', { witness: true }), { k: 'forsake' });
  assert.equal(egPadAct('down', 'tap', { witness: true }), null);
  assert.equal(egPadAct('up', 'tap', {}), null, 'not the Spire\'s');
  assert.deepEqual(egPadAct('left', 'tap', { recap: true, panel: true }), { k: 'close' });
  assert.deepEqual(egPadPrompts({ panel: true }).map((r) => r[1]), ['Choose', 'Take', 'No']);
  assert.equal(egPadPrompts({}), null);
  assert.deepEqual(egTouchButtons({ witness: true }).map((b) => b.id), ['prev', 'next', 'ping', 'forsake']);   // PIN MOVED (AUDIT EG V, c: L7-7 - a witness's ping, section 16.5)
  assert.deepEqual(egTouchButtons({ rest: true }).map((b) => b.id), ['home']);
  assert.deepEqual(egTouchButtons({}), []);
  assert.deepEqual(Object.values(EG_PAD_DIRS), ['up', 'down', 'left', 'right']);
  // the client: the offer chosen and taken on the d-pad
  const P = inBreach({ h: 5, sg: 'rest' });
  assert.equal(P.client.padUp(), false);
  assert.equal(P.client.key({ code: 'JoystickAxis6Button0' }), false, 'nothing open: the quickslot\'s');
  P.tell({ k: 'offer', v: [EG_V_BY_KEY.ironfooting.id, EG_V_BY_KEY.oath.id, EG_V_BY_KEY.rally.id], n: 1 });
  assert.equal(P.client.padUp(), true);
  assert.equal(P.client.key({ code: 'JoystickAxis6Button0' }), true, 'right');
  assert.equal(P.client.padGesture('right', 'tap'), true);
  assert.equal(P.client.key({ code: 'JoystickAxis7Button0' }), true, 'up takes');
  assert.deepEqual(P.sent.at(-1), { k: 'pick', v: EG_V_BY_KEY.rally.id });
  assert.deepEqual(P.client.padPrompts().map((r) => r[1]), ['Choose', 'Take', 'No']);
  // a yes-or-no choice: its two options chosen on the d-pad
  P.tell({ k: 'offer', v: [], n: 0 });
  P.tell({ k: 'ask', q: 'ready', o: [1], until: P.now() + 20_000 });
  assert.equal(P.client.padGesture('right', 'tap'), true);
  assert.equal(P.client.padGesture('up', 'tap'), true);
  assert.deepEqual(P.sent.at(-1), { k: 'vote', q: 'ready', y: 1 }, 'Ready');
  assert.equal(P.client.padGesture('down', 'tap'), true);
  assert.deepEqual(P.sent.at(-1), { k: 'vote', q: 'ready', y: 0 }, 'down says no');
  P.tell({ k: 'asked', q: 'ready', r: 1 });
  // the touch's way home: pressed once asks
  assert.equal(P.client.touchAct('home'), false);
  assert.match(P.mids.at(-1), /Walk home\?/);
  // the touch of it
  const beat = { i: 3, kind: 'beat', x: 0, y: 0, z: 10, w: 3, d: 3, beat: 0 };
  const spec = { steps: [beat] };
  assert.equal(egBeatUnder(spec, 0, 0, 10, EG_BEAT_SOLID_S - EG_BEAT_WARN_S - 0.05), -1, 'before its last 0.4 s');
  assert.equal(egBeatUnder(spec, 0, 0, 10, EG_BEAT_SOLID_S - 0.1), 3, 'its last 0.4 s, cycle 0');
  assert.equal(egBeatUnder(spec, 0, 0, 10, EG_BEAT_CYCLE_S + EG_BEAT_SOLID_S - 0.1), 1003, 'the next cycle its own');
  assert.equal(egBeatUnder(spec, 5, 0, 10, EG_BEAT_SOLID_S - 0.1), -1, 'not underfoot');
  const seen = new Set();
  const blows = [{ i: 7, s: [['d', 0, 0, 3]] }, { i: 8, s: [['d', 30, 30, 3]] }];
  assert.deepEqual(egPerilsNew(blows, 1, 1, seen), [7]);
  assert.deepEqual(egPerilsNew(blows, 1, 1, seen), [], 'once');
  assert.deepEqual(egPerilsNew([{ i: 9, at: 100, s: [['d', 0, 0, 3]] }], 1, 1, new Set(), 200), [], 'a blow already landed is no peril');
  const calls = [];
  const nav = { vibrate: (ms) => calls.push(['vibrate', ms]), getGamepads: () => [{ vibrationActuator: { playEffect: (kind, o) => { calls.push([kind, o.duration, o.weakMagnitude, o.strongMagnitude]); return Promise.resolve(); } } }] };
  assert.equal(egBuzz('peril', { nav, on: true }), true);
  assert.deepEqual(calls, [['vibrate', 30], ['dual-rumble', 30, EG_HAPTICS.peril.weak, EG_HAPTICS.peril.strong]]);
  assert.equal(egBuzz('beat', { nav, on: false }), false, 'behind the switch');
  assert.equal(EG_HAPTICS.beat.ms, 15);
  // the host wires the pad through the helm's door
  const world = rd('src/scenes/world.js');
  assert.match(world, /inputHooks\.helm = \{ up: \(\) => eg\(\) \|\| helm\.up\(\), gesture: \(dir, kind\) => \(eg\(\) \? egClient\.padGesture\(dir, kind\) : helm\.gesture\(dir, kind\)\)/);
});

test('EG-G1 ACCESSIBILITY (section 25.7): the danger palette - High contrast\'s magenta edge, white-gold safety and cyan hazard; the colour-blind presets separated under simulation where Standard is not; each shape recoloured, its fill at the player\'s light and its line whole; reduced motion by the row or the system; the three rows on the shelf and under Settings > Accessibility; the fight\'s pass drawn through it (mutants: a fill dimming the line; the gold read as danger; the system\'s setting ignored)', () => {
  assert.deepEqual(EG_DANGER_PALETTE_KEYS, ['standard', 'contrast', 'deutan', 'tritan']);
  assert.deepEqual(EG_DANGER_PALETTES.contrast.danger, [1.0, 0.15, 0.75]);
  assert.deepEqual(EG_DANGER_PALETTES.standard.danger, [...TELEGRAPH_EDGE_DAGON]);
  // separated under simulation: each pair of a colour-blind preset 40 delta E apart for the eyes it is for
  const pairs = (P) => [[P.danger, P.safety], [P.danger, P.hazard], [P.safety, P.hazard]];
  for (const [key, kinds] of [['deutan', ['protan', 'deutan']], ['tritan', ['tritan']]]) {
    for (const kind of kinds) for (const [a, b] of pairs(EG_DANGER_PALETTES[key])) assert.ok(egCvdDistance(a, b, kind) >= 40, `${key} under ${kind}: ${egCvdDistance(a, b, kind).toFixed(1)}`);
  }
  assert.ok(egCvdDistance(EG_DANGER_PALETTES.standard.danger, EG_DANGER_PALETTES.standard.safety, 'deutan') < 40, 'why the preset exists');
  assert.ok(egCvdDistance(EG_DANGER_PALETTES.standard.safety, EG_DANGER_PALETTES.standard.hazard, 'tritan') < 40);
  // a shape recoloured - PIN MOVED (merged with EG-G2): the look is laid on by the fight's egLookShapes, from the shelf
  // (one home - its fill the Spire stage's uFillK, so the colour and the line stay whole)
  const blow = () => ({ edge: TELEGRAPH_EDGE_DAGON, color: [1.0, 0.45, 0.1], alpha: 1, pool: 0, mine: true });
  const [std] = egLookShapes([blow()], { palette: EG_DANGER_PALETTES.standard, fill: 1 }, 'closing');
  assert.equal(std.fillK, 1);
  const [dim] = egLookShapes([blow()], { palette: EG_DANGER_PALETTES.standard, fill: 0.5 }, 'closing');
  assert.equal(dim.fillK, 0.5, 'the fill at the player\'s light'); assert.deepEqual(dim.color, [1.0, 0.45, 0.1], 'its colour its own');
  const [hc] = egLookShapes([{ ...blow(), mine: false }], { palette: EG_DANGER_PALETTES.contrast, fill: 1 }, 'closing');
  assert.deepEqual(hc.edge, EG_DANGER_PALETTES.contrast.danger, 'the line the palette\'s, whole');
  const [haven] = egLookShapes([{ edge: TELEGRAPH_EDGE_SAFE, color: [1.0, 0.82, 0.38], alpha: 1 }], { palette: EG_DANGER_PALETTES.contrast, fill: 0.5 }, 'closing');
  assert.deepEqual([haven.edge, haven.color, haven.fillK], [EG_DANGER_PALETTES.contrast.safety, EG_DANGER_PALETTES.contrast.safety, 1], 'safety never dimmed, never danger');
  const [pend] = egLookShapes([{ edge: TELEGRAPH_EDGE_DAGON, color: [0.95, 0.95, 1.0], alpha: 1 }], { palette: EG_DANGER_PALETTES.contrast, fill: 1 }, 'closing');
  assert.deepEqual(pend.color, EG_DANGER_PALETTES.contrast.hazard, 'the place\'s white hazard cyan');
  assert.deepEqual([egFillOf(0.2), egFillOf(0.7), egFillOf('x'), egFillOf(3)], [0.5, 0.7, 1, 1]);
  // reduced motion
  assert.equal(egReducedMotion({ matchMedia: () => ({ matches: false }) }, true), true, 'the row');
  assert.equal(egReducedMotion({ matchMedia: () => ({ matches: true }) }, false), true, 'the system');
  assert.equal(egReducedMotion({ matchMedia: () => ({ matches: false }) }, false), false);
  // the shelf, the map
  assert.deepEqual([PREF_DEFAULTS.dangerPalette, PREF_DEFAULTS.telegraphFill, PREF_DEFAULTS.reducedMotion], ['standard', 1, false]);
  assert.deepEqual([whereIs('port:reducedMotion')?.section.id, whereIs('port:dangerPalette')?.section.id, whereIs('port:telegraphFill')?.section.id], ['motion', 'danger', 'danger']);
  assert.ok(['port:reducedMotion', 'port:dangerPalette', 'port:telegraphFill'].every((k) => whereIs(k)?.tab.id === 'accessibility'));
  assert.match(rd('src/scenes/eliteGates/egFight.js'), /egLookShapes\(_shapes, egAccessNow\(\), stageNow\);/, 'the fight\'s shapes laid on from the shelf before the pass');
  // the HUD honours the palette and the stillness
  destroyEgSpireHud();
  const doc = fakeDocument();
  setPref('reducedMotion', true);
  try {
    const P = inBreach({ h: 2, win: { innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: false }) } });
    setPref('dangerPalette', 'contrast');
    const g = globalThis.document;
    globalThis.document = /** @type {any} */ (doc);
    try { P.client.frame(); } finally { globalThis.document = g; }
    const root = one(doc.body, 'eg-spire');
    assert.match(root.className, /\bstill\b/); assert.match(root.className, /\bupright\b/);
    assert.equal(root.style.getPropertyValue('--eg-danger'), 'rgb(255, 38, 191)', 'the chip\'s red is the palette\'s');
  } finally { setPref('reducedMotion', false); setPref('dangerPalette', 'standard'); destroyEgSpireHud(); }
});

test('EG-G1 THE CLIENT, PLAYED (sections 27.2-27.5): the arrival card at a hall\'s arrival; the room\'s door heard as a door; THE GOLD RUN\'s fanfare and its +1:00 flying in; a fall\'s low toll; a Redoubt\'s +15:00 and *Redoubt 1* on the screen, the hold shown never said; the party rows for the panel; the door\'s marker in the closing; a peril buzzed once; a Weir Key found rings the Rare chime (mutants: a beat silent; the rest said in words; the gain never flying)', () => {
  const P = inBreach({ h: 1, sg: 'arrive' });
  const g = globalThis.document, doc = fakeDocument();
  globalThis.document = /** @type {any} */ (doc);
  try {
    destroyEgSpireHud();
    P.client.frame();
    const card = one(doc.body, 'eg-card');
    assert.ok(card, 'the arrival card stood');
    assert.equal(one(card, 'wb-title-main').textContent, 'Hall 1 - the Broken Galleries');
    assert.equal(one(card, 'eg-card-band').textContent, "The academy's upper halls, still over the Deadlands.", 'the band\'s card at its first hall');
    P.B.sg = 'trial'; P.tell(egStateOf(P.B, P.now())); P.client.frame();
    const played = (rec) => P.played.filter((p) => p.rec === rec).length;
    P.tell({ k: 'esay', w: 'door' }); P.client.frame();
    assert.equal(played(25), 1, 'the door heard');
    P.tell({ k: 'esay', w: 'goldrun' }); P.client.frame();
    assert.equal(played(32), 1, 'the fanfare');
    assert.equal(one(doc.body, 'eg-gain').textContent, '+1:00');
    P.tell({ k: 'fall', s: 'acct-1', n: 'Ann', at: P.now(), fin: 0 }); P.client.frame();
    assert.equal(P.played.filter((p) => p.rec === 107 && p.pitch === EG_BEAT_SOUNDS.lowToll.pitch).length, 1, 'a low toll');
    assert.ok(P.said.includes(EG_TEXT_FIRST.recall), 'the recall taught at the first fall');
    P.B.mem['acct-1'].alive = 0; P.B.mem['acct-1'].wit = 1;
    // the Redoubt: its gain flies, its number on the screen, its hold shown on the chip and never said
    P.B.h = 5; P.B.sg = 'rest'; P.B.rd = 1; P.B.cnt = { left: 1_500_000, at: 0 };
    P.tell({ k: 'rd', w: 1, h: 5, at: P.now(), cl: 1_500_000, g: 900_000 });
    P.tell(egStateOf(P.B, P.now()));
    P.client.frame();
    assert.equal(one(doc.body, 'eg-gain').textContent, '+15:00');
    assert.ok(P.mids.includes('Redoubt 1'));
    assert.ok(!P.mids.some((t) => /holds the count/.test(t)) && !P.said.some((t) => /holds the count/.test(t)), 'the hold shown, never said');
    assert.equal(one(doc.body, 'eg-why').textContent, 'Redoubt', 'on the chip');
    assert.equal(one(doc.body, 'eg-glyph').textContent, EG_CHIP_GLYPHS.held);
    // the party rows for the panel
    const rows = P.client.partyRows();
    assert.equal(rows.get('acct-1').num, 'II');
    assert.equal(rows.get('acct-1').cls, 'eg-wit');
    // a Weir Key found
    P.client.beat('key');
    assert.ok(P.played.some((p) => p.rec === 364 && p.vol === EG_BEAT_SOUNDS.rare.vol), 'the Rare chime');
  } finally { globalThis.document = g; destroyEgSpireHud(); }
  // the door's marker in the closing, and a peril
  const Q = inBreach({ h: 1, sg: 'closing', seed: 77 });
  const m1 = (() => { const gg = globalThis.document, d = fakeDocument(); globalThis.document = /** @type {any} */ (d); try { Q.client.frame(); return one(d.body, 'eg-door'); } finally { globalThis.document = gg; destroyEgSpireHud(); } })();
  assert.match(m1.className, /\bon\b/, 'the way down marked');
  assert.match(one(m1, 'eg-door-text').textContent, /^The way down - \d+ m$/);
  const buzz = [];
  const nav0 = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (ms) => buzz.push(ms) }, configurable: true, writable: true });
  try {
    const R = inBreach({ h: 1, sg: 'trial', seed: 77 });
    const spec = egHallOf(77, 1);
    R.tell({ k: 'efs', h: 1, wk: R.now(), b: [], bl: [], tx: [], mk: [], pg: {} });
    R.tell({ k: 'eb', i: 4, o: 0, at: R.now() + 2000, wu: 2000, sp: 2000, s: [['d', spec.arrive.x, spec.arrive.z, 4]], p: 0.1, b: 0, ch: 0, pu: 0 });
    R.client.frame(); R.client.frame();
    assert.deepEqual(buzz, [30], 'a peril, once');
  } finally { Object.defineProperty(globalThis, 'navigator', { value: nav0, configurable: true, writable: true }); }
  void egPanelModel; void egCountText;
});
