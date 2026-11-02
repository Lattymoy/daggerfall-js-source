// AUDIT GATHER (2026-10-26, Mac: "Audit the harvesting and gathering systems ensuring perfection and that nothing is
// broken"; bible/06-Systems/Professions-Arc.md section 55): THE AUDIT'S CLIENT PINS, each failing on the code before its
// fix. The service's two (F2 the Motherlode's clock, F3 the school's bound) are test/net/auditgather_service.test.js.
//   F1 - a CARRIED harvest refused at the seat (progress-seat, trade-held) is kept, asked again with its own rid; one
//        that is not carried, and a carried one refused for anything else, is let go as before.
//   F4 - the profession picker's slot: a picker the slot replaced is gone, not open.
//   F5 - an act on yesterday's node ends at the UTC day's turn: nothing asked, nothing worn, said.
//   F6 - the tug's window is the attribute band's too.
//   F7 - rain wets the herbs: rain or thunder falling narrows the steady hand's window x0.8.
//   F8 - an honest peer's beat a pose is heard at every refresh.
//   F10 - the glow's shimmer squared by hand, never pow of a negative base.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOON, OUTDOORS, WOODS, GLENUMBRA, PX, rig, arrive, tick, memStorage, plainRenderer, dice, bus } from '../gatherRig.mjs';
import { createGatherEar } from '../../src/systems/gatherSounds.js';
import { mineKind } from '../../src/scenes/mineHost.js';
import { motherlodeKey } from '../../src/net/motherlodeLaw.js';
import { veins } from '../../src/net/nodeLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { createProfBook, SEAT_REFUSALS, PROF_SEAT_RETRY_MS, PROF_PUMP_MS } from '../../src/net/profBook.js';
import { MINE_ACT, HERB_ACT, tugWindow, actBand } from '../../src/net/professionLaw.js';
import { utcDayOfMs, parseNodeKey } from '../../src/net/nodeLaw.js';
import { FT } from '../../src/systems/foraging/foragingLaw.js';
import { ACT_GONE_LINE, createGatherHost, aimAt } from '../../src/scenes/gatherHost.js';
import { createFishAct } from '../../src/systems/fishAct.js';
import { createHerbAct } from '../../src/systems/herbAct.js';
import { herbsWet, herbKind } from '../../src/scenes/herbHost.js';
import { setHeardWeather } from '../../src/systems/weather/weatherSim.js';
import { PeerGatherSounds, GATHER_POSE_ACTS, GATHER_POSE_BEATS, PEER_GATHER_CUE_MS } from '../../src/net/peer/peerGather.js';
import { NODE_GLOW_FS } from '../../src/render/nodeGlow.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A book whose door answers `answers` in turn (the last again), carrying (a bag's hands) or not. */
function bookOf(answers, { carried = true } = {}) {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let t = 1_800_000_000_000, n = 0;
  const asked = [];
  const door = { account: () => 'acct1', harvest: async (b) => { asked.push(b); return answers[Math.min(asked.length - 1, answers.length - 1)]; } };
  const carry = {
    held: () => 0, room: () => 100,
    mint: (k, q) => ({ bag: q, pack: 0, left: 0 }), give: (k, q) => ({ bag: q, pack: 0, over: 0 }), take: () => ({ taken: 0, back: () => {} }),
  };
  const book = createProfBook({ door, storage, character: () => 'rchar1', now: () => t, rid: () => `pRID${String(++n).padStart(12, '0')}`, sleep: async () => {}, ...(carried ? { carry } : {}) });
  const harvest = () => book.harvest({ node: 'herb:300:200:20833:0', kind: 'herbs', climate: 231, region: 59, act: {}, at: Math.floor(t / 1000), material: 'p1:18' });
  return { book, asked, harvest, later: (ms) => { t += ms; } };
}

test('AUDIT GATHER F1: a CARRIED harvest whose first answer was lost, then refused at the seat (progress-seat, trade-held), is kept and asked again with its own rid - it may have landed - minutes apart while the seat holds; refused on its FIRST ask it never landed and is let go with the seat\'s own words (AUDIT LOCKPICK D1); a harvest not carried, and a carried one refused for its own sake, is let go (mutants: the seat\'s refusals unread; the carry unasked; a first ask kept; the hold asked every thirty seconds)', async () => {
  assert.deepEqual([...SEAT_REFUSALS], ['progress-seat', 'trade-held']);
  for (const error of SEAT_REFUSALS) {
    // the first ask's answer lost (offline), then the seat refuses: kept, its rid its own, the next ask minutes away
    const b = bookOf([{ ok: false, error: 'offline' }, { ok: false, error, status: 403 }]);
    const r = await b.harvest();
    assert.deepEqual([r.ok, r.kept], [false, true], 'the first answer lost: kept');
    b.later(60_000);
    await b.book.pump(() => {});
    assert.equal(b.asked.length, 2, `${error}: asked again`);
    assert.equal(b.asked[1].rid, b.asked[0].rid, 'with its own rid - a landed one is answered as made');
    assert.equal(b.book.pendingHarvests, 1, `${error}: kept on the seat's refusal`);
    b.later(PROF_PUMP_MS.at(-1) + 1);
    await b.book.pump(() => {});
    assert.equal(b.asked.length, 2, `${error}: not asked again inside the seat's wait`);
    b.later(PROF_SEAT_RETRY_MS);
    await b.book.pump(() => {});
    assert.equal(b.asked.length, 3, `${error}: asked again once it has passed`);
    // refused on its first ask: it never landed - let go, the seat's own words said
    const first = bookOf([{ ok: false, error, status: 403 }]);
    const f = await first.harvest();
    assert.deepEqual([f.ok, f.kept, f.error, first.book.pendingHarvests], [false, undefined, error, 0], `${error}: a first ask refused is let go`);
    const plain = bookOf([{ ok: false, error: 'offline' }, { ok: false, error, status: 403 }], { carried: false });
    await plain.harvest(); plain.later(60_000); await plain.book.pump(() => {});
    assert.equal(plain.book.pendingHarvests, 0, `${error}: a harvest not carried is the service's no`);
  }
  assert.equal(PROF_SEAT_RETRY_MS, 300_000);
  const own = bookOf([{ ok: false, error: 'offline' }, { ok: false, error: 'prof-rank' }]);
  await own.harvest(); own.later(60_000); await own.book.pump(() => {});
  assert.equal(own.book.pendingHarvests, 0, 'a carried harvest refused for its own sake is let go');
});

test('AUDIT GATHER F4: the profession picker answers again once the slot replaced it (the death screen over it) - with no window up the old one is gone, not open; a picker that is up still holds the slot (source pin: profChoose is bootWorld\'s own)', () => {
  const w = src('src/scenes/world.js');
  const at = w.indexOf('const profChoose = (rows, pick) => {');
  assert.ok(at > 0, 'profChoose stands');
  const line = w.slice(at, w.indexOf('\n', w.indexOf('\n', at) + 1));
  assert.match(line, /if \(!listPickerArtLoaded\(\) \|\| \(_profPicker && gamePaused\(\)\)\) return false;/);
  assert.doesNotMatch(line, /\|\| _profPicker\) return false/, 'a picker kept by name alone refused every one after it');
});

test('AUDIT GATHER F5: an act on yesterday\'s node ends at the UTC day\'s turn - nothing asked, the Pick-Axe unworn, the stop said; struck to its end it wore the tool and the service refused it (`prof-day`) (mutants: the day\'s turn ends nothing; the act left standing)', async () => {
  const asked = [];
  const t = await rig({ answer: (b) => { asked.push(b); return { ok: false, error: 'prof-day' }; } });
  const midnight = (Math.floor(NOON / 86_400) + 1) * 86_400;
  t.clock.ms = (midnight - 1) * 1000;   // a second before the turn
  t.host.tick(0.016);
  for (let i = 0; i < 6; i++) await tick();
  const vein = t.host.nodesOf(405, 150).find((n) => n.kind === 'mine' && n.what === 'vein');
  await arrive(t, vein);
  const pick = t.entity.items.find((it) => it.templateIndex === FT.PickAxe);
  assert.equal(parseNodeKey(vein.key).day, utcDayOfMs(t.clock.ms), 'today\'s vein');
  assert.equal(t.host.press(), true);
  for (let n = 0; n < 20 && t.host.acting(); n++) {
    t.input.v = { held: false, attack: false, choice: false };
    t.clock.ms += (MINE_ACT.swingS + 0.01) * 1000;
    t.host.tick(MINE_ACT.swingS + 0.01);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
  }
  t.input.v = { held: false, attack: false, choice: false };
  for (let i = 0; i < 10; i++) { t.host.tick(0.05); await tick(); }
  assert.equal(utcDayOfMs(t.clock.ms), parseNodeKey(vein.key).day + 1, 'the day turned under the act');
  assert.equal(t.host.acting(), false);
  t.gate.answers.forEach((f) => f());
  for (let i = 0; i < 10; i++) await tick();
  assert.deepEqual([asked.length, t.gate.answers.length], [0, 0], 'nothing asked');
  assert.equal(pick.currentCondition, 50, 'the Pick-Axe unworn');
  assert.ok(t.said.includes(ACT_GONE_LINE()), 'the stop said, and why (AUDIT LOCKPICK C14)');
});

test('AUDIT LOCKPICK D3: a Motherlode\'s act ends as its lode sinks - its close, the day\'s last as late as 23:58 UTC - nothing asked, the Pick-Axe unworn, the spot\'s going said; F5 never saw its key (mutant: the lode\'s close unread)', async () => {
  setForagingHost({ world: () => OUTDOORS });
  const day = utcDayOfMs(NOON * 1000), key = motherlodeKey(day, 2), midnight = (day + 1) * 86400;
  assert.equal(parseNodeKey(key), null, 'no node key: the turn alone never ended it');
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap = new Uint8Array(128 * 128).fill(2);
  const rocks = veins({ x: PX, y: 150, day, climate: WOODS, region: GLENUMBRA }).map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: PX, py: 150, samples, tilemap, locationRect: null, batches: [], rocks, forest: null };
  const lode = { k: 2, key, x: PX, y: 150, climate: WOODS, region: GLENUMBRA, material: 'ore:ebony', opensAt: midnight - 2 * 3600 - 120, closesAt: midnight - 120, struck: 0 };
  const clock = { ms: (midnight - 150) * 1000 };   // 23:57:30, the lode standing till 23:58
  const lodes = { standingOn: (x, y) => (x === PX && y === 150 && clock.ms / 1000 < lode.closesAt ? [lode] : []), found: () => null, watchFor: () => 'a-watch-receipt', heard: () => {}, refused: () => false };
  const asked = [], said = [], meters = [];
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: utcDayOfMs(clock.ms), character: 'c1', tracks: [{ profession: 'mining', xp: 10 * 25 ** 2, rank: 25, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async (b) => { asked.push(b); return { ok: false, error: 'motherlode-closed' }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => clock.ms, sleep: () => Promise.resolve() });
  const hud = { setPrompt: () => {}, setMeter: (m) => meters.push(m), toast: (l) => said.push(l), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const entity = { items: [{ templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 }, input = { v: { held: false, attack: false, choice: false } };
  const host = createGatherHost({
    book, hud, ear: createGatherEar({ audio: bus(), on: () => false, rand: dice(0.5), install: false }), kinds: [mineKind({ book, lodes })], renderer: plainRenderer(), getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0], built: () => new Map([[`${PX},150`, entry]]), pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => clock.ms,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input.v, active: () => true,
  });
  await book.refresh();
  host.onBuilt(entry);
  for (let i = 0; i < 4; i++) await tick();
  const node = host.nodesOf(PX, 150).find((n) => n.what === 'motherlode');
  assert.ok(node, 'the lode stood');
  const [x, y, z] = node.local; feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
  const at = aimAt([feet[0], feet[1] + 1.6, feet[2]], [x, y + (node.lift ?? 0.3), z], { yaw: 0, pitch: 0 }); view.yaw = -at.yaw; view.pitch = -at.pitch;
  host.tick(0.016); for (let i = 0; i < 6; i++) await tick();
  assert.equal(host.press(), true, 'the strike begun at 23:57:30');
  for (let s = 0; s < 40 && host.acting(); s++) { clock.ms += 1000; host.tick(1); await tick(); }
  assert.equal(host.acting(), false, 'ended at the close');
  assert.ok(clock.ms / 1000 <= lode.closesAt + 1, 'at the close, not past it');
  for (let i = 0; i < 10; i++) { host.tick(0.05); await tick(); }
  assert.deepEqual([asked.length, entity.items[0].currentCondition], [0, 50], 'nothing asked, the Pick-Axe unworn');
  assert.ok(said.includes(ACT_GONE_LINE()), 'the spot\'s going said');
  assert.equal(meters.at(-1), null, 'its meter taken down (D5)');
});

test('AUDIT GATHER F6: the tug\'s window is the attribute band\'s - FORAGE0 14.4-14.5, "within 600 ms x the band" - as the haul\'s tension band already was (mutant: the band unread)', () => {
  for (const band of [actBand(0), 1, actBand(100)]) {
    for (const angler of [false, true]) assert.equal(createFishAct({ band, angler }).state.tugS, tugWindow(angler) * band, `band ${band}${angler ? ', an Angler' : ''}`);
  }
  assert.ok(createFishAct({ band: actBand(100) }).state.tugS > createFishAct({ band: actBand(0) }).state.tugS, 'a quick hand\'s window the longer');
});

test('AUDIT GATHER F7: rain wets the herbs (5.3) - rain or thunder FALLING narrows the steady hand\'s window x0.8; a turn the dry window takes bruises a wet herb; the word is the street\'s, never the sim\'s over a dry spell (mutants: the wet unread; the window unscaled; thunder dry)', () => {
  assert.equal(HERB_ACT.wet, 0.8);
  assert.deepEqual(['rain', 'thunder', 'clear', 'cloudy', 'overcast', 'fog', 'snow'].map((w) => herbsWet(w)), [true, true, false, false, false, false, false]);
  setHeardWeather('rain');
  assert.equal(herbsWet(), true, 'the street\'s rain');
  setHeardWeather('cloudy');
  assert.equal(herbsWet(), false, 'a dry spell under the sim\'s rain is dry');
  const dry = createHerbAct({ kind: 'steady' }), wet = createHerbAct({ kind: 'steady', wet: true });
  assert.equal(wet.state.window, dry.state.window * HERB_ACT.wet);
  const turn = (a, deg) => { a.tick(0.1, { view: { yaw: 0, pitch: 0 } }); a.tick(0.1, { view: { yaw: deg, pitch: 0 } }); return a.state.bruised; };
  const between = (HERB_ACT.steadyDeg + HERB_ACT.steadyDeg * HERB_ACT.wet) / 2;
  assert.deepEqual([turn(createHerbAct({ kind: 'steady' }), between), turn(createHerbAct({ kind: 'steady', wet: true }), between)], [false, true]);
  assert.equal(turn(createHerbAct({ kind: 'steady', wet: true, gentle: true }), 90), false, 'Gentle Acts still bruise nothing');
  assert.equal(createHerbAct({ kind: 'basket', wet: true }).state.glint, createHerbAct({ kind: 'basket' }).state.glint, 'the rain wets the steady hand alone - the Basket\'s glints stand (AUDIT LOCKPICK D5)');
  // the host's own act: Herbalism's kind reads the fall when the Sickle's steady hand begins
  setForagingHost({ world: () => OUTDOORS });
  const kind = herbKind({ book: { track: () => ({ specs: {} }) } });
  const entity = { items: [{ templateIndex: FT.Sickle, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const begun = (word) => { setHeardWeather(word); return kind.start({ tier: 2, herb: 3, key: 'herb:1:1:1:0' }, { harvest: 'herbs' }, { entity, rank: () => 0 }).act.state.window; };
  assert.equal(begun('rain'), begun('clear') * HERB_ACT.wet, 'the patch\'s act begun in the rain');
});

/** A peer tracing a hide, a new beat every pose (sent at >= 100 ms on its own 60 Hz frames), heard on a receiver drawing
 *  at `hz` - the drawn pose the newest sent at or before the frame. */
function beatsHeard(hz, poses = 120) {
  let t = 0;
  const heard = [];
  const ears = new PeerGatherSounds({ audio: { play3d: (key) => heard.push(key) }, on: () => false, install: false, now: () => t, rand: () => 0.5 });
  const sentAt = [];
  for (let f = 0, last = -Infinity; sentAt.length < poses; f++) { const now = f * (1000 / 60); if (now - last >= 100) { sentAt.push(now); last = now; } }
  const trace = GATHER_POSE_ACTS.indexOf('trace') + 1, slice = GATHER_POSE_BEATS.indexOf('slice');
  for (let f = 0; ; f++) {
    t = 3.3 + f * (1000 / hz);
    let i = -1; while (i + 1 < sentAt.length && sentAt[i + 1] <= t) i++;
    if (i >= sentAt.length - 1 && t > sentAt[sentAt.length - 1] + 200) break;
    ears.update('p', i < 0 ? { yaw: 0 } : { yaw: 0, ga: trace, gb: ((i % 255) + 1) * 16 + slice }, [0, 0, 0], true);
  }
  return { sent: sentAt.length - 1, heard: heard.length };
}

test('AUDIT GATHER F8: an honest peer\'s beat a pose is heard at every refresh - the floor a whole pose dropped one in two at 75 Hz, measured on the receiver\'s own frames (mutant: the floor a pose again)', () => {
  assert.ok(PEER_GATHER_CUE_MS < 100);
  for (const hz of [60, 75, 120, 144, 165]) {
    const r = beatsHeard(hz);
    assert.equal(r.heard, r.sent, `${hz} Hz: ${r.heard} of ${r.sent}`);
  }
});

test('AUDIT GATHER F10: the glow\'s shimmer is squared by hand - pow of a negative base is undefined in GLSL ES 3.00 (8.2) and NaN on a driver that takes exp2(y log2 x) (mutant: pow again)', () => {
  assert.match(NODE_GLOW_FS, /float bq = \(fract\(qy - tm \* [\d.]+ \+ uSeed\) - 0\.5\) \* 8\.0;/);
  assert.match(NODE_GLOW_FS, /float band = exp\(-bq \* bq\) \* across \* up \* \(1\.0 - uStill\);/);
  for (const m of NODE_GLOW_FS.matchAll(/pow\(([^,]+),/g)) assert.match(m[1], /^max\(/, `pow's base never negative: pow(${m[1]}, ...)`);
});
