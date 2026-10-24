// AUDIT EG V (2026-10-15, fix group C, "client" - the screen's half; bible/11-Multiplayer/Elite-Gates.md sections 5, 7,
// 8.2, 16.3, 16.5, 25.7, 26, 27.1-27.9) - WHAT A MEMBER SEES, HEARS AND READS, PINNED on the director's own words (net/
// egBrain.js egStep, egFall, egStateOf through net/wire.js validEgOut) folded by this screen's client:
//   L7-4   the absent ring drained from when the screen lost the pose, not from the trial's wake (= L3-16);
//   L7-7   the witness's seat (section 16.5): the watched member's name and health, a party row's tap, its ping with its
//          cooldown on the touch layer;
//   L7-8   the recap's strip marked the viewer's own fall alone, and lost its circles at a reload;
//   L7-9   the recap could not be closed on touch;
//   L7-12  the lord's-wake swell timed from the hall's wake (SPIRLRD1 while the lord slept);
//   L7-13  SPIREEND never sounded for a fall;
//   L7-16  the party rows' falls, a lord's wake said, the toll's sound;
//   L7-17  reduced motion missed the gate's title cards in the Spire; ui/eliteGates/egAccess.js's header;
//   L7-18  EG_LAYOUTS lordH drawn by nothing;
//   L7-19  the last five runs kept and never read: the boards' own tab;
//   L7-20  words telling a screen in hand to type;
//   L7-22  a phone held sideways had no way to its decrees between arrival cards;
//   L3-10  the gather's ring and *3 of 6 here* (the room's `here` on the company row) - the trail and the allies' 60% said
//          in section 30, not built;
//   L8-6   the Weir Key's line never shown;
//   L7-10  the Spire's accessibility rows' words in the player's language;
//   NEW-1  the rest card's stake (AUDIT EG III's line) drawn by the tracker alone, which the Spire's HUD replaces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgClient, EG_LOG_KEY, EG_BACK_TEXT } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf, egStep, egFall } from '../../../src/net/eliteGates/egBrain.js';
import { egCircleOfHall, egHallOf, EG_SEALED_MS, EG_TEXT, EG_ABSENT_TRIAL_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { foldEg, EG_STATE_EMPTY, egGatherOf, egMemberOf } from '../../../src/net/eliteGates/egLink.js';
import { egAbsentStep, egPartyRows, egPartyDeco, EG_ROW_MARKS, EG_PARTY_CSS } from '../../../src/ui/eliteGates/egParty.js';
import { egSpireHudModel, drawEgSpireHud, destroyEgSpireHud, egTouchButtons, egWatchLine, egRestLine, egHereText, egFormFactor, EG_LAYOUTS, EG_SPIRE_CSS, drawEgArrivalCard, drawEgFall, egFallModel } from '../../../src/ui/eliteGates/egSpireHud.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { egHudModel, drawEgPanel, destroyEgHud, egRecapModel, egRecapKeep, egRecapsKept, egStakeText } from '../../../src/ui/eliteGates/egHud.js';
import { egBeatMemo, egBeatWatch, egBeatPlan, EG_BEATS, EG_BEAT_SOUNDS, EG_PRES_TEXT } from '../../../src/ui/eliteGates/egBeats.js';
import { spireScoreFor, SPIRE_SONGS, SPIRE_SCORE_SILENCE, SPIRE_WAKE_MS, SPIRE_END_MS } from '../../../src/systems/eliteGates/egScore.js';
import { drawGateTitleCard, destroyGateTitleCard, TITLE_CARD_CSS } from '../../../src/ui/gate/gateTitleCard.js';
import { egRunsLines, egBoardLines, EG_BOARD_TABS, EG_BOARD_TAB_TEXT, createEgBoardPanel, openEgBoard } from '../../../src/ui/eliteGates/egBoardWindow.js';
import { egSpireLights, EG_LIGHT_KIND } from '../../../src/world/eliteGates/egLights.js';
import { EG_DANGER_PALETTES } from '../../../src/ui/eliteGates/egAccess.js';
import { itemInfoRows } from '../../../src/systems/item/itemInfo.js';
import { weirKeys } from '../../../src/systems/eliteGates/weirKey.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000, ME = 'acct-0', BID = '0123456789abcdef';
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const WIN = { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) };
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setImmediate(r)); };
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k), m }; }
const rngOf = () => { let r = 0.37; return () => (r = ((r * 9301 + 49297) % 233280) / 233280); };
const wire = (w) => { const { to: _to, ...rest } = w; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${w.k}`); return v; };

/** The director's breach of `n` (me first) at hall `h`, stage `sg`; this screen's client standing in its circle. */
function spire(t, { n = 2, h = 20, sg = 'trial', store = memStore(), peers = null, party = null, audio = null } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  t.mock.method(Date, 'now', () => clock);
  const names = ['Mac', 'Ann', 'Bo', 'Cy'];
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, names[i], i + 1]);
  const B = egBreachNew({ b: BID, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: SITE, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = sg; B.wk = clock - 1000; B.hw = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 }; B.rd = Math.floor((h - 1) / 5); B.resp = 900_000;
  const L = { sent: [], said: [], mids: [], played: [] };
  const st = { inside: true };
  const ent = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 5, stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, intelligence: 50 }, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { get mode() { return st.inside ? 'dungeon' : 'exterior'; }, egHallBreach: () => (st.inside ? B.b : null), egHallCircle: () => (st.inside ? egCircleOfHall(B.h) : null),
    egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { st.inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go) => go(), enterEgHall: () => true, forceExitToExterior: () => { st.inside = false; }, egSwapDrop: () => {}, egBandsDown: () => 0, deathUp: () => false };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { L.sent.push({ k, ...f }); return true; } };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity: ent, player, cam: { pos: [0, 1.6, 0], yaw: 0 },
    say: (s) => L.said.push(s), mid: (s) => L.mids.push(s), site: () => ({}), wire: () => SITE, landAt: () => true, hurt: (k) => { ent.health -= k; }, store, win: WIN,
    peers: peers ?? (() => []), party: party ?? (() => co.map(([sub, name]) => ({ sub, name }))), audio: audio ?? { playOneShot: (rec, vol, pitch) => L.played.push([rec, vol, pitch]) } });
  const tell = (w) => { const { to, ...rest } = w; if (to && to !== ME) return; client.word(wire(rest)); };
  const rng = rngOf();
  const beat = (bodies = []) => { for (const w of egStep(B, clock, bodies, rng)) tell(w); };
  return { B, client, L, st, store, entity: ent, player, tell, beat, step: (ms) => { clock += ms; }, now: () => clock, co };
}

// ── L7-4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-4 = L3-16 THE ABSENT RING DRAINS FROM THE TRIAL\'S WAKE (section 6.1 - "counted from the trial\'s wake. Absence on the stair or at a rest never counts"): a member this screen lost the pose of long before the hall woke shows the full 180 s at the wake and drains with the room\'s own count (net/eliteGates/egBrain.js `now - Math.max(m.seenAt, B.hw)`), never a ring emptied a minute early (mutants: the ring from the silence alone; from the wake alone)', (t) => {
  const R = spire(t, { h: 7, sg: 'trial' });
  const wakeAt = R.now();
  R.B.hw = wakeAt;
  let absent = new Map();
  const E0 = foldEg(EG_STATE_EMPTY, wire(egStateOf(R.B, wakeAt)), wakeAt);
  absent = egAbsentStep(absent, E0, ME, new Set(), wakeAt - 120_000);   // the screen lost Ann two minutes before the wake (the stair, the rest)
  for (const [dt, want] of [[0, 180], [60_000, 120], [120_000, 60], [179_000, 1]]) {
    const row = egPartyRows(E0, wakeAt + dt, { absent }).get('acct-1');
    assert.equal(Math.ceil(row.absent.left / 1000), want, `wake+${dt / 1000}s`);
  }
  // a silence begun inside the trial drains from itself
  const late = egAbsentStep(new Map(), E0, ME, new Set(), wakeAt + 30_000);
  assert.equal(egPartyRows(E0, wakeAt + 90_000, { absent: late }).get('acct-1').absent.left, EG_ABSENT_TRIAL_MS - 60_000);
});

// ── L7-7 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-7 THE WITNESS\'S SEAT (section 16.5 - "the HUD: the count, the watched member\'s name and vitals"; "a tap on a party row"; "the ping ... its cooldown shown"): a witness\'s stage line names whom it watches with their health (the party\'s pose), the touch layer offers its ping with the cooldown\'s seconds on it, a tap on a living companion\'s row (its `eg-tap`, the party panel\'s one press) watches them, Q/E and the shoulders move the eye along the living (mutants: no name; no health; the ping\'s button gone or without its seconds; a row\'s tap deaf; the shoulders deaf)', (t) => {
  const peerPos = { 'acct-1': [10, 0, 0], 'acct-2': [-10, 0, 0] };
  const R = spire(t, { n: 3, h: 2, peers: () => Object.entries(peerPos).map(([sub, pos]) => ({ sub, pos })),
    party: () => [{ sub: ME, name: 'Mac' }, { sub: 'acct-1', name: 'Ann', h: 64, hm: 100 }, { sub: 'acct-2', name: 'Bo', h: 10, hm: 40 }] });
  R.tell(egStateOf(R.B, R.now())); R.client.frame();
  R.client.fallSave(); R.client.frame();
  R.step(10_000); R.client.frame();   // past THE FALL's card
  const eye = () => { const c = {}; R.client.witnessEye(c, 0); return c.pos?.[0] ?? null; };
  const first = eye();
  assert.ok(first > 5, 'watching Ann');
  // the stage line names her and her health
  const E = R.client.state();
  const m = egSpireHudModel(E, ME, R.now(), { witness: true, watch: { numeral: 'II', name: 'Ann', pct: 64 }, ping: 0, touch: true });
  assert.match(m.stage, /^Watching II Ann - health 64%\. /);
  assert.equal(egWatchLine({ numeral: 'III', name: 'Bo', pct: null }), 'Watching III Bo.');
  assert.deepEqual(m.touch.map((b) => b.id), ['prev', 'next', 'ping', 'forsake']);
  const cool = egSpireHudModel(E, ME, R.now(), { witness: true, ping: 2100, touch: true });
  assert.equal(cool.touch.find((b) => b.id === 'ping').label, 'Ping 3s', 'the cooldown on the button');
  assert.match(cool.stage, /Your ping is ready in 3s\./);
  // the client hands the HUD its watched member, with the party pose's health
  const doc = fakeDocument();
  destroyEgSpireHud();
  R.client.frame();
  drawEgSpireHud(egSpireHudModel(R.client.state(), ME, R.now(), { witness: true, watch: { numeral: 'II', name: 'Ann', pct: 64 }, touch: true }), { doc });
  assert.equal(find(doc.body, 'eg-touch-ping').length, 1, 'the ping\'s button drawn');
  drawEgSpireHud(egSpireHudModel(R.client.state(), ME, R.now(), { witness: true, ping: 2100, touch: true }), { doc });
  assert.equal(find(doc.body, 'eg-touch-ping')[0].textContent, 'Ping 3s', 'its seconds drawn as they move');
  destroyEgSpireHud();
  // the client's own frame hands the HUD the member it watches, with the party pose's health
  globalThis.document = fakeDocument();
  try {
    R.client.frame();
    assert.match(find(globalThis.document.body, 'eg-stage')[0].textContent, /^Watching II Ann - health 64%\./);
  } finally { destroyEgSpireHud(); destroyEgHud(); delete globalThis.document; }
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /watch: witness \? watchedOf\(E\) : null, ping: witness \? pingLeft\(\) : 0/);
  // the shoulders and Q/E move the eye along the living
  R.client.key({ code: 'JoystickButton5' }); R.client.frame();
  assert.ok(eye() < -5, 'the shoulder watched Bo');
  R.client.key({ code: 'KeyQ' }); R.client.frame();
  assert.ok(eye() > 5, 'Q back to Ann');
  // a tap on a living companion's row watches them
  const deco = R.client.partyRows();
  assert.match(deco.get('acct-2').cls, /\beg-tap\b/);
  assert.doesNotMatch(deco.get(ME).cls, /\beg-tap\b/, 'never my own');
  assert.equal(R.client.watchMember('acct-2'), true); R.client.frame();
  assert.ok(eye() < -5, 'the tap watched Bo');
  assert.equal(R.client.watchMember(ME), false);
  assert.match(EG_PARTY_CSS, /\.dfparty-card\.eg-tap \{ pointer-events: auto; cursor: pointer; \}/);
  const P = rd('src/ui/partyPanel.js');
  assert.match(P, /card\.node\.addEventListener\?\.\('click', \(\) => \{ if \(String\(card\.node\.className\)\.split\(\/\\s\+\/\)\.includes\('eg-tap'\)\) spireTap\?\.\(acct\); \}\);/);
  assert.match(rd('src/scenes/world.js'), /partyPanel\.setSpire\(\(\) => egClient\?\.partyRows\(\) \?\? null, \(acct\) => egClient\?\.watchMember\(acct\)\);/);
  assert.match(rd('src/scenes/world.js'), /party: \(\) => \(social\?\.party\?\.members \?\? \[\]\)\.map\(\(m\) => \(\{ sub: m\.acct, name: m\.name, h: m\.p\?\.h, hm: m\.p\?\.hm \}\)\)/);
  // a living member's buttons hold no ping
  assert.deepEqual(egTouchButtons({ witness: false, rest: true }).map((b) => b.id), ['home']);
});

// ── L7-8 / L7-9 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-8 THE RECAP\'S STRIP MARKS THE ROOM\'S FALLS, KEPT PAST A RELOAD (section 27.6 - "a strip per circle: the hall kinds\' glyphs, the lord, the falls marked"): a companion\'s fall and mine (the director\'s egFall, its `co` word) each marked on the hall the company stood in; the log kept on the device with its breach, so a client made again (a reload) still has the earlier circles and their falls; another breach\'s log is let go (mutants: my own fall alone; the log in memory alone; another breach\'s halls kept)', (t) => {
  const store = memStore();
  const R = spire(t, { n: 3, h: 2, store });
  const walk = (h) => { R.B.h = h; R.tell(egStateOf(R.B, R.now())); R.client.frame(); R.step(100); };
  walk(2); walk(3);
  const out = []; egFall(R.B, 'acct-1', R.now(), out, null); for (const w of out) R.tell(w); R.client.frame();
  out.length = 0; egFall(R.B, 'acct-2', R.now(), out, null); for (const w of out) R.tell(w); R.client.frame();
  walk(4);
  out.length = 0; egFall(R.B, ME, R.now(), out, null); for (const w of out) R.tell(w); R.client.frame();
  walk(6); walk(7);
  const kept = JSON.parse(store.getItem(EG_LOG_KEY));
  assert.equal(kept.b, BID);
  assert.deepEqual(kept.l.filter(([, f]) => f > 0), [[3, 2], [4, 1]], 'each fall on its hall, two in one');
  // a reload: the same store, the company in hall 9
  const Q = spire(t, { n: 3, h: 9, store });
  Q.B.mem['acct-1'].falls = 1; Q.B.mem['acct-2'].falls = 1; Q.B.mem[ME].falls = 1; Q.B.mem['acct-1'].alive = 0; Q.B.mem['acct-1'].wit = 1;
  Q.tell(egStateOf(Q.B, Q.now())); Q.client.frame();
  Q.B.end = 'last'; Q.tell(egStateOf(Q.B, Q.now())); Q.client.frame();
  const recap = egRecapsKept(store).at(-1);
  assert.deepEqual(recap.strip.map((c) => [c.c, c.glyphs.length, c.falls]), [[1, 5, 3], [2, 4, 0]], 'circle 1 whole, kept through the reload, its three falls on it; circle 2 to hall 9');
  // another breach: its own log
  store.setItem(EG_LOG_KEY, JSON.stringify({ b: 'ffffffffffffffff', l: [[1, 3]], f: { 'acct-1': 3 } }));
  const O = spire(t, { n: 2, h: 12, store });
  O.tell(egStateOf(O.B, O.now())); O.client.frame();
  assert.equal(JSON.parse(store.getItem(EG_LOG_KEY)).b, BID);
  assert.deepEqual(JSON.parse(store.getItem(EG_LOG_KEY)).l.map(([h]) => h), [11, 12], 'from the circle\'s first hall, nothing of the other');
});

test('AUDIT EG V L7-9 THE RECAP CLOSES ON TOUCH (section 27.6; section 27.8): the recap\'s panel carries its own close button, its press the client\'s close; a screen in hand reads no key\'s words (mutants: no button; the button deaf; "Press Enter" on touch)', () => {
  const recap = { b: BID, title: 'Hall 9', time: '12:00', why: 'last', whyText: 'The last word.', depth: { h: 9, rd: 1, band: 'The Broken Galleries' }, strip: [], members: [], vestiges: [], capstones: [], accords: [], opened: 0, board: '', circles: [], company: '' };
  let closed = 0;
  const doc = fakeDocument();
  destroyEgHud();
  drawEgPanel(null, { doc, recap, words: EG_PRES_TEXT, touch: true, onClose: () => { closed++; } });
  const btn = find(doc.body, 'eg-close');
  assert.equal(btn.length, 1);
  assert.equal(btn[0].textContent, 'Close');
  btn[0].listeners.click[0]();
  assert.equal(closed, 1);
  assert.ok(!JSON.stringify(doc.body, (k, v) => (k === 'parent' ? undefined : v)).includes('Press Enter'), 'no key\'s words on touch');
  destroyEgHud();
  const desk = fakeDocument();
  drawEgPanel(null, { doc: desk, recap, words: EG_PRES_TEXT, touch: false });
  assert.equal(find(desk.body, 'eg-close').length, 1, 'a desk has the button too');
  destroyEgHud();
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /touch: pres\.touch \?\?= isTouchDevice\(win\), onClose: \(\) => \{ recap = null; drawEgPanel\(null\); \} \}\);/);
});

// ── L7-12 / L7-13 ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-12 / L7-13 THE SCORE HEARS THE LORD\'S WAKE AND MY FALL (section 26 - "a lord\'s wake is a 2-bar drum swell before SPIRLRD1"; SPIREEND for "the tear, a fall, the end"): in the director\'s own Court the band\'s ambience holds while the lord sleeps, SPIRWAKE sounds for SPIRE_WAKE_MS from the room\'s own wake (the company stepping into its ring), then SPIRLRD1; my fall plays SPIREEND for SPIRE_END_MS, then the hall\'s song again (mutants: the swell from the hall\'s wake; SPIRLRD1 over a sleeping lord; no end for a fall)', (t) => {
  const R = spire(t, { n: 2, h: 5, sg: 'arrive' });
  const spec = egHallOf(77, 5, 0);
  assert.equal(spec.kind, 'court');
  R.B.pulledAt = R.now(); R.B.su = R.now() + 30_000;
  const at = (x, z) => R.co.map(([sub]) => ({ sub, sx: spec.x0 + x, z, dead: false, at: R.now() }));
  R.tell(egStateOf(R.B, R.now()));
  for (let k = 0; k < 60 && R.B.sg !== 'trial'; k++) { R.step(250); R.beat(at(spec.arrive.x, spec.arrive.z)); }
  assert.equal(R.B.sg, 'trial', 'the Court woke');
  R.client.frame();
  const song = () => spireScoreFor(R.client.scoreView().place);
  R.step(5000); R.beat(at(spec.arrive.x, spec.arrive.z)); R.client.frame();
  assert.equal(R.client.scoreView().place.asleep, true);
  assert.equal(song(), SPIRE_SCORE_SILENCE, 'the lord sleeps: the band\'s ambience');
  // into the ring: the lord's wake
  for (let k = 0; k < 20 && !R.client.state().fight?.says?.some((s) => s.w === 'wake'); k++) { R.step(250); R.beat(at(spec.ring.x, spec.ring.z)); }
  assert.ok(R.client.state().fight.says.some((s) => s.w === 'wake'), 'the room\'s wake');
  assert.equal(song(), SPIRE_SONGS.wake, 'the swell from the lord\'s own wake');
  R.step(SPIRE_WAKE_MS);
  assert.equal(song(), SPIRE_SONGS.lord1);
  // my fall: SPIREEND, then the Court's song again
  R.client.fallSave(); R.client.frame();
  assert.equal(song(), SPIRE_SONGS.end);
  R.step(SPIRE_END_MS - 1000);
  assert.equal(song(), SPIRE_SONGS.end);
  R.step(2000);
  assert.equal(song(), SPIRE_SONGS.lord1);
  // a fall this device saw already (a return as a witness - the way back's record, `wf`) plays no end again
  const back = memStore();
  back.setItem('eg.back', JSON.stringify({ b: BID, seed: 77, op: T0, geo: 0, ew: 0, rh: 0, h: 5, in: 1, li: null, wf: 1 }));
  const S = spire(t, { n: 2, h: 5, store: back });
  S.tell(egStateOf(S.B, S.now())); S.client.frame();
  S.client.fallSave(); S.client.frame();
  assert.notEqual(spireScoreFor(S.client.scoreView().place), SPIRE_SONGS.end, 'a seen fall');
  // pure: a sleeping Court, a woken one, a fall
  const base = { band: 0, sg: 'trial', kind: 'court', lord: 'grath', valk: false, phase: 1, countLeft: NaN, set: false, end: false };
  assert.equal(spireScoreFor({ ...base, asleep: true, sinceWake: Infinity }), SPIRE_SCORE_SILENCE);
  assert.equal(spireScoreFor({ ...base, asleep: false, sinceWake: 100 }), SPIRE_SONGS.wake);
  assert.equal(spireScoreFor({ ...base, kind: 'yard', sinceFall: 10 }), SPIRE_SONGS.end);
  assert.equal(spireScoreFor({ ...base, kind: 'yard', sinceFall: SPIRE_END_MS }), SPIRE_SONGS.yard);
});

// ── L7-16 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-16 THE NOTES\' SMALL PROMISES KEPT: the party rows carry each member\'s falls (a dagger a fall, said in their title); a lord\'s wake is said by name in the chat (the title card shows it on the screen, the score\'s swell is its sound); the pull\'s toll rings the bell (mutants: no falls on the rows; the wake unsaid or said on the screen twice; the toll silent)', (t) => {
  const R = spire(t, { n: 2, h: 3 });
  const out = []; egFall(R.B, 'acct-1', R.now(), out, null);
  const E = foldEg(foldEg(EG_STATE_EMPTY, wire(egStateOf(R.B, R.now())), R.now()), wire(out[1]), R.now());
  const rows = egPartyRows(E, R.now());
  assert.equal(rows.get('acct-1').falls, 1);
  assert.match(rows.get('acct-1').label, /1 fall/);
  assert.ok(egPartyDeco(rows).get('acct-1').mark.includes(EG_ROW_MARKS.fall));
  assert.equal(egPartyDeco(rows).get(ME).mark.includes(EG_ROW_MARKS.fall), false);
  // the wake, said by the lord's name in the chat alone
  assert.deepEqual(egBeatPlan('wake', { n: 'Grath, the Hound' }), { sound: null, screen: null, chat: 'Grath, the Hound wakes.' });
  assert.equal(EG_BEATS.wake.sound, 'score');
  // the toll's bell
  R.tell(egStateOf(R.B, R.now())); R.client.frame();
  R.L.played.length = 0;
  R.client.word(wire({ k: 'toll', q: 2, h: 3 }));
  assert.ok(R.L.played.some(([rec, vol, pitch]) => rec === EG_BEAT_SOUNDS.toll.rec && pitch === EG_BEAT_SOUNDS.toll.pitch), 'the toll rings');
});

test('AUDIT EG V L7-16 (the wake heard) THE WATCH SAYS A LORD\'S WAKE BY NAME: the room\'s `wake` line in a Court whose lord stands names it once, never on the first look (mutants: the wake unheard; replayed)', (t) => {
  const R = spire(t, { n: 2, h: 5, sg: 'arrive' });
  const spec = egHallOf(77, 5, 0);
  R.B.pulledAt = R.now(); R.B.su = R.now() + 30_000;
  const at = (x, z) => R.co.map(([sub]) => ({ sub, sx: spec.x0 + x, z, dead: false, at: R.now() }));
  R.tell(egStateOf(R.B, R.now()));
  for (let k = 0; k < 60 && R.B.sg !== 'trial'; k++) { R.step(250); R.beat(at(spec.arrive.x, spec.arrive.z)); }
  const memo = egBeatMemo();
  egBeatWatch(memo, R.client.state(), ME);
  for (let k = 0; k < 20 && !R.client.state().fight?.says?.some((s) => s.w === 'wake'); k++) { R.step(250); R.beat(at(spec.ring.x, spec.ring.z)); }
  const { beats } = egBeatWatch(memo, R.client.state(), ME);
  assert.deepEqual(beats.filter((b) => b.k === 'wake').map((b) => b.n), ['Grath']);
  assert.deepEqual(egBeatWatch(memo, R.client.state(), ME).beats.filter((b) => b.k === 'wake'), [], 'once');
});

// ── L7-17 / L7-18 / L7-22 ───────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-17 REDUCED MOTION STILLS THE GATE\'S TITLE CARDS IN THE SPIRE (section 25.7; the row: "Nothing on the HUD pulses, flies or rises"): drawGateTitleCard reads the port\'s row or the system\'s setting itself (scenes/eliteGates/egFight.js passes none), its name never flies in and its rule never sweeps (`still`), the sheet honours the system\'s query too; ui/eliteGates/egAccess.js\'s header says the ring drains (mutants: the card flying under reduced motion; the rule sweeping; the header\'s claim)', () => {
  const doc = fakeDocument();
  destroyGateTitleCard();
  drawGateTitleCard({ key: 'wake@1:Grath', kicker: '', main: 'Grath', sub: '', color: null, alpha: 1, fresh: true }, { doc, still: true });
  const card = find(doc.body, 'wb-title-card')[0];
  assert.match(card.className, /\bstill\b/);
  assert.doesNotMatch(card.className, /\bin\b/);
  destroyGateTitleCard();
  const moving = fakeDocument();
  drawGateTitleCard({ key: 'wake@1:Grath', kicker: '', main: 'Grath', sub: '', color: null, alpha: 1, fresh: true }, { doc: moving, still: false });
  assert.match(find(moving.body, 'wb-title-card')[0].className, /\bin\b/);
  destroyGateTitleCard();
  // the port's row read by the card itself (scenes/eliteGates/egFight.js passes nothing)
  setPref('reducedMotion', true);
  try {
    const own = fakeDocument();
    drawGateTitleCard({ key: 'fell@2:Grath', kicker: '', main: 'Grath', sub: 'Felled', color: null, alpha: 1, fresh: true }, { doc: own });
    assert.match(find(own.body, 'wb-title-card')[0].className, /\bstill\b/, 'the row, read by the card');
    destroyGateTitleCard();
  } finally { setPref('reducedMotion', false); }
  // the Spire's own cards: the arrival card and THE FALL's
  const cards = fakeDocument();
  drawEgArrivalCard({ key: 'a', kicker: 'k', main: 'm', sub: 's', twist: '', dec: '', band: '', lays: '', alpha: 1, fresh: true }, { doc: cards, still: true });
  assert.match(find(cards.body, 'eg-card')[0].className, /\bstill\b/);
  drawEgFall(egFallModel({ at: 0, final: false, lost: 1 }, 2000, { still: true }), { doc: cards });
  assert.match(find(cards.body, 'eg-fall-card')[0].className, /\bstill\b/);
  destroyEgSpireHud();
  assert.match(TITLE_CARD_CSS, /\.wb-title-card\.still \.wb-title-rule \{ transition: none; \}/);
  assert.match(TITLE_CARD_CSS, /@media \(prefers-reduced-motion: reduce\) \{ \.wb-title-rule \{ transition: none; \} \.wb-title-card\.in \.wb-title-main \{ animation: none; \} \}/);
  assert.match(rd('src/ui/gate/gateTitleCard.js'), /export function drawGateTitleCard\(model, \{ hidden = false, doc = globalThis\.document, still = egReducedMotion\(\) \} = \{\}\)/);
  assert.match(rd('src/ui/eliteGates/egAccess.js'), /The absent's ring still drains: it is a count, not a motion\./);
});

test('AUDIT EG V L7-18 / L7-22 THE LORD\'S BAR STANDS ITS LAYOUT\'S HEIGHT, AND A PHONE HELD SIDEWAYS FOLDS ITS DECREES (section 27.1): drawEgSpireHud sets the bar\'s height off EG_LAYOUTS lordH (30 on a desk, 44 sideways) and the track takes the rest; sideways the decrees fold to a press beside each arrival card\'s (mutants: lordH drawn by nothing; the sideways decrees unreachable)', (t) => {
  assert.deepEqual(Object.fromEntries(Object.entries(EG_LAYOUTS).map(([k, v]) => [k, [v.dec, v.lordH]])), { desktop: ['row', 30], upright: ['fold', 30], sideways: ['fold', 44] });
  const R = spire(t, { n: 2, h: 7 });
  R.B.dc = [[EG_DECREE_BY_KEY.ashen.id, 1]];
  const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(R.B, R.now())), R.now());
  const side = egSpireHudModel(E, ME, R.now(), { ff: egFormFactor({ w: 844, h: 390 }) });
  assert.ok(E.dc.length >= 1);
  assert.equal(side.decFold, EG_PRES_TEXT.decrees(E.dc.length));
  for (const [ff, px] of [['desktop', '30px'], ['sideways', '44px']]) {
    const doc = fakeDocument();
    destroyEgSpireHud();
    drawEgSpireHud({ ...egSpireHudModel(E, ME, R.now(), { ff }) }, { doc });
    const lord = find(doc.body, 'eg-lord')[0];
    assert.equal(lord.style['--eg-lord-h'], px, ff);
    destroyEgSpireHud();
  }
  assert.match(EG_SPIRE_CSS, /\.eg-lord-track \{ position: relative; height: calc\(var\(--eg-lord-h, 30px\) - 20px\);/);
});

// ── L7-19 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-19 THE LAST FIVE RUNS ARE READ (section 27.6 - "The last five runs are kept"): the boards\' sixth tab lists this device\'s kept recaps (ui/eliteGates/egHud.js egRecapKeep), newest first - its day, depth, time, why and board line - whatever the service\'s board says; the panel draws it; the world host hands the store\'s runs to the boards\' door (mutants: the runs unread; the oldest first; the tab gone)', (t) => {
  const store = memStore();
  const R = spire(t, { n: 2, h: 9 });
  R.B.end = 'last';
  const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(R.B, R.now())), R.now());
  egRecapKeep(store, egRecapModel(E, ME, [], R.now(), { whyText: 'The last word.', board: 'The Descent, the Few: 3rd' }), Date.UTC(2026, 9, 14));
  egRecapKeep(store, { ...egRecapModel(E, ME, [], R.now(), { whyText: 'You walk home.' }), title: 'Hall 4 - Redoubt 0 - The Broken Galleries' }, Date.UTC(2026, 9, 15));
  assert.equal(EG_BOARD_TABS.at(-1), 'runs');
  assert.equal(EG_BOARD_TAB_TEXT.runs, 'Your last runs');
  const lines = egRunsLines(egRecapsKept(store));
  assert.deepEqual(lines.slice(1).map((l) => l.split(' - ')[0]), ['2026-10-15', '2026-10-14'], 'newest first');
  assert.match(lines[2], /The last word\. - The Descent, the Few: 3rd$/);
  assert.deepEqual(egRunsLines([]), ['Your last runs', 'No run is kept on this device yet.']);
  assert.deepEqual(egBoardLines(null, 'runs', { runs: egRecapsKept(store) }), lines, 'whatever the board');
  const doc = fakeDocument();
  doc.defaultView = { addEventListener() {}, removeEventListener() {} };
  const panel = createEgBoardPanel({ doc, onTab: () => {}, onClose: () => {}, runs: () => egRecapsKept(store) });
  panel.render({ error: 'offline' }, 'runs');
  const runRow = (d) => find(d.body, 'eg-k-row').map((n) => [find(n, 'eg-k-who')[0].textContent, find(n, 'eg-k-sub')[0].textContent, find(n, 'eg-k-val')[0].textContent]);   // EG-PLUS: a run's title, its day and why, its time
  const r0 = egRecapsKept(store).at(-1);
  const shown = runRow(doc);
  assert.deepEqual(shown[0], [r0.title, '2026-10-15 - You walk home.', r0.time], 'the newest first: its depth, its day and why, its time');
  panel.destroy();
  const doc2 = fakeDocument();
  doc2.defaultView = { addEventListener() {}, removeEventListener() {} };
  const open = openEgBoard({ doc: doc2, fetchBoard: () => new Promise(() => {}), tab: 'runs', runs: () => egRecapsKept(store) });
  assert.deepEqual(runRow(doc2), shown, 'the opener hands its runs to the panel');
  open.close();
  assert.match(rd('src/scenes/world.js'), /runs: \(\) => egRecapsKept\(appStorage\(\)\), \.\.\.o \}\)/);
});

// ── L7-20 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-20 NO LINE TELLS A SCREEN IN HAND TO TYPE (section 27.8): the call\'s tracker, the opener\'s call line, the way back\'s offer, the witness\'s line and the forsaking confirm say what to do, not which keys to type; the panel says a tap on touch (mutants: "Type /breach" back on any of them)', (t) => {
  const R = spire(t, { n: 2, h: 3 });
  const E = foldEg(EG_STATE_EMPTY, wire({ k: 'call', b: BID, ew: 0, seed: 77, op: R.now() - EG_SEALED_MS - 1000, o: 'Ann', os: 'acct-1', co: [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]], rh: 0, site: SITE, sg: 'x'.repeat(86) }), R.now());
  const open = egHudModel({ ...E, b: null }, ME, R.now());
  assert.equal(open.sub, 'Answer the call to step through.');
  assert.doesNotMatch(EG_BACK_TEXT.offer, /type|\/breach/i);
  const Ew = foldEg(EG_STATE_EMPTY, wire(egStateOf(R.B, R.now())), R.now());
  R.B.mem[ME].recall = 0; R.B.mem[ME].alive = 0; R.B.mem[ME].wit = 1;
  const W = foldEg(EG_STATE_EMPTY, wire(egStateOf(R.B, R.now())), R.now());
  assert.doesNotMatch(egSpireHudModel(W, ME, R.now(), { witness: true }).stage, /\/breach|type/i);
  assert.doesNotMatch(egHudModel(W, ME, R.now(), { inSpire: true, witness: true }).line, /\/breach|type/i);
  void Ew;
  const C = rd('src/scenes/eliteGates/egClient.js');
  assert.ok(!C.includes('/breach forsake again to go.') && C.includes('Forsake the breach? Your recall is lost. Forsake again to go.'));
  assert.ok(!C.includes('type /breach then to step through') && C.includes('Step through the arch, or answer the call where you stand.'));
  const doc = fakeDocument();
  destroyEgHud();
  drawEgPanel({ offer: null, asks: [{ q: 'ready', title: 'Ready?', opts: ['Not yet', 'Ready'], left: 5000, mine: null, tally: [] }] }, { doc, touch: true });
  assert.ok(find(doc.body, 'eg-k-foot').some((n) => n.textContent === 'Tap a card or a choice.'));
  destroyEgHud();
});

// ── L3-10 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-10 THE GATHER\'S RING AND *1 OF 2 HERE* (section 7 - "a ring fills over the plate, *3 of 6 here*"): the director says each member\'s `here` on the company row as their pose reaches the arrival plate (`co`, the row\'s eleventh), the wire keeps it (a row of ten still taken; any other value refused), the stage line counts it and a gold ring over the plate\'s rim fills by its share - nothing for a company of one (mutants: the `here` unsaid; the wire dropping it; the count from the wrong company; the ring\'s fill)', (t) => {
  const R = spire(t, { n: 2, h: 7, sg: 'arrive' });
  const spec = egHallOf(77, 7, 0);
  R.B.pulledAt = R.now(); R.B.su = R.now() + 30_000;
  R.tell(egStateOf(R.B, R.now()));
  const words = [];
  const out = egStep(R.B, R.now(), [{ sub: ME, sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, dead: false, at: R.now() }, { sub: 'acct-1', sx: spec.x0 + spec.arrive.x, z: spec.arrive.z + 30, dead: false, at: R.now() }], rngOf());
  for (const w of out) { words.push(w.k); R.tell(w); }
  assert.ok(words.includes('co'), 'the here said');
  const E = R.client.state();
  assert.equal(egMemberOf(E, ME).here, true);
  assert.equal(egMemberOf(E, 'acct-1').here, false);
  assert.deepEqual(egGatherOf(E), { here: 1, n: 2 });
  assert.equal(egHereText(1, 2), '1 of 2 here.');
  assert.match(egSpireHudModel(E, ME, R.now()).stage, / 1 of 2 here\.$/);
  const ring = egSpireLights(E, R.now(), { palette: EG_DANGER_PALETTES.standard }).filter((l) => l.k === EG_LIGHT_KIND.ring);
  assert.equal(ring.length, 1);
  assert.equal(ring[0].f, 0.5, 'half the company here');
  assert.equal(ring[0].r, spec.arrive.r);
  // before the breach's first wake the hall waits for the whole company, entered or not (net/eliteGates/egBrain.js's arrive step)
  assert.deepEqual(egGatherOf({ wk: 0, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1, 1], ['acct-1', 'Ann', 2, 1, 0, 0, 0, 0, 0, 1, 0]] }), { here: 1, n: 2 });
  assert.deepEqual(egGatherOf({ wk: 1, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1, 1], ['acct-1', 'Ann', 2, 1, 0, 0, 0, 0, 0, 1, 0]] }), { here: 1, n: 1 }, 'past it, the living entrants');
  // the wire: a row of ten taken, an eleventh 0 or 1 alone
  const row10 = [ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1];
  assert.ok(validEgOut({ k: 'co', co: [row10] }));
  assert.ok(validEgOut({ k: 'co', co: [[...row10, 1]] }));
  assert.equal(validEgOut({ k: 'co', co: [[...row10, 2]] }), null);
  // a company of one: nothing to gather
  const S = spire(t, { n: 1, h: 7, sg: 'arrive' });
  const E1 = foldEg(EG_STATE_EMPTY, wire(egStateOf(S.B, S.now())), S.now());
  assert.equal(egSpireLights(E1, S.now(), {}).filter((l) => l.k === EG_LIGHT_KIND.ring).length, 0);
  assert.doesNotMatch(egSpireHudModel(E1, ME, S.now()).stage, /here/);
});

// ── NEW-1 / L2-9's card ─────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V NEW-1 / L2-9 THE REST CARD ON THE SPIRE\'S OWN HUD (sections 14 and 16.3 - "Ashen Vigil: the next rest heals half; the rest card says so"; "The rest card shows the stake"): the rest\'s stage line carries the stake (AUDIT EG III\'s line, drawn before by the tracker alone, which the Spire\'s HUD replaces inside a breach) and a heal of less than whole with what made it less (mutants: the stake undrawn; the share unsaid; its reason)', (t) => {
  const R = spire(t, { n: 2, h: 10, sg: 'rest' });
  R.B.dc = [[EG_DECREE_BY_KEY.ashen.id, 2]];
  R.B.mem[ME].rel = [1, 2];
  const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(R.B, R.now())), R.now());
  const run = { rw: [1, 2] };
  assert.equal(egRestLine(E, run, 0.25), `${egStakeText([1, 2])}. The rest heals 25%: Ashen Vigil II.`);
  assert.equal(egRestLine({ ...E, dc: [], td: 'hungering' }, { rw: [] }, 0.5), 'The rest heals 50%: Hungering Dark.');
  assert.equal(egRestLine(E, { rw: [] }, 1), '');
  const m = egSpireHudModel(E, ME, R.now(), { restP: 0.25 });
  assert.ok(m.stage.includes(egStakeText(E.ms.find((r) => r[0] === ME)[8])), 'the stake on the rest card');
  assert.ok(m.stage.includes('The rest heals 25%: Ashen Vigil II.'));
});

// ── L8-6 / L7-10 ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L8-6 THE WEIR KEY\'S CARD SAYS ITS LINE (section 5 - "its line: *One of the Spire\'s portal keys ...*"): its info box is built as the Portal Stone\'s - its name, its weight and EG_TEXT.keyLine (mutants: the arm gone; another line)', () => {
  const rows = itemInfoRows(weirKeys(2), () => null);
  assert.ok(rows.some((r) => r.text === EG_TEXT.keyLine), 'the key\'s line');
  assert.equal(rows[0].text, EG_TEXT.keyName);
});

test('AUDIT EG V L7-10 THE SPIRE\'S ACCESSIBILITY ROWS IN THE PLAYER\'S LANGUAGE (L10N4; section 27.9): the three rows\' names and notes and the four palettes\' names go through the text core, each a catalog key the thirteen whole languages hold (mutants: a row\'s literal back; a palette\'s name English alone)', () => {
  const M = rd('src/ui/enhanced/enhancedMenu.js');
  const body = M.slice(M.indexOf('function spireAccessRows() {'), M.indexOf('  return [motion, palette, fill];'));
  assert.doesNotMatch(body, /prefRow\('reducedMotion', '/);
  for (const k of ['menu.spire.motion.name', 'menu.spire.motion.note', 'menu.spire.palette.name', 'menu.spire.palette.note', 'menu.spire.fill.name', 'menu.spire.fill.note']) assert.ok(body.includes(`t('${k}', `), k);
  assert.match(rd('src/ui/eliteGates/egAccess.js'), /get name\(\) \{ return t\('menu\.spire\.palette\.contrast', 'High contrast'\); \}/);
  assert.equal(EG_DANGER_PALETTES.tritan.name, 'Tritan');
  const en = rd('locales/en/Port_Strings.csv');
  for (const lang of ['bg', 'cs', 'da', 'de', 'es', 'fr', 'id', 'it', 'ko', 'nb', 'pt-BR', 'ro', 'ru']) {
    const csv = rd(`locales/${lang}/Port_Strings.csv`);
    for (const k of ['menu.spire.motion.name', 'menu.spire.palette.contrast', 'eg.cmd.inside', 'eg.gather.here']) { assert.ok(en.includes(`\n${k},`)); assert.ok(csv.includes(`\n${k},`), `${lang} ${k}`); }
  }
});

// ── a fake document (EG-G1's, test/net/eliteGates/egpres_hud.test.js) ───────────────────────────────────────────────────────────────
function fakeDocument() {
  const doc = {};
  const node = (tag) => {
    const style = { setProperty(k, v) { style[k] = v; }, getPropertyValue(k) { return style[k] ?? ''; } };
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, _text: '', _cls: '', style };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); if (v === '') n.children = []; } });
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = String(v); } });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.replaceChildren = (...cs) => { n.children = []; n.append(...cs); };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.removeEventListener = () => {};
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
void settle;
