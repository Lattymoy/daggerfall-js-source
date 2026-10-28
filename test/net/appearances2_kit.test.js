// APPEARANCES-II (2026-10-27; bible/04-Characters/Wardrobe.md section 6): A SWORN ONE'S KIT CARRIES ITS LOOK. A piece the
// player dressed at the Wardrobe and gave a sworn revenant is drawn in its look on the owner's screen (net/remotePlayers.js
// composeLook's `ap`); its foe record's kit now carries that look too (`la` beside `lw`, characters/foeBodies.js), the
// wire keeps it only of its piece's kind (net/wire.js validFoeRecord), and every other screen draws it through drawnPiece.
// Driven through the street pool's own puppet path (scenes/exteriorFoes.js), on the producers' own pieces.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { foeLook, foeWireLook, decodeWorn, kitWire } from '../../src/characters/foeBodies.js';
import { validFoeRecord, LOOK_GROUPS } from '../../src/net/wire.js';
import { peerStubEntity } from '../../src/net/remotePlayers.js';
import { drawnPiece, lookOfKey } from '../../src/net/appearanceLaw.js';
import { noteHeldLooks, wearAppearance } from '../../src/systems/appearances.js';
import { applySwornGear } from '../../src/systems/revenant/revenantGear.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { equipItem, unequipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { MOBILE_TYPES as M } from '../../src/characters/mobile/mobileTypes.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';

// ---- the street's pool on crafted data (test/characters/mwnpc_audit2.test.js's rig): a class's career and the room's net
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 8; v.setUint16(52, 4, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; }
function classCfg() { const b = new Uint8Array(80); const v = new DataView(b.buffer); v.setUint16(52, 10, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; }
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const out = new Uint8Array(4 + records.reduce((a, [, b]) => a + b.length, 0) + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return classCfg(); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 5, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const netFor = (self) => ({ selfId: () => self, room: () => 'world:3,12', onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const settle = () => new Promise((r) => setTimeout(r, 0));
async function spawnSeeded(pool, mobileType, feet) {
  const rnd = Math.random;
  let s = 7;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try { return await pool.spawnFoe(mobileType, feet, { feetGiven: true }); } finally { Math.random = rnd; }
}

const KATANA = '121.7.0';   // an Ebony Katana
/** A Steel longsword the player dressed as an Ebony Katana at the Wardrobe (its fee paid), then took off - the
 *  Wardrobe's mark stays on the piece - and its plain twin. */
function dressedSword() {
  const me = { items: [], goldPieces: 2000 };
  const sword = createWeapon(WEAPONS.Longsword, 1), katana = createWeapon(WEAPONS.Katana, 7);
  me.items.push(sword, katana);
  equipItem(me, sword);
  noteHeldLooks(me);
  assert.equal(wearAppearance(me, sword, lookOfKey(KATANA)).ok, true, 'dressed at the Wardrobe');
  unequipItem(me, sword);
  return { sword, twin: createWeapon(WEAPONS.Longsword, 1) };
}
/** The sworn one's record, its weapon slot the piece given (systems/revenant/revenantGear.js wornGear). */
const sworn = (weapon) => ({ id: 'rv1', sworn: true, mobileType: M.Knight, rank: 5, companion: { gear: { weapon } } });
const held = (look) => look.items.find((it) => it.equipSlot === EQUIP_SLOTS.RightHand);

test('APPEARANCES-II THE KIT SAYS ITS LOOK: a sworn one given a piece in a look wears it so on the owner\'s screen, and its record carries the look beside the kit - `la` [the piece\'s index in `lw`, t, m, v], each `lw` piece its six numbers as ever, a kit with no look none of it; another screen\'s puppet is the owner\'s man in that look, drawn through drawnPiece (mutants: the look never encoded; the look never decoded; the decoder\'s index; the record\'s `la` unread by the wire)', async () => {
  const owner = createExteriorFoes(poolRig()); owner.setNet(netFor('mac-0001'));
  const reader = createExteriorFoes(poolRig()); reader.setNet(netFor('bob-0002'));
  const knight = await spawnSeeded(owner, M.Knight, [10, 0, 10]);
  const bare = owner.foesFrame(true).f[0];
  assert.ok(Array.isArray(bare.lw) && bare.lw.length > 0, 'the rolled kit rides');
  assert.equal('la' in bare, false, 'a kit with no look says none - its bytes as they were');
  const { sword } = dressedSword();
  assert.equal(applySwornGear(knight.entity, sworn(sword)), 1, 'given');
  assert.deepEqual(held(foeLook(knight)).ap, [121, 7, 0], 'on the owner\'s screen: the look it wears');
  const rec = owner.foesFrame(true).f[0];
  const at = rec.lw.findIndex((p) => p[0] === EQUIP_SLOTS.RightHand);
  assert.deepEqual(rec.lw[at].slice(0, 4), [EQUIP_SLOTS.RightHand, LOOK_GROUPS.indexOf('Weapons'), WEAPONS.Longsword, 1], 'the piece\'s own numbers');
  assert.ok(rec.lw.every((p) => p.length === 6), 'every piece six numbers - a reader before this one still reads the kit');
  assert.deepEqual(rec.la, [[at, 121, 7, 0]], 'and its look beside it');
  assert.deepEqual(validFoeRecord(rec).la, rec.la, 'through the wire\'s own door');
  assert.equal(reader.applyFoes('mac-0001', { ...owner.foesFrame(true) }), true);
  await settle();
  const pup = reader.foes.find((f) => f.puppet === 'mac-0001');
  assert.deepEqual(foeLook(pup), foeLook(knight), 'one man, one kit, one look on both machines');
  const stand = peerStubEntity(foeLook(pup)).equip.slots[EQUIP_SLOTS.RightHand];
  assert.deepEqual(stand.appearance, { t: 121, m: 7, v: 0 }, 'the body\'s stand-in wears it');
  assert.deepEqual([drawnPiece(stand).templateIndex, drawnPiece(stand).material], [WEAPONS.Katana, 7], 'drawn as the Ebony Katana');
  assert.equal(stand.templateIndex, WEAPONS.Longsword, 'the piece itself still a longsword');
  // the codec alone: the look onto its own piece, by index
  assert.deepEqual(decodeWorn(rec.lw, rec.la)[at].ap, [121, 7, 0]);
  assert.equal(decodeWorn(rec.lw, rec.la).filter((it) => it.ap).length, 1, 'that piece alone');
  assert.equal(decodeWorn(rec.lw).some((it) => it.ap), false, 'a kit without `la` wears its own');
});

test('APPEARANCES-II THE LOOK CHANGES THE KIT: the gift swapped for its plain twin is a new body on the owner\'s screen and a new record - its look gone on every screen; a newer word landing while a puppet builds keeps the look the first one carried; an heir streams the very look on (mutants: the body\'s key blind to the look; the record\'s key blind to it; the pending build forgets it; the heir drops it)', async () => {
  const owner = createExteriorFoes(poolRig()); owner.setNet(netFor('mac-0001'));
  const reader = createExteriorFoes(poolRig()); reader.setNet(netFor('bob-0002'));
  const knight = await spawnSeeded(owner, M.Knight, [10, 0, 10]);
  const { sword, twin } = dressedSword();
  applySwornGear(knight.entity, sworn(sword));
  const dressedKey = foeWireLook(knight).key;
  reader.applyFoes('mac-0001', owner.foesFrame(true));
  await settle();
  const pup = reader.foes.find((f) => f.puppet === 'mac-0001');
  assert.deepEqual(held(foeLook(pup)).ap, [121, 7, 0]);
  // the plain twin given in its place: one template, one metal, one dye - only the look differs
  applySwornGear(knight.entity, sworn(twin), { taken: [sword] });
  assert.equal(held(foeLook(knight)).ap, undefined, 'the owner\'s body wears the twin\'s own look');
  assert.notEqual(foeWireLook(knight).key, dressedKey, 'a new record is owed');
  knight.ai.feet[0] += 1;
  const delta = owner.foesFrame(false).f[0];
  assert.ok(Array.isArray(delta.lw) && !('la' in delta), 'the kit said again, with no look');
  reader.applyFoes('mac-0001', owner.foesFrame(false));
  reader.applyFoes('mac-0001', owner.foesFrame(true));
  assert.equal(held(foeLook(pup)).ap, undefined, 'and every screen draws it so');
  // a newer word while the puppet builds: the build keeps the kit and look of the first
  applySwornGear(knight.entity, sworn(sword), { taken: [twin] });
  const late = createExteriorFoes(poolRig()); late.setNet(netFor('cat-0003'));
  knight.ai.feet[0] += 1;
  late.applyFoes('mac-0001', owner.foesFrame(true));
  knight.ai.feet[0] += 1;
  late.applyFoes('mac-0001', owner.foesFrame(false));
  await settle();
  assert.deepEqual(held(foeLook(late.foes.find((f) => f.puppet === 'mac-0001'))).ap, [121, 7, 0], 'built off the newest word, in the first one\'s look');
  // the heir: the dying owner's last frame hands the foe on, and the heir streams the kit and its look on
  const heir = createExteriorFoes(poolRig()); heir.setNet(netFor('dan-0004'));
  heir.applyFoes('mac-0001', owner.foesFrame(true));
  await settle();
  const hp = heir.foes.find((f) => f.puppet === 'mac-0001');
  heir.applyFoes('mac-0001', owner.foesFrame(true, true, () => 'dan-0004'));
  await settle();
  assert.equal(hp.puppet, null, 'the heir\'s own now');
  const onward = heir.foesFrame(true).f.find((r) => r.i === hp.seq);
  assert.deepEqual(onward.la, owner.foesFrame(true).f[0].la, 'the very look, streamed on');
  assert.deepEqual(kitWire(onward), { lw: onward.lw, la: onward.la });
});

test('APPEARANCES-II THE WIRE\'S LAW: `la` rides with `lw` alone, a piece once each in order, four whole numbers; a look kept only when it is one there is and of its piece\'s kind - another is dropped and the piece stands in its own, never the record refused for it (mutants: `la` without `lw` kept; the order unchecked; the index unbounded; the kind unchecked; a bad look refusing the record)', () => {
  const sword = [EQUIP_SLOTS.RightHand, LOOK_GROUPS.indexOf('Weapons'), WEAPONS.Longsword, 1, -1, -1];
  const D = ARMOR_MATERIAL.Daedric, helm = [0, LOOK_GROUPS.indexOf('Armor'), 107, ARMOR_MATERIAL.Iron, -1, 0];
  const base = { i: 1, lw: [helm, sword] };
  assert.deepEqual(validFoeRecord({ ...base, la: [[1, 121, 7, 0]] }), { ...base, la: [[1, 121, 7, 0]] });
  assert.deepEqual(validFoeRecord({ ...base, la: [[0, 107, D, 5], [1, 121, 7, 0]] }).la, [[0, 107, D, 5], [1, 121, 7, 0]], 'a Daedric helm\'s style 5 on the helm');
  assert.deepEqual(validFoeRecord({ ...base, la: [[1, 122, 7, 0]] }), base, 'a claymore\'s look on a longsword: dropped, the record kept');
  assert.deepEqual(validFoeRecord({ ...base, la: [[0, 121, 7, 0], [1, 121, 7, 0]] }).la, [[1, 121, 7, 0]], 'a katana on the helm: that one dropped');
  assert.deepEqual(validFoeRecord({ ...base, la: [[1, 121, 7, 1]] }), base, 'a style no weapon draws: no look there is');
  for (const bad of [{ i: 1, la: [[0, 121, 7, 0]] }, { ...base, la: [[2, 121, 7, 0]] }, { ...base, la: [[-1, 121, 7, 0]] }, { ...base, la: [[1, 121, 7, 0], [1, 121, 7, 0]] },
    { ...base, la: [[1, 121, 7, 0], [0, 107, D, 5]] }, { ...base, la: [[1, 121, 7]] }, { ...base, la: [[1, 121, 7, 0.5]] }, { ...base, la: 'x' }, { ...base, la: [[0, 107, D, 5], [1, 121, 7, 0], [1, 1, 1, 1]] }]) {
    assert.equal(validFoeRecord(bad), null, JSON.stringify(bad).slice(0, 80));
  }
});
