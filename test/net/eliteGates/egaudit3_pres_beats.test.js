// AUDIT EG III (2026-10-13, presentation; bible/11-Multiplayer/Elite-Gates.md sections 15 and 27.5 - lane 6 #5): EVERY NEW
// EFFECT OF THE LAST WAVE SEEN, HEARD AND SAID. Second Wind healed silently; Lifeline's and Shield-Hymn's windows, Spellweave's
// free spell, Rallying Cry's refresh, Bladestorm, Deadeye, Kindled Steel, an Accord forming or lapsing and Rally's heal reached
// no screen but as a health bar's move. Each is now a row of EG_BEATS (ui/eliteGates/egBeats.js) on THE SPIRE MIX's critical bus, the
// holder's doors keep their news for the breach client (systems/eliteGates/spireVestiges.js spireVestigeNews), the timed windows, the
// free spell and each Accord standing are blue chips on the Spire's HUD (egHolderWatch), and the relay tells a Bladestorm's and a
// Deadeye's striker (net/eliteGates/egBrain.js hostHits - `esay` 'storm' and 'deadeye', `s` the striker). Every fixture is the producers'
// own: the director's breach and Court, blows through egBlow, the screen from createEgClient and its fight from createEgFight,
// each door its own (hurtPlayer, tellPlayerCast, calculateCastCost).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut, validEgIn, EG_SAY_KEYS } from '../../../src/net/wire.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, egStageWord, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState, egRaise, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_V_BY_KEY, EG_ACCORDS } from '../../../src/net/eliteGates/egVestige.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { EG_STATE_EMPTY, foldEg } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { spireHolderStep, spireVestigeNews, spireWeaveReady, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { defineLiveMaxHealth } from '../../../src/systems/chargen.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { calculateCastCost } from '../../../src/systems/spellcost.js';
import { tellPlayerCast } from '../../../src/systems/playerCasts.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { EG_BEATS, EG_BEAT_SOUNDS, EG_PRES_TEXT, egBeatPlan, egBeatMemo, egBeatWatch, egHolderNow, egHolderMemo, egHolderWatch } from '../../../src/ui/eliteGates/egBeats.js';
import { egSpireHudModel, drawEgSpireHud, destroyEgSpireHud } from '../../../src/ui/eliteGates/egSpireHud.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(77, [1]);
  egGive8(12345, [1]);
});

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const vId = (key) => EG_V_BY_KEY[key].id;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const body = (max = 1000) => defineLiveMaxHealth({ isPlayer: true, level: 30, stats: stats(), skills: new Array(35).fill(40), career: {}, activeEffects: [], items: [], health: max, maxHealth: max, magicka: 50, maxMagicka: 100 });

/** The Court of seed 12345's Hall 5 (test/net/eliteGates/egz_mastery.test.js's), woken by the director with a company of three, stood on its
 *  near disc for one beat and the legion it raised cleared. */
function court(at = { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] }) {
  const rng = seeded(12345);
  const co = Array.from({ length: 3 }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(12345, 5, 0);
  B.h = 5; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const subs = co.map(([sub]) => sub);
  const pos = Object.fromEntries(subs.map((sub, i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = () => { now += 250; return egStep(B, now, subs.map((sub) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 80 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the Court woke');
  for (const [sub, [x, z]] of Object.entries(at)) pos[sub] = { sx: spec.x0 + x, z };
  step();
  B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  let q = 1;
  return { B, spec, now: () => now, tick: (ms) => (now += ms),
    adds: (pts, hp = 500) => egRaise(B.F, EG_ROLE.add, 0, pts, hp, now, []),
    blow: (sub, i, d, r, [x, z]) => egBlow(B, sub, { k: 'hit', i, q: q++, d, r }, { sx: spec.x0 + x, y: 0, z }, (now += 300)) };
}
/** My screen (`acct-0`) in breach `S` (test/net/eliteGates/egz_mastery.test.js's `screen`, with its lines, its sounds and the fight's own mix
 *  kept): its clock corrected against a room 5 s ahead, my body a live player's. */
function screen(S) {
  const realNow = Date.now;
  let clock = S.now(), wall = clock - 5000;
  Date.now = () => wall;
  const sent = [], mids = [], said = [], played = [];
  const entity = Object.assign(body(1000), { fatigue: 0 });
  const spec = S.spec;
  const player = { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => S.B.b, egHallCircle: () => egCircleOfHall(S.B.h), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); if (w) sent.push(w); return true; } };
  const audio = { playOneShot: (rec, vol, pitch) => played.push({ rec, vol, pitch }) };
  let fight = null;
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    fight: (link) => (fight = createEgFight({ link, audio, player: () => entity, me: () => 'acct-0', feet: () => realmToDungeon(spec.x0, 0, 41),
      peerAt: (sub) => { const p = S.B.mem[sub]?.pose; return p ? realmToDungeon(spec.x0 + p.x, 1.6, p.z) : null; } })),
    accountOf: () => null });
  client.word(wire(egStateOf(S.B, clock)));
  client.word(wire(egFightState(S.B.F, clock)));
  for (let k = 0; k < 12; k++) {
    client.frame();
    for (const w of sent.splice(0).filter((x) => x.k === 'clk')) { const relayAt = wall + 100 + 5000; wall += 200; client.word({ k: 'clk', c: w.c, now: relayAt }); }
    wall += 250;
  }
  sent.length = 0;
  return { client, entity, mids, said, played, fight: () => fight, frame: () => client.frame(), said_: (f) => client.word(wire(f)), state: () => client.word(wire(egStateOf(S.B, S.now()))),
    cnow: () => Date.now() + client.clockOffset(), walk: (ms) => { wall += ms; },
    done: () => { Date.now = realNow; spireHolderStep(entity, null); _resetSpireVestigesForTests(); } };
}

// ── a fake document (EG-G1's, test/net/eliteGates/egpres_hud.test.js) ───────────────────────────────────────────────────────────────
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
    n.querySelectorAll = () => [];
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

// ── THE ROWS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE VESTIGES\' BEATS (section 27.5\'s last rows): Second Wind, Rally\'s heal, Lifeline\'s and Shield-Hymn\'s windows, Spellweave\'s free spell, Rallying Cry\'s refresh, Bladestorm, Deadeye, an Accord forming and lapsing, resonance first reached - each its sight, a sound off DAGGER.SND on THE SPIRE MIX and its own words, on the holder\'s screen and never the chat (mutants: a row\'s sound dropped; its words wrong; said to the chat)', () => {
  const plan = (k, w) => egBeatPlan(k, w);
  assert.deepEqual(plan('secondWind', { t: 350 }), { sound: EG_BEAT_SOUNDS.chime, screen: 'Second Wind! 350 health returns.', chat: null });
  assert.equal(plan('secondWind', { t: 0 }).screen, 'Second Wind!');
  assert.deepEqual(plan('rally', { t: 0.14 }), { sound: EG_BEAT_SOUNDS.chime, screen: 'Rally! The company heals 14%.', chat: null });
  assert.deepEqual(plan('lifeline', { t: 0.3 }), { sound: EG_BEAT_SOUNDS.softChime, screen: 'Lifeline! 30% less from blows for 3 seconds.', chat: null });
  assert.deepEqual(plan('shieldHymn'), { sound: EG_BEAT_SOUNDS.softChime, screen: "Shield-Hymn! Bastion's guard for 4 seconds.", chat: null });
  assert.deepEqual(plan('spellweave'), { sound: EG_BEAT_SOUNDS.softChime, screen: 'Spellweave! The spell costs nothing.', chat: null });
  assert.deepEqual(plan('rallyingCry'), { sound: EG_BEAT_SOUNDS.chime, screen: 'Rallying Cry! Your Second Wind is ready again.', chat: null });
  assert.deepEqual(plan('bladestorm'), { sound: { rec: 105, vol: 1, pitch: 0.7 }, screen: 'Bladestorm!', chat: null });
  assert.deepEqual(plan('deadeye'), { sound: { rec: 3, vol: 0.9, pitch: 1.5 }, screen: 'Deadeye! The arrow runs through.', chat: null });
  assert.deepEqual(plan('accord', { n: 'Mira', t: 'Kindled Steel' }), { sound: EG_BEAT_SOUNDS.softChime, screen: 'Kindled Steel, with Mira.', chat: null });
  assert.deepEqual(plan('accordLapse', { t: 'Kindled Steel' }), { sound: null, screen: 'Kindled Steel lapses.', chat: null });
  assert.deepEqual(plan('resonance', { t: 'stone' }), { sound: EG_BEAT_SOUNDS.chord, screen: 'Stone resonates: Rooted.', chat: null });
  assert.equal(plan('resonance', { t: 'blade' }).screen, 'Blade resonates: Bladestorm.');
  for (const k of ['secondWind', 'rally', 'lifeline', 'shieldHymn', 'spellweave', 'rallyingCry', 'bladestorm', 'deadeye', 'accord', 'accordLapse', 'resonance']) {
    assert.ok(EG_BEATS[k]?.sight, `${k}: its sight named`);
    assert.equal(EG_BEATS[k].by, null, `${k}: said by itself`);
  }
});

// ── THE HOLDER'S NEWS ────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE HOLDER\'S NEWS (systems/eliteGates/spireVestiges.js): a Second Wind taken is kept with the points it healed, Spellweave\'s free fourth spell as it leaves the hands, Rallying Cry\'s door as it gives back a SPENT Second Wind (none for a wind unspent, none without Second Wind held) - each drained once, all let go with the holder; Spellweave\'s chip stands while the next damage spell is the free one (mutants: Second Wind unsaid; the free spell unsaid or said a cast early; the Cry said for an unspent wind; the news never drained; kept past the holder)', () => {
  _resetSpireVestigesForTests(); _resetPlayerHealForTests();
  const b = '0123456789abcdef';
  const e = body(1000);
  spireHolderStep(e, { vs: [[vId('secondwind'), 3]], mast: -1, b, h: 5 });
  e.health = 500; hurtPlayer(e, 300);
  assert.equal(e.health, 550);
  assert.deepEqual(spireVestigeNews(), [{ k: 'secondWind', t: 350 }], 'its points');
  assert.deepEqual(spireVestigeNews(), [], 'drained');
  e.health = 500; hurtPlayer(e, 300);
  assert.deepEqual(spireVestigeNews(), [], 'spent for the hall: nothing to say');
  // RALLYING CRY: a spent wind given back, said; then an unspent one given back again says nothing
  spireHolderStep(e, { vs: [[vId('secondwind'), 3]], mast: -1, b, h: 5, dn: T0, cry: true });
  assert.deepEqual(spireVestigeNews(), [{ k: 'rallyingCry' }]);
  spireHolderStep(e, { vs: [[vId('secondwind'), 3]], mast: -1, b, h: 6, dn: 0, cry: true });
  spireHolderStep(e, { vs: [[vId('secondwind'), 3]], mast: -1, b, h: 6, dn: T0 + 1, cry: true });
  assert.deepEqual(spireVestigeNews(), [], 'a wind not spent: nothing given back');
  spireHolderStep(e, { vs: [[vId('rally'), 1]], mast: -1, b, h: 7, dn: 0, cry: true });
  spireHolderStep(e, { vs: [[vId('rally'), 1]], mast: -1, b, h: 7, dn: T0 + 2, cry: true });
  assert.deepEqual(spireVestigeNews(), [], 'no Second Wind held: nothing');
  // SPELLWEAVE: the fourth damage spell, as it leaves the hands
  const fx = (type, subType) => ({ type, subType, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 });
  const bolt = { rangeType: 2, effects: [fx(4, 0)] };
  spireHolderStep(e, { vs: [[vId('overcharge'), 1], [vId('spellbane'), 1], [vId('shieldweaver'), 1]], mast: -1, b, h: 7 });
  const cast = () => tellPlayerCast(e, bolt, calculateCastCost(bolt, e).sp);
  const said = [], ready = [];
  for (let k = 1; k <= 8; k++) { ready.push(spireWeaveReady()); cast(); said.push(spireVestigeNews().map((n) => n.k).join()); }
  assert.deepEqual(said, ['', '', '', 'spellweave', '', '', '', 'spellweave'], 'the fourth and the eighth');
  assert.deepEqual(ready, [false, false, false, true, false, false, false, true], 'its chip while the next is the free one');
  // let go with the holder
  e.health = 500; hurtPlayer(e, 300);
  spireHolderStep(e, { vs: [[vId('secondwind'), 1]], mast: -1, b, h: 8 });
  e.health = 500; hurtPlayer(e, 300);
  spireHolderStep(e, null);
  assert.deepEqual(spireVestigeNews(), [], 'the holder gone: nothing kept');
  assert.equal(spireWeaveReady(), false);
  _resetSpireVestigesForTests();
});

// ── THE HOLDER'S CHIPS ───────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE HOLDER\'S CHIPS AND THEIR BEATS (ui/eliteGates/egBeats.js egHolderWatch): a blue chip for each timed window on me with its seconds - Lifeline, and Shield-Hymn only while another\'s Bastion guards me - Spellweave\'s free spell, and each Accord while its pair stands; a window newly open is said, and an Accord formed or lapsed, each way once a hall; the first look, and the first in a new hall, only learn (mutants: a window\'s seconds; a closed window shown; my own Bastion\'s hymn shown; a window said twice; an Accord said every time it re-forms; the first look said; a lapse unsaid)', () => {
  const memo = egHolderMemo();
  const H = (o = {}) => ({ ll: [], hymn: null, accords: [], weave: false, ...o });
  const kind = (r) => r.beats.map((b) => b.k);
  assert.deepEqual(egHolderWatch(memo, H({ accords: [{ key: 'kindled', name: 'Kindled Steel', mates: ['M1'] }] }), 1000, 5), { chips: [{ k: 'accord:kindled', text: 'Kindled Steel' }], beats: [] }, 'the first look learns');
  let r = egHolderWatch(memo, H({ ll: [[500, 4000, 0.3]], accords: [{ key: 'kindled', name: 'Kindled Steel', mates: ['M1'] }] }), 1200, 5);
  assert.deepEqual(r.chips, [{ k: 'lifeline', text: 'Lifeline 3s' }, { k: 'accord:kindled', text: 'Kindled Steel' }]);
  assert.deepEqual(r.beats, [{ k: 'lifeline', t: 0.3 }], 'the window opened, said');
  r = egHolderWatch(memo, H({ ll: [[500, 4000, 0.3]] }), 3100, 5);
  assert.deepEqual([r.chips, r.beats], [[{ k: 'lifeline', text: 'Lifeline 1s' }], [{ k: 'accordLapse', t: 'Kindled Steel' }]], 'its seconds; the pair parted - said');
  r = egHolderWatch(memo, H({ ll: [[500, 4000, 0.3]], accords: [{ key: 'kindled', name: 'Kindled Steel', mates: ['M1'] }] }), 4000, 5);
  assert.deepEqual([r.chips, r.beats], [[{ k: 'accord:kindled', text: 'Kindled Steel' }], [{ k: 'accord', n: 'M1', t: 'Kindled Steel' }]], 'the window closed at its end; the pair together again, said once');
  egHolderWatch(memo, H(), 4100, 5);
  r = egHolderWatch(memo, H({ accords: [{ key: 'kindled', name: 'Kindled Steel', mates: ['M1'] }] }), 4200, 5);
  assert.deepEqual(r.beats, [], 'a hall says each way once');
  r = egHolderWatch(memo, H({ hymn: [4200, 8200, ['acct-2']], weave: true }), 4300, 5);
  assert.deepEqual(r.chips, [{ k: 'shieldHymn', text: 'Shield-Hymn 4s' }, { k: 'spellweave', text: 'Spellweave - free' }]);
  assert.deepEqual(r.beats, [{ k: 'shieldHymn' }], 'the hymn said (the lapse of a pair already said this hall is not)');
  assert.deepEqual(egHolderWatch(memo, H({ hymn: [4200, 8200, ['acct-2']] }), 4400, 5).beats, [], 'once');
  // a new hall: the first look learns again, then says again
  assert.deepEqual(kind(egHolderWatch(memo, H({ accords: [{ key: 'hymn', name: 'Shield-Hymn', mates: ['M2'] }] }), 9000, 6)), []);
  assert.deepEqual(kind(egHolderWatch(memo, H(), 9100, 6)), ['accordLapse']);
  assert.deepEqual(kind(egHolderWatch(memo, H({ accords: [{ key: 'hymn', name: 'Shield-Hymn', mates: ['M2', 'M3'] }] }), 9200, 6)), ['accord']);
  // egHolderNow: the fight's reads, my own Bastion's hymn no guard of mine, no fight nothing
  const fight = { accordMates: (key, as) => (key === 'kindled' && as === 'a' ? ['acct-1'] : key === 'hymn' && as === 'b' ? ['acct-2', 'acct-1'] : []), hymn: () => [10, 4010, ['acct-0']], shield: () => ({ ll: [[1, 2, 0.2]] }) };
  const E = { ...EG_STATE_EMPTY, b: '0123456789abcdef', co: [['acct-0', 'Mac', 1, 1, 0, 1, 0, 0, 0, 1], ['acct-1', 'Ann', 2, 1, 0, 1, 0, 0, 0, 1], ['acct-2', 'Bo', 3, 1, 0, 1, 0, 0, 0, 1]] };
  assert.deepEqual(egHolderNow(fight, E, 'acct-0', true), { ll: [[1, 2, 0.2]], hymn: null, weave: true,
    accords: [{ key: 'hymn', name: 'Shield-Hymn', mates: ['Bo', 'Ann'] }, { key: 'kindled', name: 'Kindled Steel', mates: ['Ann'] }] });
  assert.deepEqual(egHolderNow({ ...fight, hymn: () => [10, 4010, ['acct-0', 'acct-2']] }, E, 'acct-0').hymn, [10, 4010, ['acct-0', 'acct-2']], 'another\'s Bastion in it: mine');
  assert.deepEqual(egHolderNow(null, E, 'acct-0'), { ll: [], hymn: null, accords: [], weave: false }, 'no fight (a witness): nothing');
  assert.equal(EG_ACCORDS.length, 8, 'every Accord read');
  // the HUD draws them (a witness none); the client hands them in
  const S = { ...E, h: 3, sg: 'trial', seed: 77, op: T0, wk: T0 + 1000, cl: 1_200_000, ca: T0 + 60_000 };
  assert.deepEqual(egSpireHudModel(S, 'acct-0', T0 + 120_000, { held: [{ k: 'lifeline', text: 'Lifeline 2s' }] }).held, [{ k: 'lifeline', text: 'Lifeline 2s' }]);
  assert.deepEqual(egSpireHudModel(S, 'acct-0', T0 + 120_000, { witness: true, held: [{ k: 'lifeline', text: 'Lifeline 2s' }] }).held, []);
  const doc = fakeDocument();
  destroyEgSpireHud();
  const draw = (held) => drawEgSpireHud(egSpireHudModel(S, 'acct-0', T0 + 120_000, { held }), { doc });
  draw([{ k: 'lifeline', text: 'Lifeline 2s' }, { k: 'accord:kindled', text: 'Kindled Steel' }]);
  assert.deepEqual(find(doc.body, 'eg-held').map((n) => n.textContent), ['Lifeline 2s', 'Kindled Steel'], 'drawn beside the count, blue');
  draw([{ k: 'lifeline', text: 'Lifeline 1s' }]);
  assert.deepEqual(find(doc.body, 'eg-held').map((n) => n.textContent), ['Lifeline 1s'], 'redrawn as they change');
  destroyEgSpireHud();
  const C = rd('src/scenes/eliteGates/egClient.js');
  assert.match(C, /const held = egHolderWatch\(holdMemo, egHolderNow\(witness \? null : fight, E, me\(\), spireWeaveReady\(\)\), t, E\.h\);\n\s*for \(const b of held\.beats\) beatNow\(b\.k, b\);/);
  assert.match(C, /foldOpen: pres\.foldOpen, held: held\.chips, bridge: bridgeGap\(\) >= 0,/);   // PIN MOVED (AUDIT EG III's merge with the law group): Spirebridge's offer after the chips; PIN MOVED (AUDIT EG V, c: L7-7 and L2-9 - the witness's seat and the rest's share follow it)
  assert.match(C, /for \(const n of spireVestigeNews\(\)\) beatNow\(n\.k, n\);/);
});

// ── THE RELAY'S WORD ─────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III BLADESTORM AND DEADEYE TOLD THEIR STRIKER (net/eliteGates/egBrain.js hostHits; net/wire.js EG_SAY_KEYS): a Bladestorm that struck another foe, and a Deadeye that pierced one, says `storm` / `deadeye` with its striker as `s`; a storm that struck nothing, a fourth blow, an arrow from 12 m say nothing; the wire carries both words; the beat watch hears them on the striker\'s screen alone (mutants: the word never said; said for a storm that struck nobody; said to the company; the watch blind to `s`)', () => {
  const S = court();
  S.B.mem['acct-0'].vs = [[vId('searing'), 1], [vId('momentum'), 1], [vId('bloodied'), 1]];
  const [A, X] = S.adds([[0, 42.5], [2.5, 41]]);
  const says = (out) => out.filter((w) => w.k === 'esay' && (w.w === 'storm' || w.w === 'deadeye'));
  for (let k = 1; k <= 4; k++) assert.deepEqual(says(S.blow('acct-0', A.i, 20, HIT_KINDS.Melee, [0, 41])), [], `blow ${k}: none`);
  assert.deepEqual(says(S.blow('acct-0', A.i, 20, HIT_KINDS.Melee, [0, 41])), [{ k: 'esay', w: 'storm', n: 'M0', s: ['acct-0'] }], 'the fifth: told its striker');
  assert.equal(X.hp, 480);
  X.hp = 0; S.B.F.bodies = S.B.F.bodies.filter((b) => b !== X);
  for (let k = 1; k <= 4; k++) S.blow('acct-0', A.i, 1, HIT_KINDS.Melee, [0, 41]);
  assert.deepEqual(says(S.blow('acct-0', A.i, 1, HIT_KINDS.Melee, [0, 41])), [], 'a storm that struck nobody says nothing');
  const D = court({ 'acct-0': [0, 30.4], 'acct-1': [-6, 41], 'acct-2': [-6, 46] });
  D.B.mem['acct-0'].vs = [[vId('featherstep'), 1], [vId('fade'), 1], [vId('fleetfoot'), 1]];
  const [T] = D.adds([[0, 43], [0, 46]]);
  assert.deepEqual(says(D.blow('acct-0', T.i, 30, HIT_KINDS.Shaft, [0, 30.4])), [{ k: 'esay', w: 'deadeye', n: 'M0', s: ['acct-0'] }], 'the arrow through: told');
  assert.deepEqual(says(D.blow('acct-0', T.i, 30, HIT_KINDS.Shaft, [0, 31])), [], 'from 12 m: none');
  assert.ok(EG_SAY_KEYS.includes('storm') && EG_SAY_KEYS.includes('deadeye'));
  for (const w of ['storm', 'deadeye']) { const v = validEgOut({ k: 'esay', w, n: 'M0', s: ['acct-0'] }); assert.deepEqual([v?.w, v?.n, v?.s], [w, 'M0', ['acct-0']], `the wire carries ${w}`); }
  // the watch: on the striker's screen alone
  const E0 = { ...EG_STATE_EMPTY, b: '0123456789abcdef', h: 5, sg: 'trial', seed: 12345, fight: { ...EG_STATE_EMPTY.fight, h: 5, says: [] } };
  const at = (says2) => ({ ...E0, fight: { ...E0.fight, says: says2 } });
  for (const [me, want] of [['acct-0', ['bladestorm', 'deadeye']], ['acct-1', []]]) {
    const memo = egBeatMemo();
    egBeatWatch(memo, at([]), me);
    const w = egBeatWatch(memo, at([{ w: 'storm', n: 'M0', t: '', s: ['acct-0'], at: 7 }, { w: 'deadeye', n: 'M0', t: '', s: ['acct-0'], at: 8 }]), me);
    assert.deepEqual(w.beats.map((b) => b.k), want, me);
  }
});

// ── ON THE SCREEN ────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III ON THE BREACH CLIENT (scenes/eliteGates/egClient.js): Rally\'s heal, a Second Wind, a Lifeline window opened on me, an Accord standing and parting, a Bladestorm told me, resonance reached - each said on my screen with its sound through THE SPIRE MIX, never twice; another\'s Bladestorm says nothing (mutants: Rally unsaid; the news undrained; the window unsaid; the Accord unread off the fight; the striker unread)', () => {
  _resetSpireVestigesForTests(); _resetPlayerHealForTests();
  const S = court(), { B } = S;
  B.mem['acct-0'].vs = [[vId('secondwind'), 3], [vId('searing'), 1]];
  B.mem['acct-1'].vs = [[vId('overcharge'), 1]];
  const C = screen(S);
  const e = C.entity;
  const heard = (rec) => C.played.filter((p) => p.rec === rec).length;
  try {
    C.state(); C.frame(); C.frame();
    assert.equal(C.fight()?.accordMates('kindled', 'a').length, 1, 'Kindled Steel stands where my screen draws us');
    const mids0 = C.mids.length;
    // RALLY
    const chimes = heard(364);
    C.said_({ k: 'eheal', p: 0.08, why: 'rally' });
    assert.equal(C.mids.at(-1), 'Rally! The company heals 8%.');
    assert.equal(heard(364), chimes + 1, 'its chime');
    // SECOND WIND
    e.health = 500; hurtPlayer(e, 300);
    C.frame();
    assert.equal(C.mids.at(-1), 'Second Wind! 350 health returns.');
    C.frame();
    assert.equal(C.mids.filter((m) => m.startsWith('Second Wind')).length, 1, 'once');
    // LIFELINE: a window opened on my blows
    C.fight().lifeline(0.3, C.cnow() + 50);
    C.frame();
    assert.equal(C.mids.at(-1), 'Lifeline! 30% less from blows for 3 seconds.');
    // THE ACCORD: learnt standing, said as it parts and again as it stands
    const pose = B.mem['acct-1'].pose;
    B.mem['acct-1'].pose = { ...pose, x: -20 };
    C.frame();
    assert.equal(C.mids.at(-1), 'Kindled Steel lapses.');
    B.mem['acct-1'].pose = pose;
    C.frame();
    assert.equal(C.mids.at(-1), 'Kindled Steel, with M1.');
    // BLADESTORM: mine said, another's not
    const sweeps = heard(105);
    C.said_({ k: 'esay', w: 'storm', n: 'M1', s: ['acct-1'] }); C.frame();
    assert.equal(heard(105), sweeps, 'another\'s storm: not mine');
    S.tick(10);
    C.said_({ k: 'esay', w: 'storm', n: 'M0', s: ['acct-0'] }); C.frame();
    assert.equal(C.mids.at(-1), 'Bladestorm!');
    assert.equal(heard(105), sweeps + 1, 'its sweep');
    // RESONANCE: three of Stone
    B.mem['acct-0'].vs = [[vId('secondwind'), 3], [vId('searing'), 1], [vId('stoneskin'), 1], [vId('bastion'), 1]];
    C.state(); C.frame();
    assert.equal(C.mids.at(-1), 'Stone resonates: Rooted.');
    C.state(); C.frame();
    assert.equal(C.mids.filter((m) => m === 'Stone resonates: Rooted.').length, 1, 'once a breach');
    assert.ok(C.mids.length - mids0 >= 7);
    assert.ok(!C.said.some((x) => /Second Wind|Rally!|Lifeline|Bladestorm|resonates/.test(x)), 'none to the chat');
  } finally { C.done(); }
});
