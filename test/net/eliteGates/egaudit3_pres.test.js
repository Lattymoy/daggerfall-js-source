// AUDIT EG III (2026-10-13, presentation; bible/11-Multiplayer/Elite-Gates.md - lane 6 #4, #6, #9-#15): WHAT A PLAYER SEES
// AND READS. Resonance and its five capstones were read by nothing outside the law (no card said a third Vestige completes a
// family, no line said it formed, the recap kept no capstone); the offer's card named its Accord and never what it does; the
// boards' panel on the Plus skin was no window to the pad; the shaft's camera snapped under reduced motion; a way back with no
// record fell as Hall 1; the silence told a touch or pad player to type; the toll and the cast-back said the law's share, not
// what they took; the Timers row's season line and the Shelf's subtitle misspoke. Every fixture is the producers' own: the
// room's words folded by the link, the client from createEgClient, the span from createEgSpan, the rows from eventTimerRows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf, egCircleSpecs, egStartHall, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { EG_V_BY_KEY, EG_CAPSTONES } from '../../../src/net/eliteGates/egVestige.js';
import { EG_STATE_EMPTY, foldEg } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { arenaSeasonOf, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../../../src/net/arena/arenaLaw.js';
import { createEgClient, EG_BACK_TEXT } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { egPanelModel, drawEgPanel, destroyEgHud, egRecapModel, egCardCompletes, egAccordDoes } from '../../../src/ui/eliteGates/egHud.js';
import { EG_PRES_TEXT, egBeatMemo, egBeatWatch } from '../../../src/ui/eliteGates/egBeats.js';
import { createEgBoardPanel, EG_BOARD_PANEL_ID } from '../../../src/ui/eliteGates/egBoardWindow.js';
import { overlayOpen, clearOverlays, closeTopOverlay } from '../../../src/ui/enhanced/enhancedOverlays.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { spireShaftEase, spireShaftPitch, spireShaftBias, setSpireShaft, SPIRE_SHAFT_PITCH } from '../../../src/player/mwView.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const ME = 'acct-0';
const B = '0123456789abcdef';
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const vId = (key) => EG_V_BY_KEY[key].id;
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** The director's breach of three at hall `h`, each member's Vestiges `vs`, folded by the link with an offer of `cards`. */
function offered(vs, cards, h = 5) {
  const co = Array.from({ length: 3 }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: ME, o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  const now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  Br.h = h; Br.sg = 'rest'; Br.wk = now;
  for (const [sub, v] of Object.entries(vs)) Br.mem[sub].vs = v;
  const E = foldEg(foldEg(EG_STATE_EMPTY, wire(egStateOf(Br, now)), now), wire({ k: 'offer', v: cards, n: 1 }), now);
  return { Br, E, now };
}

// ── a fake document (EG-G1's, test/net/eliteGates/egpres_hud.test.js) ───────────────────────────────────────────────────────────────
function fakeDocument() {
  const doc = { writes: 0 };
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, id: '', _text: '', _cls: '', style: {} };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); if (v === '') n.children = []; } });
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = String(v); } });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.replaceChildren = (...cs) => { n.children = []; n.append(...cs); };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; n.removed = true; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.focus = () => {};
    n.querySelectorAll = () => [];
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

// ── #4 RESONANCE ON THE CARD, IN A BEAT, ON THE RECAP ─────────────────────────────────────────────────────────────────
test('AUDIT EG III RESONANCE SEEN (section 15: "Three different Vestiges of one family ... grant that family\'s capstone"): a card that would be my third different Vestige of a family says so in the Vestiges\' blue - *Completes Stone: Rooted.* and what Rooted does - never for a rank, a Mastery, a family one short or already whole; the beat watch says a capstone as my run first holds it, once a breach; the recap lists the capstones held (mutants: the third miscounted; a rank or a held family counted; the line undrawn; the beat unsaid or said again; the recap blind)', () => {
  const vs = [[vId('stoneskin'), 1], [vId('ironfooting'), 2], [vId('searing'), 1]];
  assert.equal(egCardCompletes(vId('bastion'), vs), "Completes Stone: Rooted. You cannot be pushed, and your threat doubles.");
  assert.equal(egCardCompletes(vId('stoneskin'), vs), '', 'a rank of one held');
  assert.equal(egCardCompletes(vId('momentum'), vs), '', 'Blade: one held, one short of three');
  assert.equal(egCardCompletes(100, vs), '', 'a Mastery');
  assert.equal(egCardCompletes(vId('oath'), [...vs, [vId('bastion'), 1]]), '', 'Stone already whole');
  assert.equal(egCardCompletes(vId('rally'), [[vId('lifeline'), 1], [vId('mender'), 3]]), `Completes Fellowship: Rallying Cry. ${EG_CAPSTONES.fellowship.line}`);
  // on the offer's card, drawn under its line
  const { E } = offered({ [ME]: vs }, [vId('bastion'), vId('momentum'), vId('echo')]);
  const P = egPanelModel(E, ME, T0);
  assert.deepEqual(P.offer.cards.map((c) => c.completes), ["Completes Stone: Rooted. You cannot be pushed, and your threat doubles.", '', '']);
  const doc = fakeDocument();
  destroyEgHud();
  drawEgPanel(P, { doc });
  assert.deepEqual(find(doc.body, 'eg-cap').map((n) => n.textContent), [P.offer.cards[0].completes], 'drawn on its card');
  destroyEgHud();
  // the beat, once a breach, never on the first look
  const memo = egBeatMemo();
  const at = (v) => ({ ...E, ms: E.ms.map((r) => (r[0] === ME ? [...r.slice(0, 6), v, r[7]] : r)) });
  assert.deepEqual(egBeatWatch(memo, at(vs), ME).beats, []);
  assert.deepEqual(egBeatWatch(memo, at([...vs, [vId('bastion'), 1]]), ME).beats, [{ k: 'resonance', t: 'stone' }]);
  assert.deepEqual(egBeatWatch(memo, at([...vs, [vId('bastion'), 2]]), ME).beats, [], 'once');
  assert.deepEqual(egBeatWatch(egBeatMemo(), at([...vs, [vId('bastion'), 1]]), ME).beats, [], 'a reload\'s first look says nothing old');
  // the recap
  const R = egRecapModel({ ...at([...vs, [vId('bastion'), 1], [vId('overcharge'), 1], [vId('spellbane'), 1], [vId('focus'), 1]]), end: 'home' }, ME, [], T0);
  assert.deepEqual(R.capstones, ['Rooted', 'Spellweave']);
  const rdoc = fakeDocument();
  destroyEgHud();
  drawEgPanel(null, { doc: rdoc, recap: { ...R, members: [], strip: [] }, words: EG_PRES_TEXT });
  assert.ok(find(rdoc.body, 'eg-k-line').some((n) => n.textContent === 'Capstones: Rooted, Spellweave'), 'listed on the recap');
  destroyEgHud();
});

// ── #15 WHAT THE ACCORD DOES ──────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE OFFER\'S CARD SAYS WHAT ITS ACCORD DOES (section 15\'s Accords): each Accord a card would take is named with what it does, in its own words, once a card however many companions hold its other half (mutants: the Accord\'s words unsaid; said for every companion)', () => {
  assert.equal(egAccordDoes('hammer'), "Hammer and Anvil: A foe under Hunter's Mark takes +8% damage from the Challenger's Oath holder.");
  assert.equal(egAccordDoes('none'), '');
  const { E } = offered({ 'acct-1': [[vId('huntersmark'), 1]], 'acct-2': [[vId('huntersmark'), 2]] }, [vId('oath')]);
  assert.equal(egPanelModel(E, ME, T0).offer.cards[0].accord,
    "Takes an Accord with M1's Hunter's Mark. Hammer and Anvil: A foe under Hunter's Mark takes +8% damage from the Challenger's Oath holder. Takes an Accord with M2's Hunter's Mark.");
});

// ── #6 THE BOARDS' PANEL, A WINDOW TO THE PAD ─────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE BOARDS\' PANEL IS A WINDOW TO THE PAD (section 20; ui/gamepadInput.js domWindowUp, ui/enhanced/enhancedOverlays.js): the Plus skin\'s panel stands on the page as an `enhanced-` door and on the enhanced doors\' stack while it stands - so the pad\'s cursor drives it and Tab puts it away - and a Back anywhere on the page (the pad\'s Escape, dispatched at the document) closes it once; destroyed, it leaves the stack and the page\'s keys (mutants: no enhanced id; never on the stack; left on it; Back unheard; the listener left behind)', () => {
  clearOverlays();
  const listeners = new Map();
  const win = { addEventListener: (t, f, o) => listeners.set(f, { t, o }), removeEventListener: (t, f) => listeners.delete(f) };
  const doc = Object.assign(fakeDocument(), { defaultView: win });
  let closed = 0;
  const P = createEgBoardPanel({ doc, onTab: () => {}, onClose: () => { closed++; } });
  assert.ok(EG_BOARD_PANEL_ID.startsWith('enhanced-') && P.root.id === EG_BOARD_PANEL_ID, 'an enhanced door\'s id');
  assert.equal(doc.body.children.includes(P.root), true, 'a child of the body');
  assert.equal(overlayOpen(), true, 'on the doors\' stack');
  const keys = [...listeners.entries()].filter(([, v]) => v.t === 'keydown' && v.o?.capture);
  assert.equal(keys.length, 1, 'the page\'s Back heard');
  const [onKey] = keys[0];
  let stopped = 0;
  onKey({ key: 'a', preventDefault() {}, stopPropagation() { stopped++; } });
  assert.deepEqual([closed, stopped], [0, 0], 'a letter is not Back');
  onKey({ key: 'Escape', preventDefault() {}, stopPropagation() { stopped++; } });
  assert.deepEqual([closed, stopped], [1, 1], 'Back closes it, and is its alone');
  P.destroy();
  assert.equal(overlayOpen(), false, 'off the stack');
  assert.equal(listeners.size, 0, 'the page\'s keys let go');
  // Tab's arm (the stack's close) closes it
  const Q = createEgBoardPanel({ doc, onTab: () => {}, onClose: () => { closed++; Q.destroy(); } });
  assert.equal(closeTopOverlay(), true);
  assert.deepEqual([closed, overlayOpen(), listeners.size], [2, false, 0]);
  clearOverlays();
});

// ── #9 THE SHAFT'S CAMERA UNDER REDUCED MOTION ────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE SHAFT\'S CAMERA NEVER SNAPS (section 11.8: "never snapping"): under reduced motion the shaft\'s bias is none at all - neither eased nor laid whole at once; without it, eased as before (mutants: reduced motion laid whole; eased)', () => {
  assert.equal(spireShaftEase(0, SPIRE_SHAFT_PITCH, 0.01, true), 0);
  assert.equal(spireShaftEase(SPIRE_SHAFT_PITCH, SPIRE_SHAFT_PITCH, 0.01, true), 0);
  assert.equal(spireShaftEase(0, SPIRE_SHAFT_PITCH, 0.1, false), SPIRE_SHAFT_PITCH * 0.2, 'eased without it');
  let word = { way: [0, 1], still: true };
  setSpireShaft(() => word);
  try {
    for (let k = 0; k < 5; k++) assert.equal(spireShaftPitch(0.1, 0, 0.25, true), 0.1, 'the look\'s own pitch');
    assert.equal(spireShaftBias(), 0);
    word = { way: [0, 1], still: false };
    spireShaftPitch(0, 0, 0.25, true);
    assert.equal(spireShaftBias(), SPIRE_SHAFT_PITCH / 2);
  } finally { setSpireShaft(null); }
});

// ── #10, #11 THE WAY BACK WITH NO RECORD ──────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III A WAY BACK WITH NO RECORD (section 22, EG-ZM): the account service\'s word alone knows no hall - the step under the veil is the plain veil held over *The Spire*, never Hall 1\'s fall or its name; a record that knows its hall keeps the hall\'s; the silence says no one input\'s words (mutants: the record\'s guess drawn; the label Hall 1; the fall kept; the silence telling a touch player to type)', async () => {
  const looks = [];
  const mem = new Map();
  const make = (store) => {
    const modes = { mode: 'exterior', stepping: false, egHallBreach: () => null, egHallCircle: () => null, stepThroughFire: async (go, look, opts) => { looks.push({ look, opts }); return false; }, egHallReturn: () => null };
    return createEgClient({ modes: () => modes, online: () => null, hub: () => null, now: () => T0, entity: { level: 20, health: 90, maxHealth: 100, magicka: 0, maxMagicka: 10, fatigue: 0, stats: {}, items: [] }, player: { pos: realmToDungeon(0, 0, 0) }, cam: { pos: [0, 0, 0], yaw: 0 },
      account: { me: () => ME, guest: () => false, keys: async () => ({ ok: true, data: { keys: 1, live: { b: B, until: T0 / 1000 + 3600 } } }), claim: async () => ({ ok: false }) },
      say: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, store });
  };
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const realNow = Date.now;
  Date.now = () => T0;
  try {
    let c = make(store);
    c.frame();
    for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
    assert.equal(c.returnable(), true, 'the service\'s word: a way back');
    c.useKey();
    for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
    assert.equal(looks.length, 1);
    assert.deepEqual([looks[0].look, looks[0].opts.label], ['egVeil', 'The Spire'], 'the plain veil, over the Spire');
    // a record that knows its hall: its own step and its own name
    mem.set('eg.back', JSON.stringify({ b: B, seed: 77, op: T0 - 60_000, geo: 0, ew: 0, rh: 0, h: 7, in: 1, li: null, wf: 0 }));
    c = make(store);
    c.frame();
    for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
    c.useKey();
    for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
    assert.equal(looks.length, 2);
    assert.equal(looks[1].opts.label, 'Hall 7', 'its hall named');
  } finally { Date.now = realNow; }
  assert.equal(egStartHall(0), 1);
  assert.equal(EG_BACK_TEXT.silent, 'The Spire does not answer. Try the return again.');
  assert.ok(!/type|\/breach|press|click|tap/i.test(EG_BACK_TEXT.silent), 'no one input\'s words');
});

// ── #12 THE TOLL AND THE CAST-BACK SAY WHAT THEY TOOK ─────────────────────────────────────────────────────────────────
test('AUDIT EG III THE TOLL AND THE CAST-BACK SAY WHAT THEY TOOK (sections 10.6 and 27.5): each says the points it took over the health bar\'s whole - a toll that stops short of the last point says what it took, a toll that takes nothing says nothing, Stoneskin\'s cushion makes a share of the plain body a smaller share of the bar, and a cast-back the quarter\'s floor stopped says what it took (mutants: the law\'s share said; the plain body read as the bar; a toll of nothing said)', () => {
  const inBreach = (entity) => {
    const clock = T0 + EG_SEALED_MS + 60_000;
    const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
    const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: SITE, wg: [] });
    for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
    Br.h = 2; Br.sg = 'trial'; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 };
    const said = [], mids = [], hurts = [];
    const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
    const modes = { mode: 'dungeon', egHallBreach: () => Br.b, egHallCircle: () => 1, egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
    const mem = new Map();
    const client = createEgClient({ modes: () => modes, online: () => ({ welcomes: 1, terminal: false, sendEg: () => true }), hub: () => null, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
      account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }), claim: async () => ({ ok: false }), first: async () => ({ ok: false }) },
      say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => { hurts.push(n); entity.health -= n; }, peers: () => [],
      store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) }, audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
    client.word(wire(egStateOf(Br, clock)));
    const sp = egHallOf(77, 2, 0);
    player.pos = realmToDungeon(sp.x0 + sp.arrive.x, 0, sp.arrive.z);
    client.frame();
    return { client, said, mids, hurts };
  };
  // short of the last point: four quarters (20%) of a body at 10 take 9
  let e = { level: 30, health: 10, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  let P = inBreach(e);
  P.client.word(wire({ k: 'toll', q: 4, h: 2 }));
  assert.deepEqual([P.hurts, P.mids.at(-1)], [[9], '-9%'], 'what it took');
  assert.ok(P.said.includes('The Spire takes its toll: 9% of your health.'));
  // nothing to take: nothing said
  e.health = 1;
  P.client.word(wire({ k: 'toll', q: 4, h: 3 }));
  assert.deepEqual([P.hurts.length, P.said.filter((x) => /toll/.test(x)).length], [1, 1], 'a toll of nothing says nothing');
  // a cast-back the quarter's floor stopped: 5 of the bar, not a tenth
  e.health = 30;
  P.client.castBack();
  assert.deepEqual([P.hurts.at(-1), P.mids.at(-1)], [5, '-5%']);
  const said0 = [P.hurts.length, P.mids.length];
  P.client.castBack();
  assert.deepEqual([P.hurts.length, P.mids.length], said0, 'at the floor: nothing taken, no cost said');
  // Stoneskin's cushion: shares of the plain 100, said over the bar's 125
  e = { level: 30, health: 125, maxHealth: 125, spireHp: 25, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  P = inBreach(e);
  P.client.word(wire({ k: 'toll', q: 2, h: 2 }));
  assert.deepEqual([P.hurts, P.mids.at(-1)], [[10], '-8%'], 'two quarters\' tenth of the plain body: 8% of the bar');
  P.client.castBack();
  assert.deepEqual([P.hurts.at(-1), P.mids.at(-1)], [10, '-8%']);
  assert.equal(EG_PRES_TEXT.castBackCost(0.001), '-1%', 'something taken is never "-0%"');
});

// ── #13, #14 THE TIMERS ROW AND THE SHELF ─────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE SEASON\'S ROW AND THE SHELF\'S WORDS (sections 20 and 11.10): the Timers row\'s season line says the title and the season it is held through (section 20\'s own words); the Shelf, which topples once, never promises "once in 30 seconds" - the other engines keep it (mutants: the old line; the Shelf\'s subtitle the others\')', () => {
  const nowS = ARENA_SEASON_EPOCH_S + ARENA_SEASON_S + 3600;
  const row = eventTimerRows({ now: nowS * 1000, doors: { board: () => null } }).find((r) => r.id === `elite:season:${arenaSeasonOf(nowS)}`);
  assert.equal(row.detail, 'Each Descent bracket\'s top ten hold the title Spire Champion through the next season');
  const findCircle = (want) => { for (let seed = 1; seed <= 600; seed++) for (let c = 1; c <= 20; c++) for (const s of egCircleSpecs(seed, c, 0)) if (want(s)) return { seed, c, s }; return null; };
  const words = (kind) => {
    const f = findCircle((s) => s.engines.some((e) => e.kind === kind));
    assert.ok(f, `a circle with ${kind}`);
    const sp = createEgSpan({ seed: f.seed, c: f.c });
    sp.stand({ dynamicDraws: [], collider: { addMesh: () => {} } });
    const j = f.s.engines.findIndex((e) => e.kind === kind);
    return sp.hoverName(`egengine:${f.s.h}:${j}`);
  };
  assert.deepEqual(words('shelf'), { title: 'The Shelf', subs: ['topples once onto the lesser foes', 'Work it'] });
  assert.deepEqual(words('sluice').subs[1], 'Work it once every 30 seconds');
  assert.match(rd('src/scenes/eliteGates/egSpan.js'), /E\.once \? 'Work it' : 'Work it once every 30 seconds'/);
});
