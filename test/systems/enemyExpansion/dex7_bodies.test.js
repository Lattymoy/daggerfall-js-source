// DEX7 (2026-10-20, Mac, 2026-10-19: "We also need to ensure these get proper morrowind model replacements if
// applicable") - DAGGERFALL ENEMY EXPANSION'S FIFTY IN MORROWIND'S BODIES (systems/enemyExpansion/dexBodies.js): every
// monster of the mod's a Morrowind creature that is it and moves as it does, or a declared miss; the lizard men
// Argonians; the classes people by the class law, the riders their sprites. Held by the classic table's own audits
// (test/characters/mwnpc9b_creaturerig.test.js MWNPC9b-8, mwnpc_audit.test.js D4/D5), now at the doors a mod registers
// on (characters/creatureBodies.js registerCreatureMatches, characters/foeBodies.js registerPersonFoes), and each with a
// mutation it must fail under (tools/mutants/dex7.json).
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEX_CREATURE_MATCH, DEX_PERSON_FOES, installDexBodies, _resetDexBodies } from '../../../src/systems/enemyExpansion/dexBodies.js';
import { CREATURE_MATCH, creatureLook, creatureMatch, registerCreatureMatches, SPECTRAL_VEIL } from '../../../src/characters/creatureBodies.js';
import { isPersonFoe, isBodyFoe, foeLook, foeActor, rosterLook, registerPersonFoes, foeFx } from '../../../src/characters/foeBodies.js';
import { setupFoeLook } from '../../../src/characters/enemy/foeLook.js';
import { PeerBodies } from '../../../src/net/peer/peerBodies.js';
import { perspective, lookAt } from '../../../src/world/mat4.js';
import { installEnemyExpansion, _resetEnemyExpansion, dexRead } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { ENEMY_BASICS, isClassEnemyId } from '../../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { EQUIP_SLOTS } from '../../../src/systems/equip.js';
import { createEquipTable } from '../../../src/characters/equipTable.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetFoeGhosts } from '../../../src/characters/enemy/foeLook.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';
import { _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { _resetPlayerGps } from '../../../src/world/playerGps.js';
import { _resetSpellRecordsAssets } from '../../../src/systems/spell/standardSpells.js';
import { _resetEnemySpellbooks } from '../../../src/systems/enemySpells.js';
import { _resetFormulaDoors } from '../../../src/combat/formulas.js';
import { _resetForcedGenders } from '../../../src/characters/mobile/mobileUnit.js';

const silent = () => {};
const reset = () => {
  _resetDexBodies(); _resetFormulaDoors(); _resetForcedGenders(); _resetSpellRecordsAssets(); _resetEnemySpellbooks(); _resetEncounterTableSelectors(); _resetPlayerGps();
  _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetFoeGhosts(); _resetExtraQuestRows();
};
/** The mod's fifty as its tables name them: id -> name. */
const fifty = () => new Map([...dexRead({ log: silent }).enemies].map(([id, e]) => [id, e.props.name]));
/** A foe as both foe hosts keep one: its mobile, its own archive, an entity with its equip table. */
const foe = (mobileType, { archive = ENEMY_BASICS[mobileType]?.maleTexture, isClass = isClassEnemyId(mobileType) } = {}) => ({
  mobileType, mobileArchive: archive, marker: [3, 0, 7], gender: 'male',
  entity: { isClass, race: undefined, equip: createEquipTable(), items: [] }, ai: { feet: [1, 2, 3], yaw: 0, moving: false, giveUpTimer: 0 },
});

test('DEX7-1 THE CENSUS: every monster of the mod\'s named - a Morrowind creature (its CREA ids, in order) or a declared miss with its reason - by the id its tables give it', () => {
  reset();
  const names = fifty();
  const monsters = [...names.keys()].filter((id) => !isClassEnemyId(id)).sort((a, b) => a - b);
  assert.equal(monsters.length, 35);
  assert.deepEqual(Object.keys(DEX_CREATURE_MATCH).map(Number).sort((a, b) => a - b), monsters, 'a new monster of the mod\'s is named here');
  for (const [t, m] of Object.entries(DEX_CREATURE_MATCH)) {
    assert.ok(!!m.creature !== !!m.miss, `${t}: a match or a miss, never both`);
    if (m.creature) assert.ok(m.creature.length && m.creature.every((id) => id === id.toLowerCase() && id.trim() === id), `${t}: ids as the reader keeps them`);
    else assert.ok(m.miss.length > 4, `${t}: the miss says why`);
  }
  // the rows are the ids' - pinned by the mod's own names, so a renumbered table is seen
  const by = (name) => DEX_CREATURE_MATCH[[...names].find(([, n]) => n === name)[0]];
  assert.deepEqual(by('Goblin').creature, ['goblin_grunt'], 'Tribunal\'s goblin');
  assert.deepEqual(by('Troll').creature, ['bm_ice_troll'], 'Bloodmoon\'s grahl');
  assert.deepEqual(by('Snow Wolf').creature, ['bm_wolf_snow_unique', 'bm_wolf_grey']);
  assert.deepEqual(by('Boar').creature, ['bm_frost_boar']);
  assert.deepEqual(by('Ogre').creature, ['ogrim']);
  assert.deepEqual(by('Dire Ghoul').creature, ['bonewalker_greater', 'bonewalker']);
  assert.deepEqual(by('Steam Centurion').creature, ['centurion_steam']);
  // where a classic monster is the same creature, the classic row's own ids
  assert.deepEqual(by('Skeletal Soldier').creature, CREATURE_MATCH[MOBILE_TYPES.SkeletalWarrior].creature);
  assert.deepEqual(by('Iron Golem').creature, CREATURE_MATCH[MOBILE_TYPES.IronAtronach].creature);
  assert.deepEqual(by('Ice Golem').creature, CREATURE_MATCH[MOBILE_TYPES.IceAtronach].creature);
  assert.deepEqual(by('Ghoul').creature, CREATURE_MATCH[MOBILE_TYPES.Zombie].creature);
  assert.deepEqual(by('Gloom Wraith'), CREATURE_MATCH[MOBILE_TYPES.Wraith]);
  assert.deepEqual(by('Faded Ghost'), CREATURE_MATCH[MOBILE_TYPES.Ghost]);
  for (const [name, classic] of [['Bat', 'GiantBat'], ['Nymph', 'Nymph'], ['Blood Spider', 'Spider'], ['Mountain Lion', 'SabertoothTiger']]) {
    assert.equal(by(name).miss, CREATURE_MATCH[MOBILE_TYPES[classic]].miss, `${name}: the classic ${classic}'s miss`);
  }
});

test('DEX7-2 the motion law: no monster that flies or swims stands in a Morrowind creature that walks - the Homunculus, the Bat and the wisp keep their sprites; the spectral dead are veiled', () => {
  reset();
  const read = dexRead({ log: silent });
  for (const [t, m] of Object.entries(DEX_CREATURE_MATCH)) {
    const b = read.enemies.get(Number(t)).row.behaviour ?? 'General';
    if (m.creature) assert.ok(b === 'General' || b === 'Spectral', `mobile ${t} (${b}) is matched to ${m.creature} - a flyer or swimmer needs a Morrowind one that moves as it does`);
    if (m.creature && b === 'Spectral') assert.equal(m.veil, true, `${t}: the spectral dead seen through, as the classic ghost is`);
  }
  for (const t of [257, 260, 283]) assert.ok(DEX_CREATURE_MATCH[t].miss, `${t}: a flyer or a wisp keeps its sprite`);
});

test('DEX7-3 THE PEOPLE: a lizard man an Argonian, dressed and armed from its own table as an orc is; every class a person by the class law; every rider - and only a rider - keeps its sprite', () => {
  reset();
  installEnemyExpansion({ on: false, log: silent });
  const names = fifty();
  for (const t of [258, 259]) {
    const f = foe(t);
    assert.equal(names.get(t).startsWith('Lizard'), true);
    assert.equal(isPersonFoe(f), true, `${names.get(t)}: a person`);
    assert.equal(creatureLook(f), null, 'never a creature');
    const look = foeLook(f);
    assert.equal(look.race, 'Argonian');
    assert.ok(look.items.some((it) => it.equipSlot === EQUIP_SLOTS.ChestClothes), 'the Bay\'s clothes under nothing');
    assert.equal(foeActor(f).look, look);
    const r = rosterLook({}, { mobileType: t, seed: 7 });
    assert.equal(r.race, 'Argonian', 'a roster\'s too');
    assert.ok(!r.items.some((it) => it.equipSlot === EQUIP_SLOTS.RightHand), 'and no blade: DFU arms no monster of the mod\'s');
  }
  const classes = [...names].filter(([id]) => isClassEnemyId(id));
  assert.equal(classes.length, 15);
  const riders = classes.filter(([, n]) => /\bRider$/.test(n)).map(([id]) => id).sort((a, b) => a - b);
  assert.deepEqual(riders, [386, 387, 392, 397, 398]);
  assert.deepEqual(Object.entries(DEX_PERSON_FOES).filter(([, p]) => p.sprite).map(([t]) => Number(t)).sort((a, b) => a - b), riders, 'the sprites are the riders');
  for (const [id, name] of classes) {
    const f = foe(id);
    const rider = riders.includes(id);
    assert.equal(isPersonFoe(f), !rider, `${name}: ${rider ? 'its sprite' : 'a person'}`);
    assert.equal(isBodyFoe(f), !rider);
    if (rider) assert.equal(rosterLook({}, { mobileType: id, seed: 3 }), null, `${name}: no roster body either`);
    else assert.equal(foeLook(f).race !== undefined, true);
  }
  reset();
});

test('DEX7-4 the looks at the door: after the install, whatever the switch, a matched monster stands in its creature, a miss keeps its sprite, the classic table untouched; a named spectral (Lysandus) keeps his', () => {
  for (const on of [false, true]) {
    reset();
    installEnemyExpansion({ on, log: silent });
    for (const [t, m] of Object.entries(DEX_CREATURE_MATCH)) {
      const f = foe(Number(t));
      const look = creatureLook(f);
      if (m.creature) {
        assert.deepEqual(look?.creature, m.creature, `${t}: its creature (switch ${on})`);
        assert.equal(look.veil, m.veil ? SPECTRAL_VEIL : undefined);
        assert.ok(Object.isFrozen(look) && creatureLook({ ...f }) === look, 'one frozen look a kind');
        assert.equal(isBodyFoe(f), true);
      } else if (!DEX_PERSON_FOES[t]) {
        assert.equal(look, null, `${t}: its sprite`);
        assert.equal(isBodyFoe(f), false);
      }
      assert.deepEqual({ ...creatureMatch(Number(t)) }, m);
    }
    assert.equal(creatureLook(foe(273, { archive: 473 })), null, 'a wraith in another\'s archive is a named spectral');
    assert.equal(creatureLook(foe(275)), null, 'King Lysandus keeps his own');
  }
  assert.deepEqual(Object.keys(CREATURE_MATCH).map(Number).sort((a, b) => a - b), Object.values(MOBILE_TYPES).filter((t) => t < 128).sort((a, b) => a - b), 'the classic census is DFU\'s alone');
  reset();
  assert.equal(creatureLook(foe(256)), null, 'the seam lets the rows go');
  assert.equal(creatureMatch(256), null);
  assert.equal(isPersonFoe(foe(386)), true, 'a rider a class again, without the mod\'s row');
});

test('DEX7-5 the doors refuse what the classic audits refuse: a classic or a class mobile, a mobile named twice, both or neither, ids as the reader does not keep them, a flyer or a swimmer in a walker; a person of no race of the Bay\'s', () => {
  reset();
  ENEMY_BASICS[520] = { behaviour: 'Flying' };   // monsters past the classic ids (no 128 bit)
  ENEMY_BASICS[521] = { behaviour: 'Aquatic' };
  try {
    const bad = [
      [[[MOBILE_TYPES.Rat, { creature: ['rat'] }]], /already named/],
      [[[400, { creature: ['rat'] }]], /a class/],
      [[[600, { creature: ['rat'], miss: 'no rat here' }]], /never both/],
      [[[600, {}]], /never both/],
      [[[600, { creature: ['Rat'] }]], /as the reader keeps them/],
      [[[600, { miss: 'no' }]], /says why/],
      [[[520, { creature: ['cliff racer'] }]], /moves as it does/],
      [[[521, { creature: ['slaughterfish'] }]], /moves as it does/],
    ];
    for (const [rows, why] of bad) assert.throws(() => registerCreatureMatches(rows), why);
    registerCreatureMatches([[520, { creature: ['cliff racer'], flies: true }], [600, { miss: 'no such beast' }]]);
    assert.equal(creatureLook({ mobileType: 520 }).flies, true, 'a flyer in a flyer');
    assert.throws(() => registerCreatureMatches([[600, { miss: 'again, no such beast' }]]), /already named/);
    for (const [rows, why] of [
      [[[MOBILE_TYPES.Orc, { race: 'Orc' }]], /classic/],
      [[[MOBILE_TYPES.Knight, { sprite: 'a knight on foot' }]], /classic/],
      [[[600, { race: 'Argonian', sprite: 'a lizard on a horse' }]], /never both/],
      [[[600, { race: 'Dwemer' }]], /none of the Bay's/],
      [[[600, { sprite: 'no' }]], /says why/],
    ]) assert.throws(() => registerPersonFoes(rows), why);
  } finally {
    delete ENEMY_BASICS[520]; delete ENEMY_BASICS[521];
    reset();
  }
});

test('DEX7-6 once a page: the install puts both tables on their doors once (a second install, or a second game\'s, adds nothing), and the seam lets both go', () => {
  reset();
  assert.equal(installDexBodies(), true);
  assert.equal(installDexBodies(), false);
  assert.doesNotThrow(() => installEnemyExpansion({ on: true, log: silent }), 'the install after it registers nothing twice');
  assert.deepEqual(creatureLook(foe(281))?.creature, ['mudcrab']);
  assert.equal(isPersonFoe(foe(392)), false);
  reset();
  assert.equal(isPersonFoe(foe(392)), true);
  assert.equal(installDexBodies(), true, 'registers again after the seam');
  reset();
});

// AUDIT DEX B2: A NOSHADOW ROW'S BODY CASTS NONE. SetupDemoEnemy.cs:137-140 (`if (dfMobile.Enemy.NoShadow)
// meshRenderer.shadowCastingMode = Off`) is setupFoeLook's `noShadow` on the billboard - but a body standing in the
// billboard's place casts for it (MWNPC16: the flat cast-only, the shadow pass passes it over), and the body's cast read
// the dissolve and never the row, so the classic vampires, the frost and fire daedra and the fire atronach - and the mod's
// NoShadow rows - threw their Morrowind bodies' shadows. foeFx carries the flat's noShadow to the body (net/peer/peerBodies.js
// `cast`); a corpse's flat carries none of it (DFU's NoShadow is the mobile's renderer; a corpse is another billboard).
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
/** A body rig that records what the lane asks of it: each draw's `cast`, each unseen cast. */
const recordingRig = (rigs) => () => {
  const r = { mode: 'first', draws: [], casts: [], skinned: false,
    attach() {}, async build() { await settle(1); return { ok: true }; },
    canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
    thirdActive: () => r.mode === 'third' && r.skinned,
    update(dt, opts) { if (opts?.pose !== false) r.skinned = true; },
    drawThird(_c, o) { r.draws.push(o.cast); return r.thirdActive(); },
    castThird(o) { r.casts.push(o); return true; },
    unload() {}, setSheathed() {}, revive() {},
  };
  rigs.push(r);
  return r;
};
const PROJ = perspective(1.2, 1.5, 0.1, 200), VIEW = lookAt([0, 1.6, 0], [0, 1.6, -1], [0, 1, 0]);   // looking down -z
const standing = (id, z) => ({ id, name: '', told: true, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, cn: 0 } });
/** The lane's bodies for one foe's fx, one in the view and one behind the eye: what each was asked to cast. */
async function castsFor(fx) {
  const rigs = [];
  const pb = new PeerBodies({ renderer: {}, createRig: recordingRig(rigs), buildOpts: () => ({}), now: () => 1000, casts: true });
  for (let i = 0; i < 4; i++) { pb.sync([standing('seen', -5), standing('unseen', 5)], (p) => [p.x, p.y, p.z], 1 / 60, [0, 0, 0]); await settle(); pb.draw({}, { proj: PROJ, view: VIEW, eye: [0, 1.6, 0], fxOf: () => fx }); }
  const [seen, unseen] = rigs;
  return { drawn: seen.draws, cast: seen.draws.length > 0 && seen.draws.every((c) => c === true), unseenCast: unseen.casts.length > 0 };
}

test('DEX7-7 A NOSHADOW ROW\'S BODY CASTS NONE (AUDIT DEX B2): the flat setupFoeLook dresses carries the row\'s NoShadow to the body through foeFx, and the body casts nothing, seen or not; a casting row\'s body casts, and a corpse\'s flat carries none of the row\'s (mutants: the body\'s cast blind to the row; foeFx drops it)', async (t) => {
  t.after(reset);
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const NO_SHADOW = [MOBILE_TYPES.Vampire, MOBILE_TYPES.VampireAncient, MOBILE_TYPES.FrostDaedra, MOBILE_TYPES.FireDaedra, MOBILE_TYPES.FireAtronach];
  assert.deepEqual(NO_SHADOW, [28, 30, 25, 26, 35]);
  for (const id of [...NO_SHADOW, 273, 274, 275, 283]) assert.equal(ENEMY_BASICS[id].noShadow, true, `${id}: a NoShadow row`);
  const vampire = { ...foe(MOBILE_TYPES.Vampire), batch: setupFoeLook({ archive: ENEMY_BASICS[28].maleTexture }, MOBILE_TYPES.Vampire) };
  assert.equal(vampire.batch.noShadow, true, 'SetupDemoEnemy: the row\'s NoShadow on the mobile\'s renderer');
  const fx = foeFx(vampire);
  assert.ok(fx && fx.noShadow === true, 'the flat\'s noShadow, handed to the body');
  assert.equal(foeFx(vampire), fx, 'in one object a foe, rewritten in place');
  const dark = await castsFor(fx);
  assert.ok(dark.drawn.length > 0 && dark.drawn.every((c) => c === false), 'seen: drawn, casting nothing');
  assert.equal(dark.unseenCast, false, 'unseen: not cast either');
  // a casting row: no tell at all, and the body casts
  const orc = { ...foe(MOBILE_TYPES.Orc), batch: setupFoeLook({ archive: ENEMY_BASICS[MOBILE_TYPES.Orc].maleTexture }, MOBILE_TYPES.Orc) };
  assert.equal(orc.batch.noShadow, undefined);
  assert.equal(foeFx(orc), null, 'a plain foe wears no tell');
  const lit = await castsFor(foeFx(orc));
  assert.equal(lit.cast, true, 'seen: drawn casting');
  assert.equal(lit.unseenCast, true, 'and unseen');
  // the same foe once its row's NoShadow is gone from its flat casts again - the field is read each frame
  vampire.batch.noShadow = undefined;
  assert.equal(foeFx(vampire), null, 'nothing left to tell');
  // a corpse is another billboard: the dead vampire's corpse flat carries none of the row's
  const corpse = { archive: ENEMY_BASICS[28].maleTexture };
  assert.equal(foeFx(vampire, corpse), null, 'the corpse\'s flat: no NoShadow of the mobile\'s');
  assert.equal((await castsFor(foeFx(vampire, corpse))).cast, true, 'the body on the corpse casts, as DFU\'s corpse billboard does');
});
