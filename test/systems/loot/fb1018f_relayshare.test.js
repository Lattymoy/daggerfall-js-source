// FIELD BUGS 2026-10-18f RELAY-SHARE (Jigglehimmer, #bug-reports, "Night Mothers Embrace Legendary does not function":
// "Does not do what the tooltip implies" - the card's line "Imprint: Sweet Mother's Kiss (of The Night Mother's Embrace) -
// +50% to foes under 25%"). A body the relay runs - the gate's Warden, his crystals and host, the Abyss Dungeon's Remnant,
// its Echoes and Hearts, every lord and add of an Elite Breach, the sea serpent - is struck on this machine against a
// stand-in whose health is a placeholder (world/gate/gateBoss.js bossStandIn, 1e9 of 1e9), and the power read it as
// whole: never under a quarter, never +50%. Every screen in the fight holds the relay's word of that body's health (the
// bar draws it). The laws pinned here, on the real modules:
//   - THE ONE LAW (combat/healthShare.js healthShare): an entity's own share; a relay body's word through its stand-in's
//     reader, clamped; null where none is heard.
//   - THE REPORT: a Rare imprinted at the Reforge, worn, its blows through FormulaHelper's own weapon damage
//     (combat/formulas.js weaponAttackDamage) - +50% on an ordinary foe under a quarter (as before) and now on the court's
//     Warden and on an Elite Breach's lord under a quarter of the relay's word; never at a quarter or over.
//   - EVERY OWNER HANDS ITS STAND-INS THE WORD: the court (the Warden, the crystals, the host), an Elite Breach (a lord,
//     an add, a struck object), the Remnant (itself, an Echo, a Heart), the serpent's host and the world host's line.
//   - THE FAMILY: Serpent's Kiss's double, the masteries' halves, Run Them Down and Gutting Lunge read the same word; the
//     five readers hold no share law of their own.

import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import * as CX from '../../../src/systems/loot/lootCodex.js';
import * as LP from '../../../src/systems/loot/lootPowers.js';
import * as WM from '../../../src/systems/weaponMastery.js';
import * as MP from '../../../src/systems/martialPaths.js';
import * as POW from '../../../src/systems/martialPowers.js';
import { healthShare, wordShare } from '../../../src/combat/healthShare.js';
import { weaponAttackDamage } from '../../../src/combat/formulas.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { tellTechniqueLanded, blowMult } from '../../../src/combat/technique/techniqueBlow.js';   // AUDIT FB1018f L3-5: Headsman's Chop
import { _resetTechniquesForTests } from '../../../src/combat/techniques.js';
import { makeEnemyEntity } from '../../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { welkyndShards } from '../../../src/systems/gate/gateSpoils.js';
import { addGoldPieces } from '../../../src/systems/inventory.js';
import { setPlayerDoor, takeOwed } from '../../../src/systems/playerDoor.js';
import { createCharacter } from '../../../src/systems/chargen.js';
import { buildCustomCareer } from '../../../src/systems/customClass.js';
import { masterSkill } from '../../../src/systems/masterSkills.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { WEAPONS } from '../../../src/characters/weapons.js';
import { weaponBlowMods } from '../../../src/systems/entityMods.js';
import { _resetSetPowersForTests } from '../../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, setSigilDueling, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import { _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { bossStandIn, crystalStandIn, hostStandIn, bossLookOf, STAND_IN_WHOLE } from '../../../src/world/gate/gateBoss.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { ATTACKS, COURTS, HOST } from '../../../src/net/gate/gateBrain.js';
import { CRYSTAL_GROW_MS } from '../../../src/render/courtCrystals.js';
import { destroyGateBossBar } from '../../../src/ui/gate/gateBossBar.js';
import { destroyGateMarksCard } from '../../../src/ui/gate/gateMarksView.js';
import { destroyGateGround } from '../../../src/ui/gate/gateGroundView.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { egFightView, egGroundAt, egFeetAt } from '../../../src/net/eliteGates/egWalkGraph.js';
import { EG_BOSS_KEYS, EG_OBJ } from '../../../src/net/eliteGates/egLords.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { egBodyOf, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createSdRemnant } from '../../../src/scenes/superDungeon/sdRemnant.js';
import { SD_FIGHT_EMPTY } from '../../../src/net/superDungeon/sdFightLink.js';
import { SD_BLOWS } from '../../../src/net/superDungeon/sdRemnant.js';
import { createSerpentHost } from '../../../src/scenes/serpentHost.js';
import { createSerpentLink } from '../../../src/net/serpent/serpentLink.js';
import { newSerpentFight, joinSerpentFight, serpentStateOf } from '../../../src/net/serpent/serpentBrain.js';
import { validSerpentOut } from '../../../src/net/wire.js';
import { numberFor } from '../../../src/ui/hitNumbers.js';   // AUDIT FB1018f L6-7: a turned blow's word
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Steel, flags: 0 });
const fresh = () => {
  _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests(); LP._resetLootPowersForTests(); _resetSetPowersForTests();
  _resetSigilForTests(); _resetSigilSetsForTests(); setPlayerDoor(null); setSigilDueling(false);
};
/** A body the relay runs, its word `s` (a share, or what a reader answers). */
const relayBody = (s) => bossStandIn({ mobile: 31 }, 'a body the relay runs', () => s);

/** MY player wearing a Rare cuirass imprinted at the Reforge with The Night Mother's Embrace's power - the codex's record
 *  found, the price paid, the power taken (systems/loot/lootCodex.js imprintPiece), the piece put on. */
function imprinted() {
  const rec = LR.legendaryById('night-mothers-embrace');
  const legend = LR.applyRarity(cuirass(), 'legendary', lcg(1), [rec]);
  legend.isIdentified = true;
  CX.noteFind(legend, { quiet: true });
  const me = player();
  const rare = LR.applyRarity(cuirass(), 'rare', lcg(7));
  rare.isIdentified = true;
  me.items.push(rare, welkyndShards(40));
  addGoldPieces(me, 10_000);
  assert.deepEqual(CX.imprintPiece(rare, 'night-mothers-embrace', me), { ok: true });
  assert.equal(LR.imprintLine(rare), "Imprint: Sweet Mother's Kiss (of The Night Mother's Embrace) - +50% to foes under 25%", 'the line in the report');
  equipItem(me, rare);
  assert.deepEqual(LP.wornPowers(me).map((p) => [p.id, p.power.kind]), [['night-mothers-embrace', 'execute']], 'worn, its power awake');
  return me;
}
const ROLL = () => 0.5;
const sword = () => createWeapon(120, 0, ROLL);   // a longsword: melee
const bow = () => createWeapon(130, 0, ROLL);     // a long bow: Archery

/** The gate's court with his fight in it, driven by hand (test/net/gate/wb4b_gate_blows.test.js's own rig). */
function court(st, feet = courtToDungeon(0, 0, 2)) {
  const link = { st, state() { return this.st; } };
  const clock = { t: 5000 };
  const c = createGateCourt({ renderer: null, gl: null, audio: { play3d: () => {}, play3dId: () => {} }, link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => feet,
    player: () => ({ health: 100, maxHealth: 100 }), say: () => {}, send: () => true, sendCrystal: () => true, sendHost: () => true, strike: () => {} });
  return { c, link, clock, tick: (t, s) => { if (s) link.st = s; clock.t = t; c.frame(); } };
}
const fight = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, x: 3, z: -4, yaw: 0.5, wrathAt: 10_000_000, ...over });

/** An Elite Breach's fight over a recording renderer (test/net/eliteGates/eglook_lords.test.js's own rig). */
const T0 = 1_800_000_000_000;
// AUDIT FB1018f L3-6: each stands on the fight ground under it, as the relay stands every body (net/eliteGates/egBodies.js egBodyNew -
// egFeetAt): the hall's first disc is 18 m up, and a lord drawn at 0 under it is a storey below my feet there, turned
const feetAt = (x, z) => egFeetAt(egFightView(egHallOf(12345, 5, 0)), x, z);
// the hall's first fight piece as the generator lays it today (a disc, r 11), read off the hall, never written in - EG-SWEEP-RED
// moved it
const P0 = egFightView(egHallOf(12345, 5, 0)).fl[0];
const on = (dx = 0) => ({ x: Math.round(P0.x) + dx, z: Math.round(P0.z) });
const lordRow = (i, key, hp, max, { x = 0, z = 30 } = {}) => egBodyOf([i, EG_ROLE.lord, EG_BOSS_KEYS.indexOf(key), 0, x, z, hp, max, 0, x, z, 0, 0, feetAt(x, z), feetAt(x, z), 1, 0, 0, Math.PI], T0);
const addRow = (i, k, hp, max, { x = 6, z = 30 } = {}) => egBodyOf([i, EG_ROLE.add, k, 0, x, z, hp, max, 0, x, z, 0, 0, feetAt(x, z), feetAt(x, z), 0, 0, 0, Math.PI], T0);
const objRow = (i, k, hp, max, { x = -6, z = 30 } = {}) => egBodyOf([i, EG_ROLE.obj, k, 0, x, z, hp, max, 0, x, z, 0, 0, feetAt(x, z), feetAt(x, z), 0, 0, 0, Math.PI], T0);
function breach(bodies, { feet: withFeet = true } = {}) {   // AUDIT FB1018f L6-7: `feet` false - this screen holds none of mine
  const E = { ...EG_STATE_EMPTY, b: '0123456789abcdef', h: 5, sg: 'trial', seed: 12345, geo: 0, end: null, hw: T0 - 5000, co: [['acct-0', 'Mac', 1]], fight: { ...EG_STATE_EMPTY.fight, h: 5, wk: T0, bodies, pg: {} } };
  assert.ok(egHallOf(12345, 5, 0), 'a hall to fight in');
  const renderer = { textures: new Set(), createBillboardBatch: (archive, record, size, centres) => ({ archive, record, size: { ...size }, centres, origin: null, bounds: [0, 0, 0, 1] }), destroyBillboardBatch: () => {} };
  const getTexture = async (archive) => ({ archive, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const clock = { t: T0 + 1000 };
  // TURNED-BLOW (the same record): a blow is struck from my feet on the fight ground beside the first body - with no feet
  // the screen turns it as the relay would, and no power answers it (STANDING NOWHERE TURNS EVERY BLOW, below)
  const spec = egHallOf(12345, 5, 0), centre = egHallCentre(spec), b0 = bodies[0];
  const g = egGroundAt(egFightView(spec), b0.x + 1.5, NaN, b0.z);
  const feet = withFeet && g ? [centre[0] + b0.x + 1.5, centre[1] + (g.y ?? 0), centre[2] + b0.z] : null;
  const fightOf = createEgFight({ renderer, getTexture, uploadRecordFrame: () => {}, audio: { play3d: () => {}, play3dId: () => {}, playOneShot: () => {} },
    link: { state: () => E }, now: () => clock.t, feet: () => feet, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0' });
  return { E, fight: fightOf, clock };
}

test('RELAY-SHARE THE ONE LAW (combat/healthShare.js healthShare): an entity\'s own health of its whole, whole where it says none; a body the relay runs reads the relay\'s word through its stand-in\'s reader, clamped to 0..1 - its placeholder never; null where no word is heard, where the reader throws or answers no number; wordShare null with no whole (mutants: the relay\'s branch dropped; the reader never asked; the clamp dropped; a NaN passed; a throw let through; a zero whole divided)', () => {
  assert.equal(healthShare({ health: 20, maxHealth: 100 }), 0.2);
  assert.equal(healthShare({ health: 20 }), 1, 'no whole: whole');
  assert.equal(healthShare({ name: 'rat' }), 1, 'no health to read: whole');
  assert.equal(healthShare(null), 1);
  const placeholder = bossStandIn({ mobile: 31 }, 'the Warden');
  assert.deepEqual([placeholder.health, placeholder.maxHealth, placeholder.relayHealth], [STAND_IN_WHOLE, STAND_IN_WHOLE, true], 'nothing here empties him');   // PIN MOVED (FIELD BUGS 2026-10-19f STAND-IN-WHOLE): the count the wire carries, 1e9 before
  assert.equal(healthShare(placeholder), null, 'no word heard: unknown, never his placeholder\'s 1');
  assert.equal(healthShare(relayBody(0.2)), 0.2, 'his word');
  assert.equal(healthShare(relayBody(1.7)), 1);
  assert.equal(healthShare(relayBody(-0.3)), 0);
  assert.equal(healthShare(relayBody(NaN)), null);
  assert.equal(healthShare(relayBody(null)), null);
  assert.equal(healthShare(bossStandIn({ mobile: 31 }, 'x', () => { throw new Error('a reader that throws'); })), null);
  assert.equal(healthShare(crystalStandIn(bossLookOf('ruhn'), 0, () => 0.4)), 0.4, 'a crystal\'s reader');
  assert.equal(healthShare(hostStandIn({ mobile: 1, name: 'Imp' }, 3, () => 0.6)), 0.6, 'a host body\'s reader');
  assert.equal(wordShare(25, 100), 0.25);
  assert.deepEqual([wordShare(5, 0), wordShare(NaN, 100), wordShare(5, undefined), wordShare(undefined, 100)], [null, null, null, null]);
});

test('RELAY-SHARE THE REPORT: a Rare imprinted at the Reforge with Sweet Mother\'s Kiss, worn - its weapon blows through FormulaHelper\'s own damage deal +50% to an ordinary foe under a quarter (as they did) and now to the court\'s Warden and an Elite Breach\'s lord under a quarter of the relay\'s word, a sword\'s and a bow\'s; never at a quarter or over (mutants: every owner\'s reader dropped; the loot\'s share its own copy again)', async () => {
  fresh();
  const me = imprinted();
  // an ordinary foe: its own entity's health - as it always was
  const orc = makeEnemyEntity(7, ENEMY_BASICS[7], null, 1, ROLL);
  const whole = weaponAttackDamage(me, orc, 0, sword(), ROLL);
  orc.health = Math.floor(orc.maxHealth * 0.2);
  assert.equal(weaponAttackDamage(me, orc, 0, sword(), ROLL), whole + Math.floor(whole / 2), 'an orc under a quarter: +50%');
  // the gate's Warden: his stand-in's placeholder is whole (STAND_IN_WHOLE - 1e9 before STAND-IN-WHOLE); the relay's word (the bar's) says 200 of 1000
  const h = court(fight({ hp: 200, max: 1000 }));
  const warden = h.c.target().entity;
  assert.equal(warden.health, STAND_IN_WHOLE, 'his placeholder');   // PIN MOVED (FIELD BUGS 2026-10-19f STAND-IN-WHOLE)
  const plain = weaponAttackDamage(me, bossStandIn({ mobile: 31 }, 'unread'), 0, sword(), ROLL);
  assert.equal(weaponAttackDamage(me, warden, 0, sword(), ROLL), plain + Math.floor(plain / 2), 'the Warden under a quarter: +50%');
  const shot = weaponAttackDamage(me, bossStandIn({ mobile: 31 }, 'unread'), 0, bow(), ROLL);
  assert.equal(weaponAttackDamage(me, warden, 0, bow(), ROLL), shot + Math.floor(shot / 2), 'a shaft too');
  h.link.st = fight({ hp: 250, max: 1000 });
  assert.equal(weaponAttackDamage(me, warden, 0, sword(), ROLL), plain, 'at a quarter: nothing');
  h.link.st = fight({ hp: 249, max: 1000 });
  assert.equal(weaponAttackDamage(me, warden, 0, sword(), ROLL), plain + Math.floor(plain / 2), 'the word read at the blow, not at his first sight');
  // an Elite Breach: every foe there is the relay's - a Court's lord at a fifth of the word
  // both on the hall's first fight piece (P0, a disc of r 11), struck from beside the first - off the fight
  // ground the relay lands nothing and the screen turns the blow (TURNED-BLOW), so no power answers there
  const B = breach([lordRow(1, 'hound', 200, 1000, on()), lordRow(2, 'garoth', 900, 1000, on(6))]);
  B.fight.frame(); await new Promise((r) => setTimeout(r, 0)); B.fight.frame();
  const lords = B.fight.hostTargets();
  const low = lords.find((q) => q.i === 1).entity, high = lords.find((q) => q.i === 2).entity;
  assert.equal(weaponAttackDamage(me, low, 0, sword(), ROLL), plain + Math.floor(plain / 2), 'a lord under a quarter: +50%');
  assert.equal(weaponAttackDamage(me, high, 0, sword(), ROLL), plain, 'a lord at nine tenths: nothing');
});

test('RELAY-SHARE EVERY BODY THE RELAY RUNS READS ITS WORD: the court\'s Warden (his `hp` of `max`), each crystal of a Reckoning (its own share), each of his host (its `h` of `m`); an Elite Breach\'s lord, add and struck object (its `hp` of `max`, refilled each frame); the Remnant (`h` of `m`), an Echo (its own) and a Heart (its health of the Reset\'s whole); the serpent\'s host (`hp` of `max` while its fight is mine) and the world host\'s stand-in reading it (mutants: each reader dropped; the breach\'s health never refilled; the host\'s whole read for its health)', async () => {
  fresh();
  destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround();
  // the Warden
  const w = court(fight({ hp: 300, max: 1000 }));
  assert.equal(healthShare(w.c.target().entity), 0.3);
  w.link.st = fight({ hp: 100, max: 1000 });
  assert.equal(healthShare(w.c.target().entity), 0.1, 'his word now, the same stand-in');
  // the crystals of a Reckoning (test/net/gate/wb9c_gate_reckoning.test.js's spots)
  const C3 = COURTS[2], spots = [[C3[0] + 8, C3[1]], [C3[0] - 9, C3[1] + 4], [C3[0], C3[1] - 12]];
  const RK = { i: 40, a: ATTACKS.reckon.id, at: 30_000, x: C3[0], z: C3[1], yw: 0, tg: [] };
  const cx = (hp) => ({ i: 40, m: 40, c: spots.map((p, k) => [p[0], p[1], hp[k]]), broke: [] });
  const st = (hp) => fight({ phase: 3, hp: 400, x: C3[0], z: C3[1], fighters: 3, atk: RK, cx: cx(hp) });
  const k = court(st([40, 20, 8]), courtToDungeon(C3[0], 0, C3[1]));
  const grew = 30_000 - ATTACKS.reckon.windup;
  k.tick(grew + 50); k.tick(grew + CRYSTAL_GROW_MS); k.tick(grew + CRYSTAL_GROW_MS + 16);
  assert.deepEqual(k.c.crystalTargets().map((q) => healthShare(q.entity)), [1, 0.5, 0.2]);
  k.tick(grew + CRYSTAL_GROW_MS + 32, st([10, 20, 8]));
  assert.equal(healthShare(k.c.crystalTargets()[0].entity), 0.25, 'its word as it falls');
  // his host, under the Legion-Lord (test/net/gate/wb11_gate_host.test.js's rig)
  const ad = (o) => ({ i: 1, k: HOST.harrier, h: 45, m: 45, x: 0, z: 6, mv: null, atk: null, rose: -Infinity, yaw: 0, ...o });
  const lg = (ads) => fight({ phase: 1, hp: 800, x: 0, z: 0, md: ['burning', 'legion', 'echoing'], lg: { ads, gone: [] } });
  const g = court(lg([ad({ i: 1, h: 9, m: 45 }), ad({ i: 2, h: 45, m: 45, x: 4 })]), courtToDungeon(0, 0, 4));
  g.tick(10_000);
  assert.deepEqual(g.c.hostTargets().map((q) => [q.i, healthShare(q.entity)]), [[1, 0.2], [2, 1]]);
  g.tick(10_100, lg([ad({ i: 1, h: 9, m: 45 }), ad({ i: 2, h: 18, m: 45, x: 4 })]));
  assert.equal(healthShare(g.c.hostTargets()[1].entity), 0.4, 'a body\'s word as it falls');
  // an Elite Breach: a lord, an add, a struck object - each its own word, refilled each frame
  const B = breach([lordRow(1, 'hound', 600, 1000), addRow(2, EG_KIND.dlord, 10, 50), objRow(3, EG_OBJ.rift, 30, 120)]);
  B.fight.frame(); await new Promise((r) => setTimeout(r, 0)); B.fight.frame();
  const shares = () => Object.fromEntries(B.fight.hostTargets().map((q) => [q.i, healthShare(q.entity)]));
  assert.deepEqual(shares(), { 1: 0.6, 2: 0.2, 3: 0.25 });
  B.E.fight.bodies = [lordRow(1, 'hound', 150, 1000), addRow(2, EG_KIND.dlord, 10, 50), objRow(3, EG_OBJ.rift, 30, 120)];
  B.fight.frame();
  assert.equal(shares()[1], 0.15, 'the lord\'s word as it falls');
  // the Remnant, an Echo, a Heart (its link stood by hand: the page's fight as the realm says it)
  let S = { ...SD_FIGHT_EMPTY, fi: 1, h: 400, m: 1000 };
  const set = createSdRemnant({ link: () => ({ state: () => S, now: () => 10_000, joined: () => true }), sendBlow: () => true });
  assert.equal(healthShare(set.target().entity), 0.4);
  const echo = (h, m) => ({ ...SD_FIGHT_EMPTY.rem, h, m, up: 0, dn: 0 });
  S = { ...S, ph: 2, ec: [echo(30, 100), echo(80, 100)] };
  assert.deepEqual(set.echoTargets().map((q) => healthShare(q.entity)), [0.3, 0.8]);
  S = { ...S, ph: 1, cx: { i: 5, m: 50, c: [[0, 0, 10], [4, 4, 50]] }, rem: { ...SD_FIGHT_EMPTY.rem, atk: { a: SD_BLOWS.reset.id, i: 5, at: 60_000 } } };
  assert.deepEqual(set.heartTargets().map((q) => healthShare(q.entity)), [0.2, 1]);
  // the sea serpent: its host's word, while its fight is mine (test/net/serpent/serpent3.test.js's client rig)
  let now = 50_000_000;
  const sw = { day: 363, site: { sx: 0, sz: 0 }, phase: 'hunt', t: { soundAt: now + 25 * 60_000 } };
  const link = createSerpentLink({ now: () => now, site: () => ({ day: 363, sx: 0, sz: 0 }) });
  const sh = createSerpentHost({ now: () => now, link, omen: { swimming: () => sw }, online: { ready: () => false, send: () => true, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x, z], toSite: (sx, sz, x, z) => [x, z], seaY: () => 0, feet: () => [60, 1, 0], level: () => 20, boat: () => null,
    strike: () => {}, maxHealth: () => 100, hurt: () => {}, say: () => {}, mid: () => {}, sound: () => {}, fx: () => {} });
  assert.equal(sh.healthShare(), null, 'no fight: no word');
  sh.frame();
  const f = newSerpentFight(363, now, now + 25 * 60_000, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  f.hp = f.max * 0.2;
  link.word(validSerpentOut(serpentStateOf(f)));
  now += 10; sh.frame();
  assert.ok(Math.abs(sh.healthShare() - 0.2) < 1e-9, `its word: ${sh.healthShare()}`);
  // the world host's stand-in reads it (bootWorld does not run in Node: its one line, by source)
  assert.match(strip(read('src/scenes/world.js')), /const e = bossStandIn\(\{ mobile: SERPENT_VOICE_ROWS\.dreugh \}, 'the sea serpent', \(\) => serpentHost\?\.healthShare\(\) \?\? null\);/);
});

test('RELAY-SHARE THE FAMILY on a body the relay runs: Serpent\'s Kiss doubles under half the word; the Axe past 100 pays its own half there (x1.8 under half, the hammer nothing) and the halves\' mean only where no word is heard; Run Them Down under half the word; Gutting Lunge under a quarter of it, its second blow owed to the claim (mutants: each reader its own copy again)', () => {
  fresh();
  // Serpent's Kiss (the Tsaesci Fang): 8 poison, twice under half - a Legendary's own power, as the imprint's
  const fangRec = LR.legendaryById('tsaesci-fang');
  const fang = LR.applyRarity(createWeapon(fangRec.templates?.[0] ?? 120, 0, ROLL), 'legendary', lcg(1), [fangRec]);
  fang.isIdentified = true;
  const me = player(); me.items.push(fang); equipItem(me, fang);
  assert.equal(LP.lootBlow(fang, 10, me, relayBody(0.6), {}), 18, 'over half: 8');
  assert.equal(LP.lootBlow(fang, 10, me, relayBody(0.4), {}), 26, 'under half of the word: 16');
  assert.equal(LP.lootBlow(fang, 10, me, relayBody(null), {}), 18, 'no word: whole, as before');
  // the masteries' halves (systems/weaponMastery.js): a chargen'd fighter at 200 in Axe and in Blunt, online
  const STATS = { strength: 70, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 50, luck: 50 };
  const career = buildCustomCareer({ name: 'Fighter', hp: 12, stats: STATS,
    skills: [SKILLS.LongBlade, SKILLS.ShortBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.HandToHand, SKILLS.Dodging, SKILLS.CriticalStrike, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming] });
  const fighter = (skills, raw = 200) => {
    const p = structuredClone(playerEntity);
    createCharacter(p, career, -1, { rolls: () => 0.5 });
    p._online = true; p.level = 20; p.activeEffects = []; p.health = p.maxHealth = 200; p.fatigue = 0;
    for (const s of skills) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true); p.skills[s] = raw; }
    return p;
  };
  const weapon = (t) => mintCondition(setItemFields({ group: 'Weapons', templateIndex: t, material: 0 }));
  const axe = fighter([SKILLS.Axe]), hammer = fighter([SKILLS.BluntWeapon]);
  const at = (p, w, foe) => WM.weaponPastPct(w, p, foe, { online: true });
  assert.deepEqual([at(axe, weapon(WEAPONS.War_Axe), relayBody(0.2)), at(axe, weapon(WEAPONS.War_Axe), relayBody(0.8))], [80, 0], 'the Axe under half of the word, x1.8; over it, nothing');
  assert.deepEqual([at(hammer, weapon(WEAPONS.Warhammer), relayBody(0.2)), at(hammer, weapon(WEAPONS.Warhammer), relayBody(0.8))], [0, 80], 'the hammer the other half');
  assert.equal(at(axe, weapon(WEAPONS.War_Axe), relayBody(null)), 40, 'no word: the halves\' mean (AUDIT MARTIAL L3 F2)');
  // Run Them Down (the Thief-Taker's Garb, 4 - test/systems/raid4b_sets.test.js's rig): +8% under half
  fresh(); setSigilOnline(true); setSigilRenown(1);
  const taker = player(); taker.armorValues = new Array(7).fill(100);
  for (const t of [107, 106, 105, 102]) { const it = mintCondition({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Steel, flags: 0 }); Object.assign(it, { rarity: 'rare', sigil: { set: 'thieftaker', party: 1, xp: 0 } }); taker.items.push(it); equipItem(taker, it); }
  assert.equal(weaponBlowMods(sword(), 100, taker, relayBody(0.4)), 108, 'under half of the word');
  assert.equal(weaponBlowMods(sword(), 100, taker, relayBody(0.6)), 100);
  assert.equal(weaponBlowMods(sword(), 100, taker, relayBody(null)), 100, 'no word: whole, as before');
  // Gutting Lunge (the Bloodletter's): a second blow under a quarter - owed to a body the relay runs (it has no record)
  fresh(); POW._resetMartialPowersForTests(); WM._resetWeaponMasteryForTests(); _resetPlayerHealForTests(); _resetTechniquesForTests();
  const bl = fighter(MP.MARTIAL_BY_ID.bloodletter.skills, 150);
  assert.equal(MP.chooseMartialPath(bl, 'bloodletter').ok, true);
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => bl });
  const lowBody = relayBody(0.2), highBody = relayBody(0.3), unheard = relayBody(null);
  for (const [name, entity] of [['low', lowBody], ['high', highBody], ['unheard', unheard]]) tellTechniqueLanded({ id: 'guttingLunge', use: {} }, { name, entity, ai: { feet: [0, 0, 1] } }, 6);
  assert.deepEqual([takeOwed(lowBody), takeOwed(highBody), takeOwed(unheard)], [6, 0, 0], 'under a quarter of the word: owed again; over it, or no word, nothing');
  setPlayerDoor(null);
});

test('RELAY-SHARE ONE LAW, SIX READERS: the loot\'s powers, the masteries, the martial and arcane paths, the sets and the techniques\' Headsman\'s Chop (AUDIT FB1018f L3-5) read a body\'s share through combat/healthShare.js alone - none keeps a `health / maxHealth` of its own - and the stand-ins carry the reader they are handed (mutants: a reader\'s copy put back; the stand-in\'s reader unkept)', () => {
  for (const p of ['src/systems/loot/lootPowers.js', 'src/systems/weaponMastery.js', 'src/systems/martialPowers.js', 'src/systems/arcanePowers.js', 'src/systems/sigil/sigilSetPowers.js', 'src/combat/technique/techniqueBlow.js']) {
    const s = strip(read(p));
    assert.match(s, /import \{ healthShare \} from '(?:\.\.\/)+(?:combat\/)?healthShare\.js';/, `${p} reads the one law`);
    assert.doesNotMatch(s, /\.health \/ e\.maxHealth|e\.health < e\.maxHealth \/ 2|e\.health : max\) \/ max/, `${p} keeps no share law of its own`);
  }
  const law = strip(read('src/combat/healthShare.js'));
  assert.match(law, /if \(e\?\.relayHealth\) \{/);
  const fn = () => 0.5;
  assert.equal(bossStandIn({ mobile: 31 }, 'x', fn).relayShare, fn);
  assert.equal(crystalStandIn(bossLookOf('ruhn'), 1, fn).relayShare, fn);
  assert.equal(hostStandIn({ mobile: 1, name: 'Imp' }, 2, fn).relayShare, fn);
  assert.equal(bossStandIn({ mobile: 31 }, 'x', 0.5).relayShare, null, 'a reader, or none');
});

// ── AUDIT FB1018f lanes L3 and L6 ────────────────────────────────────────────────────────────────────────────────

test('RELAY-SHARE STANDING NOWHERE TURNS EVERY BLOW (AUDIT FB1018f L6-7, and lane L3\'s survivor; TURNED-BLOW\'s own law): on a screen that holds no feet of mine in the hall, a lord under a quarter of its word is turned - its stand-in warded in the ward\'s word (never the ground\'s: I stand on no ground it could name), Sweet Mother\'s Kiss gives nothing on it (the plain blow), and the door sends nothing; a struck object the same (mutants: standing nowhere turns nothing; the ground\'s word with no feet)', async () => {
  fresh();
  const me = imprinted();
  const plain = weaponAttackDamage(me, bossStandIn({ mobile: 31 }, 'unread'), 0, sword(), ROLL);
  const B = breach([lordRow(1, 'hound', 200, 1000, on()), objRow(3, EG_OBJ.rift, 90, 120, on(3))], { feet: false });
  B.fight.frame(); await new Promise((r) => setTimeout(r, 0)); B.fight.frame();
  const low = B.fight.hostTargets().find((q) => q.i === 1), rift = B.fight.hostTargets().find((q) => q.i === 3);
  assert.ok(low && rift, 'both still drawn, bodies a swing could meet');
  for (const t of [low, rift]) {
    assert.equal(t.entity.warded, true, `${t.i}: standing nowhere, turned`);
    assert.equal(t.entity.wardText, null, `${t.i}: in the ward's word`);
    assert.equal(numberFor({ hit: true, damage: 9, target: t.entity }).text, 'Warded');
    assert.equal(B.fight.hostHit({ i: t.i, d: 40, r: HIT_KINDS.Melee }), false, `${t.i}: never sent`);
  }
  assert.equal(healthShare(low.entity), 0.2, 'its word is under a quarter');
  assert.equal(weaponAttackDamage(me, low.entity, 0, sword(), ROLL), plain, 'and the Kiss gives nothing on a turned blow - the plain blow');
  // the same lord with my feet beside it: whole, the Kiss's +50%, the blow sent
  const H = breach([lordRow(1, 'hound', 200, 1000, on())]);
  H.fight.frame(); await new Promise((r) => setTimeout(r, 0)); H.fight.frame();
  const whole = H.fight.hostTargets().find((q) => q.i === 1);
  assert.equal(whole.entity.warded, false);
  assert.equal(weaponAttackDamage(me, whole.entity, 0, sword(), ROLL), plain + Math.floor(plain / 2), 'beside it: +50%');
});

test('RELAY-SHARE A STRUCK OBJECT READS ITS WORD AS IT FALLS (lane L3\'s survivor): an Elite Breach\'s rift at three quarters of its word, then a fifth - its stand-in\'s share each frame\'s, never the share it was first drawn at (mutants: the object\'s reader frozen at its first sight)', async () => {
  fresh();
  const B = breach([objRow(3, EG_OBJ.rift, 90, 120, on())]);
  B.fight.frame(); await new Promise((r) => setTimeout(r, 0)); B.fight.frame();
  const share = () => healthShare(B.fight.hostTargets().find((q) => q.i === 3).entity);
  assert.equal(share(), 0.75);
  B.E.fight.bodies = [objRow(3, EG_OBJ.rift, 24, 120, on())];
  B.fight.frame();
  assert.equal(share(), 0.2, 'its word now');
});

test('RELAY-SHARE THE SERPENT\'S WORD IS THE FIGHT I STAND IN (lane L3\'s survivors): the host reads its link\'s word only while that word is of the serpent the omen swims for me - a day moved on with the link still holding the last day\'s fight, no word (mutants: any fight\'s word read; any day\'s)', () => {
  let now = 50_000_000;
  const sw = { day: 363, site: { sx: 0, sz: 0 }, phase: 'hunt', t: { soundAt: now + 25 * 60_000 } };
  const link = createSerpentLink({ now: () => now, site: () => ({ day: 363, sx: 0, sz: 0 }) });
  const sh = createSerpentHost({ now: () => now, link, omen: { swimming: () => sw }, online: { ready: () => false, send: () => true, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x, z], toSite: (sx, sz, x, z) => [x, z], seaY: () => 0, feet: () => [60, 1, 0], level: () => 20, boat: () => null,
    strike: () => {}, maxHealth: () => 100, hurt: () => {}, say: () => {}, mid: () => {}, sound: () => {}, fx: () => {} });
  sh.frame();
  const f = newSerpentFight(363, now, now + 25 * 60_000, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  f.hp = f.max * 0.2;
  link.word(validSerpentOut(serpentStateOf(f)));
  now += 10; sh.frame();
  assert.ok(Math.abs(sh.healthShare() - 0.2) < 1e-9, 'its word');
  sw.day = 364;   // the omen swims another day's serpent; the link still holds 363's fight
  now += 10; sh.frame();
  assert.equal(link.state().day, 363, 'the link still holds the old fight');
  assert.equal(sh.healthShare(), null, 'another day\'s: no word');
});

test('RELAY-SHARE HEADSMAN\'S CHOP (AUDIT FB1018f L3-5; combat/technique/techniqueBlow.js blowMult): its weight on what a foe has lost reads the one law - an orc at a fifth of its health (as it did), and a body the relay runs at a fifth of the relay\'s word (its stand-in\'s 1e9 placeholder read whole before, so the Chop gave nothing on any of them); no word heard, whole (mutants: the Chop\'s own copy of the share again)', () => {
  const chop = { mult: 1.2, wounded: 1.0 };
  const orc = makeEnemyEntity(7, ENEMY_BASICS[7], null, 1, ROLL);
  orc.health = Math.floor(orc.maxHealth * 0.2);
  assert.ok(Math.abs(blowMult(chop, { entity: orc }) - (1.2 + (1 - orc.health / orc.maxHealth))) < 1e-9, 'an orc: its own share, as before');
  assert.ok(Math.abs(blowMult(chop, { entity: relayBody(0.2) }) - 2.0) < 1e-9, 'a relay body at a fifth of its word: +0.8');
  assert.equal(blowMult(chop, { entity: relayBody(null) }), 1.2, 'no word: whole, nothing more');
  assert.equal(blowMult(chop, { entity: relayBody(1) }), 1.2);
  assert.equal(blowMult({ mult: 1.2 }, { entity: relayBody(0.2) }), 1.2, 'no Chop, no weight');
});
