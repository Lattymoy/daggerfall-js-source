// LW-LOOKS (2026-10-06, bible/06-Systems/Living-World.md "LW-LOOKS"; Mac: NPCs should "even utilize different sprite
// forms not just the basic npc sprites" - and, asked how, "Class looks + still flats"): WHAT A RESIDENT LOOKS LIKE. Every
// resident walked the town in one of their people's four outfits (LW0 decision 4); a class's sprite was a fighter's gear
// on the road alone (LW3). Now those whose calling is a class's walk the town in it - one with a class of their own, a
// guild hall's own members (their guild's), a temple's priests (the healer's robes) - and one keeping their place alone
// (a beggar at their pitch, a stall-keeper at their stall, a priest at the temple's door, a courtier at home in the
// palace) stands as Daggerfall's own still picture of their kind (systems/livingWorld/looks.js). The town is the synthetic
// one (test/lwTown.mjs); FLATS.CFG the game's own where ARENA2_PATH names the data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { synthTown } from './lwTown.mjs';
import { townClassOf, stillRoleOf, stillFlatOf, STILL_FLATS, GUILD_CLASSES, PRIEST_CLASS } from '../src/systems/livingWorld/looks.js';
import { MAGES_GUILD, FIGHTERS_GUILD, DAY_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { createTravellerSprites, classLookOf } from '../src/world/travellerSprites.js';
import { createLivingIndoors } from '../src/scenes/livingIndoors.js';
import { NPC_FLAT_ARCHIVES } from '../src/world/rdbLayout.js';
import { FlatsFile, flatCensored } from '../src/formats/flatsFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { scaledBillboardSize } from '../src/world/rmbFlats.js';
import { GENERAL_FPS } from '../src/render/flatAnimation.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { BUILDING_TYPES as B } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED, PERSON_TEXTURES } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const RATE = CLASSIC_MINUTES_PER_SECOND;
const R = (id, o = {}) => ({ id, name: id, sex: /** @type {'male'|'female'} */ ('male'), job: 'labourer', cls: null, work: null, faction: 0, ...o });

test('LW-LOOKS the class a resident walks the town in: their own class (an adventurer, a sellsword, a courier); a guild hall\'s own member their guild\'s - the Mages Guild\'s one of the mage\'s, the Fighters Guild\'s one of the warrior\'s, their seed\'s, a knightly order\'s a knight, another faction\'s none; a temple\'s priest the healer\'s robes; the rest - a scholar of the Mages Guild by their trade among them - their own outfit (mutants: the own class, the priest, the guild\'s, the order, the seed)', () => {
  assert.equal(townClassOf(R('a', { job: 'adventurer', cls: M.Sorcerer })), M.Sorcerer);
  assert.equal(townClassOf(R('b', { job: 'courier', cls: M.Rogue })), M.Rogue);
  assert.equal(townClassOf(R('c', { job: 'priest', faction: 21 })), PRIEST_CLASS);
  assert.equal(PRIEST_CLASS, M.Healer);
  assert.equal(townClassOf(R('d', { job: 'guildsman', faction: 368 })), M.Knight, 'a knightly order\'s: a knight');
  assert.equal(townClassOf(R('e', { job: 'guildsman', faction: 108 })), null, 'a hall of another faction: their outfit');
  for (const job of ['scholar', 'smith', 'homemaker', 'courtier', 'guard']) for (const faction of [0, MAGES_GUILD, FIGHTERS_GUILD]) assert.equal(townClassOf(R('f', { job, faction })), null, `${job} (${faction}): their own outfit`);
  for (const [guild, list] of [[MAGES_GUILD, GUILD_CLASSES[MAGES_GUILD]], [FIGHTERS_GUILD, GUILD_CLASSES[FIGHTERS_GUILD]]]) {
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      const cls = townClassOf(R(`L1.${i}`, { job: 'guildsman', faction: guild }));
      assert.ok(list.includes(cls), `${guild}: ${cls} one of the guild's`);
      assert.equal(townClassOf(R(`L1.${i}`, { job: 'guildsman', faction: guild })), cls, 'the same every reader');
      seen.add(cls);
    }
    assert.ok(seen.size >= 4, `${guild}: their seed's - ${seen.size} of the ${list.length}`);
  }
  assert.ok(GUILD_CLASSES[MAGES_GUILD].every((c) => c >= M.Mage && c <= M.Nightblade) && GUILD_CLASSES[FIGHTERS_GUILD].every((c) => c >= M.Monk && c <= M.Knight), 'the guilds\' runs of six');
});

test('LW-LOOKS the still pictures: one keeping their place alone - a beggar at their pitch, a stall-keeper at their stall by their trade (a courier, with a class of their own, keeps it), a priest at their own temple\'s door - stands as their kind\'s, their seed\'s among those of their sex; at any other stay none (mutants: the pitch, the stall, the class kept, the priest\'s door, the sex, the seed)', () => {
  const temple = { building: 1001 };
  assert.equal(stillRoleOf(R('a', { job: 'beggar' }), { kind: 'beg', at: null }), 'beggar');
  for (const [job, role] of [['merchant', 'merchant'], ['crafter', 'crafter'], ['fisher', 'fisher'], ['labourer', 'labourer']]) assert.equal(stillRoleOf(R('b', { job }), { kind: 'stall', at: null }), role);
  assert.equal(stillRoleOf(R('c', { job: 'courier', cls: M.Rogue }), { kind: 'stall', at: null }), null, 'a class of their own kept');
  assert.equal(stillRoleOf(R('d', { job: 'homemaker' }), { kind: 'stall', at: null }), null);
  assert.equal(stillRoleOf(R('e', { job: 'priest', work: 1001 }), { kind: 'social', at: temple }), 'priest', 'at their temple\'s door');
  assert.equal(stillRoleOf(R('f', { job: 'priest', work: 1001 }), { kind: 'social', at: { building: 1003 } }), null, 'another\'s door');
  assert.equal(stillRoleOf(R('g', { job: 'homemaker', work: 1001 }), { kind: 'social', at: temple }), null);
  for (const kind of ['walk', 'market', 'tavern']) assert.equal(stillRoleOf(R('e', { job: 'priest', work: 1001 }), { kind, at: temple }), null, `a priest's ${kind} at their temple: none (a walk there not yet searched stands still)`);
  for (const kind of ['social', 'market', 'walk', 'home']) assert.equal(stillRoleOf(R('h', { job: 'beggar' }), { kind, at: null }), null, `${kind}: none`);
  assert.equal(stillRoleOf(R('i'), null), null);
  // the picture: their sex's (every kind has both), their seed's, the same every reader
  for (const role of /** @type {(keyof typeof STILL_FLATS)[]} */ (Object.keys(STILL_FLATS))) {
    for (const sex of /** @type {const} */ (['male', 'female'])) {
      const list = STILL_FLATS[role][sex];
      assert.ok(list.length > 0, `${role}: a ${sex} picture`);
      const seen = new Set();
      for (let i = 0; i < 160; i++) {
        const f = stillFlatOf(R(`L2.${i}`, { sex }), role);
        assert.ok(list.some(([a, r]) => a === f.archive && r === f.record), `${role} ${sex}: ${f.archive}.${f.record} of their kind`);
        assert.deepEqual(stillFlatOf(R(`L2.${i}`, { sex }), role), f);
        seen.add(`${f.archive}.${f.record}`);
      }
      assert.equal(seen.size, list.length, `${role} ${sex}: every one some one's`);
    }
  }
  for (const kind of Object.values(STILL_FLATS)) for (const list of [kind.male, kind.female]) for (const [a] of list) assert.ok(NPC_FLAT_ARCHIVES.includes(a), `${a}: an NPC flat's archive`);
});

test('LW-LOOKS the still pictures are the game\'s own (ARENA2): each of its kind\'s in FLATS.CFG - its sex FLATS.CFG\'s, none ChildGard censors - and none a tenth taller than the people\'s tallest walker (its cowled old man, 177.0, stands half a metre over them)', { skip: skipReal }, () => {
  const f = new FlatsFile().load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), 'FLATS.CFG'))));
  const texture = (a) => { const t = new TextureFile(); t.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), `TEXTURE.${a}`))), `TEXTURE.${a}`); return t; };
  const heightOf = (t, r) => scaledBillboardSize(t.getSize(r), t.getScale(r)).h;
  let tallest = 0;
  for (const a of new Set(Object.values(PERSON_TEXTURES).flatMap((x) => [...x.male, ...x.female]))) { const t = texture(a); for (let r = 0; r < t.recordCount; r++) tallest = Math.max(tallest, heightOf(t, r)); }
  assert.ok(tallest > 2 && tallest < 2.2, `the people's tallest walker ${tallest.toFixed(2)} m`);
  for (const [role, kind] of Object.entries(STILL_FLATS)) {
    for (const [sex, list] of /** @type {const} */ ([['male', kind.male], ['female', kind.female]])) {
      for (const [a, r] of list) {
        const d = f.getFlatData(a, r);
        assert.ok(d, `${role} ${a}.${r}: in FLATS.CFG`);
        assert.ok(!flatCensored(d.gender), `${a}.${r}: not censored`);
        assert.equal(String(d.gender), sex === 'male' ? '1' : '2', `${role} ${a}.${r} (${d.caption}): ${sex}`);
        const h = heightOf(texture(a), r);
        assert.ok(h <= tallest * 1.1, `${role} ${a}.${r} (${d.caption}): ${h.toFixed(2)} m`);
      }
    }
  }
  assert.ok(heightOf(texture(177), 0) > tallest * 1.2, 'the cowled old man: too tall to stand among them');
});

test('LW-LOOKS the walker as a still picture: its record, its frames on the game\'s billboard clock (GENERAL_FPS) where it has more than one; themselves again after - their class\'s sprite or their outfit; dressed as another, neither (mutants: the picture unread, the clock, the archive back)', () => {
  const w = new ResidentWalker({}, { archive: 385, frameCount: () => 4, groundY: () => 0 });
  w.pos = [0, 0, 0];
  w.still({ archive: 182, record: 59, frameCount: 5 });
  assert.equal(w.archive, 182);
  const frames = [];
  for (let i = 0; i < 10; i++) { const out = w.update(1 / GENERAL_FPS, [5, 1.6, 0], false); assert.equal(out.record, 59); frames.push(out.frame); }
  assert.deepEqual(frames, [1, 2, 3, 4, 0, 1, 2, 3, 4, 0], 'five frames a second, round');
  assert.equal(w.update(0.1, [5, 1.6, 0], true).record, 59, 'held by the politeness gate: still the picture');
  w.still(null);
  assert.equal(w.archive, 385, 'their outfit again');
  w.arm({ ...classLookOf({ cls: M.Mage, sex: 'male' }), frameCount: () => 4 });
  assert.equal(w.cls, M.Mage);
  w.still({ archive: 183, record: 12, frameCount: 1 });
  assert.equal(w.archive, 183);
  w.still(null);
  assert.equal(w.archive, classLookOf({ cls: M.Mage, sex: 'male' })?.archive, 'their class\'s sprite again');
  // armed under the picture (their class's art in while they stand as it): still the picture, the class's after
  w.arm(null);
  w.still({ archive: 183, record: 12, frameCount: 1 });
  w.arm({ ...classLookOf({ cls: M.Healer, sex: 'male' }), frameCount: () => 4 });
  assert.ok(w.archive === 183 && w.update(0.1, [5, 1.6, 0], false).record === 12, 'armed under the picture: still it');
  w.still(null);
  assert.equal(w.archive, classLookOf({ cls: M.Healer, sex: 'male' })?.archive, 'then their class\'s sprite');
  w.still({ archive: 183, record: 12, frameCount: 1 });
  w.setIdentity(386, false);
  assert.ok(w.stillLook == null && w.cls == null && w.archive === 386, 'dressed as another: neither');
});

/** A living town on the synthetic town, its host's art at hand. */
function town(minute) {
  const fx = synthTown({ blocksW: 4, blocksH: 4 });
  const clock = { t: minute };
  const flats = [];
  const lt = new LivingTown(fx.nav, {
    town: { mapId: 24680, blocks: 16, region: 17, people: 3, port: false }, buildings: fx.buildings, doors: fx.doors,
    makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE,
    armOf: (res) => ({ ...classLookOf(res), frameCount: () => 4, sex: res.sex }),
    flatOf: (flat) => { flats.push(flat); return { ...flat, frameCount: 1 }; },
  });
  return { lt, clock, flats };
}

/** The town's path searching run out, till `res`'s place at `t` is laid. */
function searched(lt, res, t) {
  let w = null;
  for (let k = 0; k < 400 && (w = lt.where(res, t, true))?.pending; k++) { lt._paths.cells(1e9); lt._paths.budget(1e9); lt._paths.run(); }
  return w;
}

test('LW-LOOKS on the street: a beggar keeping their pitch alone stands as their still picture - a body coming on there comes on as it; one come to their pitch in the player\'s sight stays themselves till the player looks away (never changed in view); themselves at once as they go on (mutants: the still unread, the unseen, the going on)', () => {
  const day = 100, D = day * DAY_MIN;
  // a beggar who walks to their pitch and keeps it an hour or more, and the walk on after
  const probe = town(D + 9 * 60).lt;
  let beggar = null, to = null, pitch = null, leave = null;
  for (const r of probe.peopleOf(day)) {
    const plan = probe.planOf(r, day);
    const k = plan.findIndex((e, i) => i > 0 && e.kind === 'beg' && e.t1 - e.t0 > 60 && plan[i - 1].kind === 'walk' && plan[i - 1].t1 - plan[i - 1].t0 > 2 && e.t0 > D + 6 * 60);
    if (k < 0) continue;
    beggar = r; to = plan[k - 1]; pitch = plan[k]; leave = plan.find((e) => e.kind === 'walk' && e.t0 >= pitch.t1 - 1e-6);
    break;
  }
  assert.ok(beggar && to && pitch && leave, 'a beggar walking to their pitch, and on after');
  const flat = stillFlatOf(beggar, 'beggar');
  const as = (p) => [p.stillLook?.archive ?? null, p.stillLook?.record ?? null];
  // a body coming on at the pitch: as the still picture (a body not yet stood is seen by nobody)
  {
    const { lt, clock } = town(pitch.t0 + 30);
    const own = lt.peopleOf(day).find((r) => r.id === beggar.id);   // this town's own (the census is every reader's alike)
    const w = searched(lt, own, clock.t);
    assert.ok(w && !w.moving && w.e.kind === 'beg');
    const at = [w.x + 3, 0, w.z];
    const toward = Math.atan2(w.x - at[0], w.z - at[2]);
    for (let i = 0; i < 10; i++) { clock.t += RATE / 30; lt.update(1 / 30, at, toward, [at[0], 1.6, at[2]], true); }
    const row = lt._rowOf(own);
    assert.ok(row?.visible, 'stood, in view');
    assert.ok(!lt._inCircle.has(beggar.id), 'alone at their pitch');
    assert.deepEqual(as(row.person), [flat.archive, flat.record], 'come on as their still picture');
  }
  // one come to their pitch where the player is not looking: never a picture on the move - walking up from their walk's
  // end to their own stand about the spot, themselves; their still picture once they stand
  {
    const { lt, clock } = town(to.t0);
    const own = lt.peopleOf(day).find((r) => r.id === beggar?.id);
    assert.ok(own);
    let came = to.t0 + 0.05;
    while (came < pitch.t0 + 5 && searched(lt, own, came)?.moving) came += 0.02;
    const stand = searched(lt, own, came);
    clock.t = came - 0.4;
    const at = [stand.x + 4, 0, stand.z];
    const away = Math.atan2(stand.x - at[0], stand.z - at[2]) + Math.PI;
    let up = 0;
    for (let i = 0; i < 300; i++) {
      clock.t += RATE / 30; lt.update(1 / 30, at, away, [at[0], 1.6, at[2]], true);
      const row = lt._rowOf(own);
      if (!row?.visible) continue;
      assert.ok(!(row.person.moving && row.person.stillLook), 'a picture never walks');
      if (row.person.moving && lt.where(own, clock.t, false)?.moving === false) up++;
    }
    assert.ok(up > 0, `walked up to their stand off their walk's end (${up} frames)`);
    assert.deepEqual(as(/** @type {any} */ (lt._rowOf(own)).person), [flat.archive, flat.record], 'standing: their still picture');
  }
  // one come to their pitch in the player's sight - two seconds before they get there by their walk's path (a walk comes
  // early and waits at its end, dayPlan.js schedule)
  const { lt, clock, flats } = town(to.t0);
  beggar = lt.peopleOf(day).find((r) => r.id === beggar?.id) ?? null;
  assert.ok(beggar);
  let came = to.t0 + 0.05;
  while (came < pitch.t0 + 5 && searched(lt, beggar, came)?.moving) came += 0.02;
  const stand = searched(lt, beggar, came);
  assert.ok(stand && !stand.moving && came - to.t0 > 0.5, 'come to their pitch by their walk');
  clock.t = came - 0.4;
  const at = [stand.x + 4, 0, stand.z];
  const toward = Math.atan2(stand.x - at[0], stand.z - at[2]);
  const frame = (yaw) => { clock.t += RATE / 30; lt.update(1 / 30, at, yaw, [at[0], 1.6, at[2]], true); };
  let row = null, walked = false;
  for (let i = 0; i < 400; i++) {
    frame(toward);
    row ??= lt._rowOf(beggar);
    if (row?.visible && row.person.moving) walked = true;
    if (walked && row?.visible && !row.person.moving && lt.entryOf(beggar, clock.t)?.e.kind === 'beg' && i > 300) break;
  }
  assert.ok(row?.visible && walked, 'seen walking up to their pitch');
  assert.ok(!row.person.moving && lt.entryOf(beggar, clock.t)?.e.kind === 'beg', 'at their pitch');
  assert.ok(!lt._inCircle.has(beggar.id), 'alone at their pitch');
  {
    assert.deepEqual(as(row.person), [null, null], 'in view: never changed');
    frame(toward + Math.PI);
    assert.deepEqual(as(row.person), [flat.archive, flat.record], 'looked away from: their still picture');
    assert.ok(flats.some((f) => f.archive === flat.archive && f.record === flat.record), 'its art asked of the host');
    for (let i = 0; i < 5; i++) frame(toward);
    assert.deepEqual(as(row.person), [flat.archive, flat.record], 'looked at again: still it');
    // gone on: themselves at once, in view
    clock.t = leave.t0 + 0.5;
    searched(lt, beggar, clock.t);
    for (let i = 0; i < 3; i++) frame(toward);
    assert.ok(row.res?.id === beggar.id && row.person.moving, 'walking on, in view');
    assert.deepEqual(as(row.person), [null, null], 'walking on: themselves, in view');
  }
});

test('LW-LOOKS the street\'s classes: a guild hall\'s own members and a temple\'s priests walk in their calling\'s class through the day, a hall of another faction\'s in their outfit; a body comes on in it; as they were till its art is in, then put on where nobody sees it - never in view (mutants: the town class unworn, the class unseen)', () => {
  const day = 100, D = day * DAY_MIN;
  const { lt, clock } = town(D + 7.5 * 60);
  const callings = lt.peopleOf(day).filter((r) => ['guildsman', 'priest'].includes(r.job) || r.cls != null);
  assert.ok(callings.filter((r) => townClassOf(r) != null).length >= 3);
  let seen = 0, outfits = 0;
  for (const res of callings) {
    // the player beside them on one of their walks
    const walk = lt.planOf(res, day).find((e) => e.kind === 'walk' && e.t1 - e.t0 > 3 && e.t0 > D + 4.5 * 60);
    if (!walk) continue;
    clock.t = walk.t0 + 1;
    const w = searched(lt, res, clock.t);
    if (!w?.moving) continue;
    const at = [w.x + 2, 0, w.z];
    for (let i = 0; i < 6; i++) { clock.t += RATE / 30; lt.update(1 / 30, at, 0, [at[0], 1.6, at[2]], true); }
    const row = lt._rowOf(res);
    if (!row) continue;
    const cls = townClassOf(res);
    assert.equal(row.person.cls ?? null, cls ?? null, `${res.id} (${res.job}): in their calling's class`);
    if (cls != null) { seen++; assert.equal(row.person.archive, classLookOf({ ...res, cls })?.archive); } else { outfits++; assert.equal(row.person.archive, row.person.ownArchive, 'their outfit'); }
  }
  assert.ok(seen >= 2, `callings seen walking in their class (${seen})`);
  // the art not yet in: as they were - then put on where nobody sees it, never in view
  const fx = synthTown({ blocksW: 4, blocksH: 4 });
  const late = { t: D + 10 * 60 };
  let loaded = false;
  const lt2 = new LivingTown(fx.nav, {
    town: { mapId: 24680, blocks: 16, region: 17, people: 3, port: false }, buildings: fx.buildings, doors: fx.doors,
    makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => late.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE,
    armOf: (res) => (loaded ? { ...classLookOf(res), frameCount: () => 4, sex: res.sex } : null),
  });
  const pick = lt2.peopleOf(day).find((r) => townClassOf(r) != null && (() => { const w = searched(lt2, r, late.t); return w && !w.moving && w.e.kind !== 'walk' && lt2.entryOf(r, late.t).e.t1 - late.t > 20; })());
  assert.ok(pick, 'one whose calling is a class\'s, standing a while');
  const w = searched(lt2, pick, late.t);
  const at = [w.x + 3, 0, w.z];
  const toward = Math.atan2(w.x - at[0], w.z - at[2]);
  const frame2 = (yaw) => { late.t += RATE / 30; lt2.update(1 / 30, at, yaw, [at[0], 1.6, at[2]], true); };
  for (let i = 0; i < 10; i++) frame2(toward);
  const row = lt2._rowOf(pick);
  assert.ok(row?.visible, 'stood in view');
  assert.equal(row.person.cls, null, 'its art not in: as they were');
  loaded = true;
  for (let i = 0; i < 10; i++) frame2(toward);
  assert.equal(row.person.cls, null, 'in, but in view: never changed');
  frame2(toward + Math.PI);
  assert.equal(row.person.cls, townClassOf(pick), 'looked away from: in it');
});

test('LW-LOOKS indoors: one whose calling is a class\'s in it; the palace\'s courtiers keeping their place alone stand as the court\'s still pictures - stood as where the player is not looking - a talk target as any; in a circle themselves; nobody else, and in no other building; the fallen on the road no talk target (mutants: the court, the palace, the courtier, the unseen, the still\'s talk)', () => {
  const synced = [];
  const sprites = { sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); }, persons: () => synced.filter((x) => x.talk !== false).map((x) => ({ person: { living: { id: x.res.id } }, pos: x.feet })), batches: () => [], clear() { synced.length = 0; } };
  const lady = { id: 'L9.1', name: 'Lady', sex: /** @type {const} */ ('female'), job: 'courtier', cls: null, home: 7000 };
  const guard = { id: 'L9.2', name: 'Guard', sex: /** @type {const} */ ('male'), job: 'guildsman', cls: null, faction: 41, home: 7000 };
  const st = { key: 7000, type: B.Palace, inside: [lady, guard] };
  const town = { insideAt: (key) => (key === st.key ? st.inside.map((res) => ({ res, e: { kind: 'home' } })) : []), typeOf: () => st.type, dayOf: () => 100, o: { relations: () => null } };
  const room = { move(q, dx, dy, dz) { q[0] = Math.max(-5.7, Math.min(5.7, q[0] + dx)); q[2] = Math.max(-4.7, Math.min(4.7, q[2] + dz)); q[1] += dy; } };
  const enter = () => createLivingIndoors({ sprites, building: () => ({ key: st.key, town }), collider: () => room, floorAt: () => 0, origin: () => [0, 0, 0], staticFeet: () => [], clock: () => 1000 });
  // LW-ROOMS: PIN MOVED - the room's places all over it, so the way in is looked at her own place (the first cut's put
  // her before the player's every look): found by a first visit, the room the same for every one
  const first = enter();
  first.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const hers = first.stood().find((x) => x.id === 'L9.1')?.at ?? [0, 0, 1];
  first.clear();
  const layer = enter();
  layer.frame(0.016, [0, 0, 0], Math.atan2(hers[0], hers[2]), [0, 1.6, 0]);
  const of = (id) => synced.find((x) => x.res.id === id);
  assert.equal(of('L9.2')?.res.cls, townClassOf(guard), 'a guild\'s own in their guild\'s class');
  assert.ok(GUILD_CLASSES[FIGHTERS_GUILD].includes(of('L9.2')?.res.cls));
  assert.deepEqual(of('L9.1')?.flat, stillFlatOf(lady, 'court'), 'the court\'s still picture, stood on the way in');
  assert.equal(of('L9.2')?.flat, null, 'nobody else');
  // in a circle: herself at once, in view or not; alone again, her still picture where the player is not looking
  const her = layer.stood().find((x) => x.id === 'L9.1'), him = layer.stood().find((x) => x.id === 'L9.2');
  assert.ok(her?.at && her.table >= 0 && her.table === him?.table, 'at one table');
  const look = Math.atan2(her.at[0], her.at[2]);
  Object.assign(town, { talkBeat: () => ({ roundMin: 4, lineMin: 0.25 }), lineCtx: () => ({}) });
  layer.frame(0.016, [0, 0, 0], look, [0, 1.6, 0]);
  assert.equal(of('L9.1')?.flat, null, 'in a circle: herself, in view');
  Object.assign(town, { talkBeat: () => null });
  layer.frame(0.016, [0, 0, 0], look, [0, 1.6, 0]);
  assert.equal(of('L9.1')?.flat, null, 'alone again, in view: never changed');
  layer.frame(0.016, [0, 0, 0], look + Math.PI, [0, 1.6, 0]);
  assert.deepEqual(of('L9.1')?.flat, stillFlatOf(lady, 'court'), 'looked away from: the court\'s still picture');
  // on the way in at a table with company: herself from the first frame (the court read by this frame's circles)
  Object.assign(town, { talkBeat: () => ({ roundMin: 4, lineMin: 0.25 }) });
  const again = createLivingIndoors({ sprites, building: () => ({ key: st.key, town }), collider: () => room, floorAt: () => 0, origin: () => [0, 0, 0], staticFeet: () => [], clock: () => 1000 });
  again.frame(0.016, [0, 0, 0], look, [0, 1.6, 0]);
  assert.ok(of('L9.1') && of('L9.1')?.flat == null, 'on the way in, in a circle: herself');
  Object.assign(town, { talkBeat: () => null });
  // in another building: none
  st.type = B.Tavern; st.key = 7001;
  const other = createLivingIndoors({ sprites, building: () => ({ key: 7001, town }), collider: () => room, floorAt: () => 0, origin: () => [0, 0, 0], staticFeet: () => [], clock: () => 1000 });
  other.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.equal(of('L9.1')?.flat ?? null, null, 'in a tavern: herself');
  // the sprites: a resident's still picture a talk target, the fallen none; its frames on the billboard clock
  const renderer = { textures: new Set(), createBillboardBatch: (archive) => ({ archive, origin: null }), destroyBillboardBatch: () => {} };
  const drawn = createTravellerSprites({ renderer, getTexture: (a) => ({ archive: a, getFrameCount: () => 3, getSize: () => ({ width: 50, height: 90 }), getScale: () => ({ width: 0, height: 0 }) }), uploadRecordFrame: () => {} });
  const list = [{ key: 'in:L9.1', res: lady, feet: [0, 0, 0], yaw: 0, moving: false, distM: 2, flat: { archive: 180, record: 1 } }, { key: 'fallen', res: { id: 'x', name: 'x' }, feet: [3, 0, 0], yaw: 0, moving: false, distM: 3, talk: false, flat: { archive: 400, record: 2 } }];
  drawn.sync(list, { dt: 0 });
  return Promise.resolve().then(() => Promise.resolve()).then(() => {
    drawn.sync(list, { dt: 0 });
    const seats = drawn.persons();
    assert.equal(seats.length, 1, 'the fallen no talk target');
    assert.equal(seats[0].person.living.id, 'L9.1', 'a resident\'s still picture one');
    assert.ok(drawn.bodyOf('fallen') && drawn.bodyOf('fallen')?.person == null, 'the fallen: nobody - never a speaker');
    assert.equal(drawn.bodyOf('in:L9.1')?.anim?.frameCount, 3, 'its frames on the clock');
  });
});

test('LW-LOOKS the host: a still picture\'s art loaded into the people\'s own table as a class\'s is, and its record\'s frames; the town handed it (mutants: the flats unhanded)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const livingFlatOf = \(flat\) => \{/);
  assert.match(w, /return \{ archive: flat\.archive, record: flat\.record, frameCount: Math\.max\(1, tex\.getFrameCount\(flat\.record\)\) \};/);
  assert.match(w, /armOf: livingArmOf, flatOf: livingFlatOf,/);
});
