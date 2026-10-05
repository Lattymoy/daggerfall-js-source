// OW6 - CAMPS ON THE OVERWORLD, THE SAME FOR EVERY PLAYER (2026-09-29, the player: "If a camp is spawned, it should show
// in the overworld"; "Everything needs that persistence between players in the overworld"). The law (world/campShared.js:
// the tags, the groups, the words); two real foe pools over their real frames - a camp stood by one player is a camp at
// the other, marked from its puppets by the host's own grouping (lifted out of scenes/world.js and run); and the handover
// - a camp taken over by an heir stays ONE camp, with its sight and its alert radius; and the host's and the HUD's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './modsOff.js';
import { CAMP_KINDS, campKindCode, campKindOf, CAMP_TAGS_MAX, campTagsOf, validCampTags, groupCamps, campLabel } from '../src/world/campShared.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { CAMP_SIGHT_RADIUS, CAMP_ALERT_RADIUS, PACK_ALERT_RADIUS } from '../src/systems/campEncounters.js';
import { TRAVEL_VIEW_MARK_COLORS } from '../src/ui/travelViewHud.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('OW6 camps law: a group\'s kind on the wire (a camp, a pack, a band stood), the tags a frame carries - a live member\'s alone, junk and repeats dropped, bounded - and a camp\'s words (mutants: the codes swapped, the dead tagged, junk kept, the bound off)', () => {
  assert.deepEqual([...CAMP_KINDS], ['camp', 'pack', 'band']);
  assert.deepEqual(CAMP_KINDS.map(campKindCode), [1, 2, 3]);
  assert.equal(campKindCode('nonsense'), 2, 'anything else a pack');
  assert.deepEqual([1, 2, 3, 0, 4, 1.5, '1'].map(campKindOf), ['camp', 'pack', 'band', null, null, null, null]);
  const foes = new Map([[1, { campId: 7, campKind: 'camp' }], [2, { campId: 7, campKind: 'camp' }], [3, {}], [4, { campId: 9, campKind: 'band' }], [5, { campId: 0 }]]);
  const records = [{ i: 1 }, { i: 2, d: 1 }, { i: 3 }, { i: 4 }, { i: 5 }];
  assert.deepEqual(campTagsOf(records, (r) => foes.get(r.i)), [[1, 7, 1], [4, 9, 3]], 'the live members of camps, the dead and the loose never');
  const heard = validCampTags([[1, 7, 1], [1, 8, 2], [2, 7, 9], [3, 0, 1], [-1, 7, 1], ['4', 7, 1], [5, 9, 3], 'junk', [6, 9]]);
  assert.deepEqual([...heard], [[1, { id: 7, kind: 'camp' }], [5, { id: 9, kind: 'band' }]], 'the first word for a record, junk dropped');
  assert.equal(validCampTags(null).size, 0);
  const many = Array.from({ length: CAMP_TAGS_MAX + 10 }, (_, k) => [k, 1, 1]);
  assert.equal(validCampTags(many).size, CAMP_TAGS_MAX);
  assert.equal(campLabel('Orc', 'camp', 4), 'Orc camp, 4');
  assert.equal(campLabel('Wolf', 'pack', 3), 'Wolf pack, 3');
  assert.equal(campLabel('Orc', 'band', 5), 'Orc band, 5');
  assert.equal(campLabel('Troll', 'camp', 1), 'Troll', 'one alone: its kind');
  assert.equal(campLabel('', 'camp', 2), 'Enemy camp, 2');
});

test('OW6 camps law: THE GROUPS - one entry a camp, where its members stand (their middle), how many, its words by its first member\'s kind (mutants: two camps merged, the middle wrong, the count off)', () => {
  const nameOf = (t) => ({ 7: 'Orc', 3: 'Wolf' })[t] ?? '?';
  const g = groupCamps([
    { camp: 'me:1', kind: 'camp', type: 7, feet: [0, 0, 0] }, { camp: 'me:1', kind: 'camp', type: 7, feet: [6, 0, 0] }, { camp: 'me:1', kind: 'camp', type: 7, feet: [3, 3, 9] },
    { camp: 'amy:1', kind: 'pack', type: 3, feet: [100, 0, 100] },
    { camp: null, kind: 'camp', type: 7, feet: [1, 1, 1] },
  ], nameOf);
  assert.equal(g.length, 2, 'mine and the peer\'s, never merged though both are camp 1');
  assert.deepEqual(g[0], { key: 'me:1', kind: 'camp', n: 3, at: [3, 1, 3], label: 'Orc camp, 3' });
  assert.deepEqual(g[1], { key: 'amy:1', kind: 'pack', n: 1, at: [100, 0, 100], label: 'Wolf' });
  assert.deepEqual(groupCamps([], nameOf), []);
});

// ── two real pools (auditpscale1.test.js's rig) ──────────────────────────────────────────────────────────────────────
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); };
const playerEntity = () => ({ isPlayer: true, level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const rig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});
const clock = { t: 1000 };
const netted = (pool, self) => pool.setNet({ selfId: () => self, room: () => 'world:3,12', inRoom: () => true, peers: () => [], now: () => clock.t, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const settle = () => new Promise((r) => setTimeout(r, 20));

/** The host's grouping (scenes/world.js travelViewCamps), lifted and run over a pool. */
const liftCamps = (pool) => {
  const W = read('src/scenes/world.js');
  const m = /\n {2}function travelViewCamps\(\) \{\n[\s\S]*?\n {2}\}\n/.exec(W);
  assert.ok(m, 'travelViewCamps lifted');
  return new Function('exteriorFoes', 'groupCamps', 'enemyDisplayName', 'riteHost', 'RITE_TEXT', `${m[0]} return travelViewCamps;`)(pool, groupCamps, () => 'Rat', null, null);   // AUDIT WB12d (C15): no breach's faithful here
};
/** A camp of `n` stood by `pool` the way _standCampEncounter stands one: its number the pool's, each member tagged. */
const standCamp = async (pool, n, kind = 'camp', at = [10, 0, 10]) => {
  const id = pool.newCampId();
  const got = await Promise.all(Array.from({ length: n }, (_, k) => pool.spawnFoe(0, [at[0] + k * 2, at[1], at[2]], { feetGiven: true })));
  for (const f of got) { f.campId = id; f.campKind = kind; f.campAlertRadius = kind === 'camp' ? CAMP_ALERT_RADIUS : PACK_ALERT_RADIUS; f.ai.sightRadius = CAMP_SIGHT_RADIUS; f.entity.campId = id; }
  return { id, got };
};

test('OW6 camps: A CAMP STOOD BY ONE PLAYER IS A CAMP AT THE OTHER - its members ride tagged on the owner\'s frame, the reader\'s puppets keep the tag, and the reader\'s Overworld marks one camp where they stand, with its kind and number; my own camps marked beside it; a dead member leaves the count, the last takes the mark (mutants: the tags unsent, the tag not kept, the dead counted)', async () => {
  const owner = createExteriorFoes(rig()); netted(owner, 'own-0001');
  const reader = createExteriorFoes(rig()); netted(reader, 'rdr-0002');
  const { id, got } = await standCamp(owner, 3, 'camp');
  await Promise.all([0, 1].map((k) => owner.spawnFoe(0, [60 + k, 0, 60], { feetGiven: true, loose: true })));   // two loose wanderers: no camp
  const frame = owner.foesFrame(true);
  assert.deepEqual(frame.cz, got.map((f) => [f.seq, id, 1]), 'the camp\'s members tagged, the wanderers not');
  reader.applyFoes('own-0001', frame); await settle();
  const puppets = reader.foes.filter((f) => f.puppet === 'own-0001' && !f.dead);
  assert.equal(puppets.length, 5);
  assert.equal(puppets.filter((f) => f._pupCamp?.id === id && f._pupCamp.kind === 'camp').length, 3, 'the camp\'s three keep its tag');
  const mine = await standCamp(reader, 2, 'pack', [200, 0, 200]);
  const camps = liftCamps(reader)();
  assert.deepEqual(camps.map((c) => [c.key, c.n, c.label]).sort(), [[`me:${mine.id}`, 2, 'Rat pack, 2'], [`own-0001:${id}`, 3, 'Rat camp, 3']].sort());
  const theirs = camps.find((c) => c.key === `own-0001:${id}`);
  assert.deepEqual(theirs.at, [12, 0, 10], 'where its members stand');
  // one of the camp's falls at the owner: the reader's mark counts two; all fall: no mark
  got[0].dead = true;
  reader.applyFoes('own-0001', owner.foesFrame(true)); await settle();
  assert.equal(liftCamps(reader)().find((c) => c.key === `own-0001:${id}`)?.n, 2);
  for (const f of got) f.dead = true;
  reader.applyFoes('own-0001', owner.foesFrame(true)); await settle();
  assert.equal(liftCamps(reader)().some((c) => c.key === `own-0001:${id}`), false, 'its last down: its mark gone');
});

test('OW6 camps: A PUPPET THAT STOOD BEFORE ITS CAMP WAS SAID LEARNS IT FROM THE OWNER\'S NEXT WORD - a member that rode one frame before its camp was set (the stand tags it as its spawn lands) is a camp\'s at the reader from the next frame on (mutants: a standing puppet never tagged)', async () => {
  const owner = createExteriorFoes(rig()); netted(owner, 'own-0001');
  const reader = createExteriorFoes(rig()); netted(reader, 'rdr-0002');
  const got = await Promise.all([0, 1].map((k) => owner.spawnFoe(0, [10 + k * 2, 0, 10], { feetGiven: true })));
  reader.applyFoes('own-0001', owner.foesFrame(true)); await settle();
  assert.equal(liftCamps(reader)().length, 0, 'untagged: no camp yet');
  const id = owner.newCampId();
  for (const f of got) { f.campId = id; f.campKind = 'camp'; }
  reader.applyFoes('own-0001', owner.foesFrame(true)); await settle();
  const puppets = reader.foes.filter((f) => f.puppet === 'own-0001' && !f.dead);
  assert.equal(puppets.length, 2, 'the same two puppets, not two more');
  assert.ok(puppets.every((f) => f._pupCamp?.id === id && f._pupCamp.kind === 'camp'), 'each learns its camp');
  assert.deepEqual(liftCamps(reader)().map((c) => [c.key, c.n]), [[`own-0001:${id}`, 2]]);
});

test('OW6 camps: A CAMP TAKEN OVER STAYS ONE CAMP - its owner leaves (the handover names me heir), and every member becomes ONE camp of mine: a number my own camps never share, its kind, its sixty metres\' sight, its alert radius, CAMP2\'s exemption on the entity; my next frame tags it as mine (mutants: the tag dropped at adopt, a number per member, the sight lost)', async () => {
  const owner = createExteriorFoes(rig()); netted(owner, 'own-0001');
  const heir = createExteriorFoes(rig()); netted(heir, 'heir-0002');
  const mineBefore = await standCamp(heir, 1, 'camp', [300, 0, 300]);
  const { id } = await standCamp(owner, 3, 'pack');
  heir.applyFoes('own-0001', owner.foesFrame(true)); await settle();
  heir.applyFoes('own-0001', owner.handOverFrame(() => 'heir-0002')); await settle();
  const taken = heir.foes.filter((f) => !f.puppet && !f.dead && f.campId != null && f.campId !== mineBefore.id);
  assert.equal(taken.length, 3, 'all three taken');
  const ids = new Set(taken.map((f) => f.campId));
  assert.equal(ids.size, 1, 'one camp, not three');
  const [newId] = ids;
  assert.notEqual(newId, mineBefore.id, 'never one of my own camps\' numbers');
  for (const f of taken) {
    assert.equal(f.campKind, 'pack');
    assert.equal(f.campAlertRadius, PACK_ALERT_RADIUS);
    assert.equal(f.ai.sightRadius, CAMP_SIGHT_RADIUS, 'a camp\'s sixty metres');
    assert.equal(f.entity.campId, newId, 'CAMP2\'s exemption rides with it');
  }
  const next = heir.foesFrame(true);
  assert.deepEqual(next.cz.filter(([, c]) => c === newId).length, 3, 'my frame tags it as mine');
  assert.ok(id >= 1);
  const marks = liftCamps(heir)();
  assert.ok(marks.some((c) => c.key === `me:${newId}` && c.n === 3 && c.label === 'Rat pack, 3'), 'and my Overworld marks it');
});

test('OW6 camps wiring: the host stands each group under the pool\'s one counter with its kind, a band that stands is a band, the Overworld marks every camp; the HUD draws a camp as a tent in the ember', () => {
  const W = read('src/scenes/world.js');
  // MERGE 2: EVERY camp id is the counter's - the camp's stand and the bounty's dungeon pack (a copy of either on its own
  // number would share one with an heir's camp)
  assert.deepEqual([...W.matchAll(/const campId = ([^;]+);/g)].map((m) => m[1]), ['exteriorFoes.newCampId()', 'exteriorFoes.newCampId()']);
  assert.doesNotMatch(W, /_nextCampId/, 'one counter, the pool\'s');
  assert.match(W, /f\.campId = campId; f\.campAlertRadius = hit\.alertRadius;\n\s*f\.campKind = hit\.kind \?\? 'pack';/);
  assert.match(W, /_standCampEncounter\(\{ kind: 'band', mobileTypes: mk\.mobileTypes,/);
  assert.match(W, /\n\s+handOverWalkedAway\(performance\.now\(\)\);   \/\/ OW6/, 'the walk-away handover runs every exterior frame');
  assert.match(W, /for \(const c of travelViewCamps\(\)\) marks\.push\(\{ key: `camp:\$\{c\.key\}`, at: \[c\.at\[0\], c\.at\[1\] \+ 2, c\.at\[2\]\], label: wildCamps\.has\(c\.key\) \? `\$\{WILD_MARK\} \$\{c\.label\}` : c\.label, kind: 'camp', pick: true \}\);/);   // WILD-ALERT: an alerted camp's mark wears the "!"   // OW-ATTACK: pressable
  assert.equal(TRAVEL_VIEW_MARK_COLORS.camp, '#d9622b');
  const hud = read('src/ui/travelViewHud.js');
  assert.match(hud, /\|\| k === 'camp' \? k : 'traveller';/);
  assert.match(hud, /\} else if \(look === 'camp'\) \{[^\n]*\n\s*g\.beginPath\(\); g\.moveTo\(x, y - 6\);/);
});

/** The host's walk-away handover (scenes/world.js handOverWalkedAway), lifted and run against a real owner pool. */
const liftWalkAway = (scope) => {
  const W = read('src/scenes/world.js');
  const a = W.indexOf('  const FOE_WALK_AWAY_MS = 500;'), b = W.indexOf('\n  }\n', W.indexOf('  function handOverWalkedAway(now) {'));
  assert.ok(a > 0 && b > a, 'the walk-away handover lifted');
  const names = Object.keys(scope);
  return new Function(...names, `${W.slice(a, b + 4)} return handOverWalkedAway;`)(...names.map((k) => scope[k]));
};

test('OW6 camps: A CAMP ITS OWNER WALKS AWAY FROM GOES TO THE PLAYER BESIDE IT - past three quarters of its cull distance, with a player nearer it, it is handed over (the door\'s own handover, foe by foe) and taken as one camp; nearer me, or nobody nearer it, it stays mine; my ally never goes (mutants: never handed, handed at any distance, handed to a player farther than me)', async () => {
  const { CAMP_CULL_DISTANCE, ENCOUNTER_CULL_DISTANCE } = await import('../src/scenes/exteriorFoes.js');
  const owner = createExteriorFoes(rig()); netted(owner, 'own-0001');
  const heir = createExteriorFoes(rig()); netted(heir, 'heir-0002');
  const far = 0.75 * CAMP_CULL_DISTANCE + 10;   // 160 m from me: past three quarters of a camp's 200
  const { id, got } = await standCamp(owner, 3, 'camp', [0, 0, far]);
  const near = await standCamp(owner, 1, 'pack', [0, 0, 100]);   // a hundred metres: still mine
  heir.applyFoes('own-0001', owner.foesFrame(true)); await settle();
  const sent = [];
  const scope = {
    online: { room: 'world:3,12', sendFoes: (frame) => { sent.push(frame); return true; } }, isCellRoom: (r) => String(r).startsWith('world:'),
    modes: { mode: 'exterior' }, playerSpawned: true, player: { feetAt: () => [0, 0, 0] }, exteriorFoes: owner, isPrivateQuestFoe: () => false,
    peersNear: () => [{ id: 'heir-0002', feet: [0, 0, far + 5] }], CAMP_CULL_DISTANCE, ENCOUNTER_CULL_DISTANCE,
  };
  const handOver = liftWalkAway(scope);
  assert.equal(handOver(1000), 3, 'the camp\'s three handed over');
  assert.equal(handOver(1100), 0, 'asked again within the half second: nothing');
  assert.equal(owner.foes.filter((f) => !f.dead && f.campId === id).length, 0, 'gone from my pool');
  assert.ok(owner.foes.some((f) => !f.dead && f.campId === near.id), 'the pack a hundred metres off stays mine');
  heir.applyFoes('own-0001', sent[0]); await settle();
  const taken = heir.foes.filter((f) => !f.puppet && !f.dead && f.campId != null);
  assert.equal(taken.length, 3);
  assert.equal(new Set(taken.map((f) => f.campId)).size, 1, 'one camp at the heir');
  assert.ok(taken.every((f) => f.campKind === 'camp'));
  assert.equal(got.length, 3);
  // nobody nearer the camp than I am: it stays, and the cull takes it as it always did
  const lone = createExteriorFoes(rig()); netted(lone, 'own-0003');
  const mine = await standCamp(lone, 2, 'camp', [0, 0, far]);
  const stay = liftWalkAway({ ...scope, exteriorFoes: lone, peersNear: () => [{ id: 'x-0004', feet: [0, 0, -far] }] });
  assert.equal(stay(1000), 0, 'the player is farther from it than I am');
  assert.equal(lone.foes.filter((f) => !f.dead && f.campId === mine.id).length, 2);
  // my ally never goes
  const ally = createExteriorFoes(rig()); netted(ally, 'own-0005');
  const [pet] = await Promise.all([ally.spawnFoe(0, [0, 0, far], { feetGiven: true })]);
  pet.entity.team = 'PlayerAlly';
  assert.equal(liftWalkAway({ ...scope, exteriorFoes: ally })(1000), 0);
});
