// VEIN-NEED (FIELD BUGS 2026-09-29h; Dunkitay on the Discord, through Mac: "how do i mine this, if i use the pick axe
// it says 'you cannot mine in here!'"). A dungeon's Silver vein under the look, the prompt "[E] Mine Silver - needs
// Mining 25", the chip "Mining 0 - 0 / 60 today". Neither of the player's two gestures said why. E at a node that
// cannot be worked passes the press on (AUDIT 29 C1: to the door, the chest or the foe it was meant for) - and with
// nothing else under the ray it opened nothing and said nothing: the prompt's key a drawn door, PROF1's "an act
// started, or what it needs said" without its second half. The pack's Pick-Axe is Foraging's own use, and "You cannot
// mine in here!" is the mod's line (FORAGE0 law 1, Mac's) - kept, and left to Mac. VEIN-NEED: a press a node passed
// on that opened nothing else has the node say what it needs, the player's own rank beside a rank that is short.
// bible/01-Overview/Field-Bugs-2026-09-29h.md.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createProfBook } from '../src/net/profBook.js';
import { dungeonVeins, dveinKey, utcDayOfMs } from '../src/net/nodeLaw.js';
import { xpForRank } from '../src/net/professionLaw.js';
import { mineKind, minePlan, DUNGEON_SKIP } from '../src/scenes/mineHost.js';
import { herbKind, patchPlan } from '../src/scenes/herbHost.js';
import { treePlan } from '../src/scenes/treeHost.js';
import { createGatherHost, aimAt, needLine } from '../src/scenes/gatherHost.js';
import { setForagingHost, useForagingTool, createForagingItem } from '../src/systems/foragingInstall.js';
import { FT, FORAGING_REFUSALS, foragingRefusal } from '../src/systems/foragingLaw.js';
import { registerPresenter } from '../src/systems/notify.js';
import { _resetModSettings } from '../src/systems/modSettings.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const WOODS = 231, GLENUMBRA = 59;
const NOON = 20500 * 86_400 + 43_200;
/** A dungeon nobody has confirmed: every vein its least, tier 3 - Silver (PROF0 23), as the report's. */
const DUNGEON = 88;
/** Where Foraging's checks stand underground: DFU sets IsPlayerInside in a dungeon too (FORAGE0 5). */
const UNDERGROUND = Object.freeze({ inside: true, insideDungeon: true, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });
/** Each vein on the wall two metres out along its bearing, at chest height - the dungeon's own ray, stood in. */
const wall = (marker, bearing) => [Math.sin(bearing) * 2, 1.2, Math.cos(bearing) * 2];

/** The gathering host underground, its book a real one over a scripted door: `rank` Mining, a Pick-Axe unless `pick`
 *  is false, the dungeon entered and its veins stood. */
async function underground({ rank = 0, pick = true } = {}) {
  const day = utcDayOfMs(NOON * 1000);
  const tracks = [{ profession: 'mining', xp: xpForRank(rank), rank, specs: { 50: null, 100: null } }];
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks, today: {}, taken: [], stores: [], caps: { stores: 5000, withdraw: 200, highHides: 3 } } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    harvest: async () => ({ ok: false, error: 'offline' }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOON * 1000, sleep: noWait });
  const said = [];
  const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: () => {}, toast: (t) => said.push(t), banner: (t) => said.push(`BANNER ${t}`), setChip: () => {}, frame: () => {}, dispose: () => {} };
  const entity = { items: pick ? [{ templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }] : [], stats: {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  const host = createGatherHost({
    book, hud, kinds: [herbKind({ book }), mineKind({ book })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map(), pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => null, nowMs: () => NOON * 1000,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => false, activeDungeon: () => true,
  });
  setForagingHost({ world: () => UNDERGROUND });
  await book.refresh();
  host.enterDungeon({ id: DUNGEON, climate: WOODS, region: GLENUMBRA, wall, stand: async () => ({}), drop: () => {} });
  for (let i = 0; i < 4; i++) await tick();
  const veins = dungeonVeins({ dungeon: DUNGEON, day, climate: WOODS, confirmed: false });
  /** Stand a metre and a half from a vein and look at it; the host finds its target. */
  const face = (v) => {
    const at = wall(v.marker, v.bearing);
    feet[0] = at[0] - Math.sin(v.bearing) * 1.5; feet[1] = 0; feet[2] = at[2] - Math.cos(v.bearing) * 1.5;
    const a = aimAt([feet[0], 1.6, feet[2]], [at[0], at[1] + 0.4, at[2]], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    host.tick(0.016);
    return dveinKey({ dungeon: DUNGEON, day, slot: v.slot });
  };
  /** Look away from every vein. */
  const away = () => { view.yaw += 90; view.pitch = 80; host.tick(0.016); };
  return { host, book, said, veins, face, away };
}

test('VEIN-NEED: the report, reproduced - Silver at Mining 0: E passes the press on, and with nothing else under the ray the vein says what it needs', async () => {
  try {
    const t = await underground({ rank: 0 });
    assert.ok(t.veins.length >= 1 && t.veins.every((v) => v.tier === 3 && v.material === 'metal:silver'), 'an unconfirmed dungeon: Silver, tier 3');
    const key = t.face(t.veins[0]);
    assert.equal(t.host.target?.node.key, key, 'the vein under the look is the target');
    assert.deepEqual([t.said.prompt?.key, t.said.prompt?.verb, t.said.prompt?.rest], ['E', 'Mine Silver', 'needs Mining 25'], 'the screenshot\'s prompt');
    assert.equal(t.host.press(), false, 'AUDIT 29 C1 stands: not ready, the press goes on to the door, the chest or the foe');
    assert.equal(t.host.acting(), false);
    assert.deepEqual([...t.said], [], 'nothing said yet - the ladder has the press');
    // the ladder found nothing under the ray: the host hands the press back
    assert.equal(t.host.sayNeed(), true, 'the vein speaks');
    assert.deepEqual([...t.said], ['Mine Silver: needs Mining 25 - your Mining is 0']);
    assert.equal(t.host.sayNeed(), false, 'one press, one line');
    assert.equal(t.said.length, 1);
  } finally { setForagingHost(null); }
});

test('VEIN-NEED: the pack\'s Pick-Axe is Foraging\'s own use - "You cannot mine in here!" is the mod\'s line, and the vein\'s act never asks it', () => {
  _resetModSettings();
  const heard = [];
  registerPresenter({ hudText: (line) => { heard.push(line); return true; }, priority: 99 });
  const entity = { stats: { intelligence: 50, agility: 50, strength: 50, endurance: 50, luck: 50 }, items: [] };
  setForagingHost({ world: () => UNDERGROUND, monthValue: () => 9, entity: () => entity, startQuest: () => true });
  try {
    const pick = createForagingItem(FT.PickAxe);
    const r = useForagingTool(pick, [pick], { entity });
    assert.equal(r?.refused, true);
    assert.deepEqual(heard, ['You cannot mine in here!'], 'the mod\'s line, 1:1 (FORAGE0 law 1)');
    assert.equal(FORAGING_REFUSALS[FT.PickAxe].inside, 'You cannot mine in here!');
    assert.equal(pick.currentCondition, 50, 'a refusal wears nothing');
    assert.equal(foragingRefusal(FT.PickAxe, UNDERGROUND, DUNGEON_SKIP), null, 'a dungeon vein skips inside, settlement, daylight and sea (PROF0 23)');
  } finally { setForagingHost(null); }
});

test('VEIN-NEED: a press the node took says nothing more; no press, no line; a new press forgets the one before', async () => {
  try {
    // Mining 25: the Silver is worked - the press is the node's, an act starts, and there is no need to say
    const worker = await underground({ rank: 25 });
    worker.face(worker.veins[0]);
    assert.equal(worker.said.prompt?.rest, 'Mining 25');
    assert.equal(worker.host.press(), true, 'ready: E starts the act');
    assert.equal(worker.host.acting(), true);
    assert.equal(worker.host.sayNeed(), false, 'the act took the press');
    worker.host.cancel();
    // no press at all: nothing to say
    const idle = await underground({ rank: 0 });
    idle.face(idle.veins[0]);
    assert.equal(idle.host.sayNeed(), false, 'never pressed');
    // a press passed on, then a press with no node under the look: the second press forgets the first
    idle.host.press();
    idle.away();
    assert.equal(idle.host.target, null);
    assert.equal(idle.host.press(), false);
    assert.equal(idle.host.sayNeed(), false, 'the newest press had no node');
    assert.deepEqual([...idle.said], []);
  } finally { setForagingHost(null); }
});

test('VEIN-NEED: what a node says for each thing it lacks - the rank with the player\'s own, a tool, a count, the Stores', async () => {
  try {
    const mid = await underground({ rank: 12 });
    mid.face(mid.veins[0]);
    mid.host.press();
    mid.host.sayNeed();
    assert.deepEqual([...mid.said], ['Mine Silver: needs Mining 25 - your Mining is 12'], 'the rank the book holds, not the node\'s');
    const bare = await underground({ rank: 25, pick: false });
    bare.face(bare.veins[0]);
    assert.equal(bare.host.press(), false);
    assert.equal(bare.host.sayNeed(), true);
    assert.deepEqual([...bare.said], ['Mine Silver: needs a Pick-Axe'], 'no rank short: no rank said');
  } finally { setForagingHost(null); }
  // the words, off each kind's own plan (the kinds mark a rank that is short: `needsRank`)
  const silver = { what: 'dvein', tier: 3, material: 'metal:silver' };
  const mine = (o) => ({ ...minePlan({ node: silver, taken: false, counting: false, rank: 0, pick: true, storesFull: () => false, ...o }), profession: 'mining' });
  assert.equal(needLine(mine({}), () => 0), 'Mine Silver: needs Mining 25 - your Mining is 0');
  assert.equal(mine({}).needsRank, 25);
  assert.equal(needLine(mine({ rank: 25 }), () => 25), '', 'ready: nothing to say');
  assert.equal(needLine(mine({ counting: true }), () => 0), 'That gathering is being counted.');
  assert.equal(needLine(mine({ taken: true }), () => 0), '', 'worked today: its prompt says so, and it is no target');
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): sixty today said 'Mine Silver: Mining 25 - 60 of 60
  // today'; the plan asks no day now, so a day past it is no need
  assert.equal(needLine(mine({ rank: 25, today: 600, cap: 60 }), () => 25), '', 'a day past the old sixty: ready, nothing to say');
  assert.equal(needLine(mine({ rank: 25, storesFull: () => true }), () => 25), 'Mine Silver: Stores full - Silver');
  const oak = { tier: 3, material: 'log:oak' };
  const tree = treePlan({ node: oak, taken: false, counting: false, rank: 4, axe: true, storesFull: () => false });
  assert.equal(tree.needsRank, 25);
  assert.match(needLine({ ...tree, profession: 'logging' }, () => 4), /^Chop \w+: needs Logging 25 - your Logging is 4$/);
  const herb = patchPlan({ patch: { herb: 1, tier: 2 }, taken: () => false, counting: () => false, basket: false, rank: 3, sickle: true, basketTool: false, storesFull: () => false, herbKeyOf: () => null });
  assert.equal(herb.needsRank, 10);
  assert.match(needLine({ ...herb, profession: 'herbalism' }, () => 3), /^Pick .+: needs Herbalism 10 - your Herbalism is 3$/);
  assert.equal(needLine(null, () => 0), '');
});

test('VEIN-NEED: the hosts - each ladder hands the press back at its foot, only when nothing took it, and only for E', () => {
  const m = src('src/scenes/worldModes.js');
  const w = src('src/scenes/world.js');
  // THE DUNGEON (worldModes tryExitDungeon): its nothing-under-the-ray line, lifted off its source and run
  const from = m.indexOf('function tryExitDungeon(');
  const t = m.slice(from, m.indexOf('\n  }\n', from));
  const foot = /\n {4}if \(key === null\) \{ ([^\n]*) \}\n/.exec(t);
  assert.ok(foot, 'the dungeon ladder\'s foot');
  const dungeonFoot = new Function('interact', 'pressCast', 'host', foot[1]);
  const asked = [];
  const host = { profNeed: () => { asked.push('need'); return true; } };
  assert.equal(dungeonFoot(true, false, host), false, 'the ladder still answers that nothing took the press');
  assert.deepEqual(asked, ['need'], 'E: the vein it passed on speaks');
  dungeonFoot(false, false, host);
  dungeonFoot(true, true, host);
  assert.deepEqual(asked, ['need'], 'a click, or a press that cast, asked no node: nothing to hand back');
  assert.doesNotThrow(() => dungeonFoot(true, false, {}), 'a host without the professions');
  const at = t.indexOf('host.profNeed?.()');
  for (const arm of ['host.profPress?.()', 'pickQuestFoe(', 'pickFoe(', 'host.plaquePeerAct?.(', 'pickActivatableHit(', '_enemyArm(RAY_DISTANCE', 'host.csaActivate?.(_pick)']) {
    assert.ok(t.indexOf(arm) >= 0 && t.indexOf(arm) < at, `${arm} has the press before the node's word`);
  }
  assert.match(w, /\n {4}profNeed: \(\) => gatherHost\?\.sayNeed\(\) \?\? false,/, 'the world host hands the mode machine the node\'s word');
  // THE STREET (world.js): the door arm's answer - its first statement, lifted and run
  const cb = /else modes\.tryEnter\(\)\.then\(\(opened\) => \{\n(?: *\/\/[^\n]*\n)* *(if \(!opened && useEdge && gatherHost\?\.sayNeed\(\)\) return;)\n/.exec(w);
  assert.ok(cb, 'the street\'s door arm asks the node first when nothing opened');
  const streetFoot = new Function('opened', 'useEdge', 'gatherHost', `${cb[1]} return 'GRAVE1';`);
  const said = [];
  const g = (answer) => ({ sayNeed: () => { said.push(answer); return answer; } });
  assert.equal(streetFoot(false, true, g(true)), undefined, 'nothing opened, E pressed, the node spoke: the arm ends there');
  assert.equal(streetFoot(false, true, g(false)), 'GRAVE1', 'nothing to say: GRAVE1\'s epitaph arm runs as before');
  assert.equal(streetFoot(true, true, g(true)), 'GRAVE1', 'a door opened: the node is not asked');
  assert.equal(streetFoot(false, false, g(true)), 'GRAVE1', 'a click asked no node');
  assert.equal(streetFoot(false, true, null), 'GRAVE1', 'no gathering host');
  assert.deepEqual(said, [true, false]);
  // ...at the foot of the street's ladder: every arm before it has the press first
  const s0 = w.indexOf('const nodeTook = useEdge');
  const street = w.slice(s0, w.indexOf('}).catch((e) => console.error(e));', s0));
  const here = street.indexOf('gatherHost?.sayNeed()');
  // PIN MOVED (AUDIT HOLDINGS Q4): the sea's arm is handed whether her own trigger wins the ray (the gangway yields to it)
  for (const arm of ['lockOn.toggle(_lockFoe)', 'plaquePeerAct(cam.pos, useFwd)', 'naval?.activate({ boatTrigger: !!_race.boatWins })', '_enemyArm(RAY_DISTANCE, _rivalDist)', 'townTalk.tryActivate(', '_race.gateWins', 'else if (lootKey)', 'quickLootTake(', 'modes.tryEnter()']) {
    assert.ok(street.indexOf(arm) >= 0 && street.indexOf(arm) < here, `${arm} has the press before the node's word`);
  }
});
