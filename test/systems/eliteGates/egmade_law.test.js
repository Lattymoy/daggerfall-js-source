// EG-H2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 24, slice EG7, and
// sections 10.7, 10.8 and 17.4): THE MADE LEVEL'S RULES - one law (systems/madeLevel.js) for the Burning Court, the
// Shattered Hour and the Spire: `madeLevelOf` over each made location's own producer, MADE_LEVEL_RULES and their words as
// data; the Burning Court and the Hour re-plugged UNCHANGED (every door's old decision and words, rule by rule); each of
// the Spire's rules at its own door, run - THE POTION LAW through the item's use, a technique's flight refused on the
// traversal ground, THE FORGIVENESS on the real motor, DEATH-PENALTY's line, the one Levitate ward, the breach client's
// traversal ground and its half of THE LAW PIN; and THE SWEEP - every rule's door reads the law and asks no level itself.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { madeLevelOf, madeLevelRule, madeLevelSays, madeLevelHere, madeRuleHere, madeSaysHere, madeOnTraverse, registerMadeLevelHere, MADE_LEVELS, MADE_LEVEL_RULES, MADE_LEVEL_RULE_KEYS, MADE_LEVEL_TEXT,
  EG_JUMP_BUFFER_S, EG_LATE_PRESS_S, EG_NO_FLIGHT_TEXT } from '../../../src/systems/madeLevel.js';
import { gateArenaLocation, COURT_TEXT } from '../../../src/world/gate/gateArena.js';
import { sdRealmLocation, SD_REALM_TEXT } from '../../../src/world/superDungeon/sdRealm.js';
import { egHallLocation, EG_HALL_TEXT } from '../../../src/world/eliteGates/egHall.js';
import { EG_TEXT, EG_SPEC, egHallOf, egCircleSpecs, egOnFight, egSpecForget, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): a law 8 circle given
import { registerSpirePotionLaw, spirePotionRefusal, SPIRE_POTION_TEXT } from '../../../src/systems/eliteGates/spireKit.js';
import { POTION_RECIPES, potionRecipeKey } from '../../../src/systems/potionRecipes.js';
import { useItem } from '../../../src/systems/useItem.js';
import { TEMPLATES } from '../../../src/systems/item/itemKinds.js';
import { PlayerMotor, registerJumpForgiveness } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { stepTris } from '../../../src/world/superDungeon/sdStepsModel.js';
import { registerLevitateWard, levitateWarded } from '../../../src/characters/playerEntity.js';
import { DeathScreen } from '../../../src/ui/deathScreen.js';
import { stateDeathLoss, statedDeathLoss } from '../../../src/systems/deathPenalty.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import * as T from '../../../src/combat/techniques.js';
import { PlayerWeapon } from '../../../src/combat/playerWeapon.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { setSigilDueling } from '../../../src/systems/sigil/sigil.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { ketchShipLocation } from '../../../src/world/ketch/ketchShip.js';   // PIN MOVED (KETCH): the sky-ketch, a fourth made level
import { KT_WORDS } from '../../../src/systems/ketch/ketchWords.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** The world host's word, for a test: the made level under the player is `lv` (and its feet on traversal ground or not). */
const here = (lv, traverse = false) => registerMadeLevelHere(() => lv, () => traverse);

test('EG-H2 THE LAW (section 24): madeLevelOf names each made location by its own producer - the Burning Court, the Shattered Hour, the Spire - and nothing else; MADE_LEVEL_RULES is the page\'s table as the doors read it, every rule named in every row; each level refuses in its own home\'s words; a rule of no level is the game\'s own (null, or no forgiveness); the world host\'s word answers where the player stands, and a word that throws or names no level is none (mutants: a level misnamed; a row changed; a word not its home\'s; the throw believed)', () => {
  assert.equal(madeLevelOf(gateArenaLocation({ day: 0 })), 'court', 'the court of day zero is a court');
  assert.equal(madeLevelOf(gateArenaLocation({ day: 12 })), 'court');
  assert.equal(madeLevelOf(sdRealmLocation({ s: 3 })), 'hour');
  assert.equal(madeLevelOf(sdRealmLocation({ s: 0 })), 'hour', 'any slot is an Hour - slot zero too');
  assert.equal(madeLevelOf(egHallLocation({ b: '0123456789abcdef', seed: 9, c: 2 })), 'spire');
  assert.equal(madeLevelOf(ketchShipLocation({ n: 0, owner: '0123456789abcdef' })), 'ketch', 'PIN MOVED (KETCH): a crew\'s ship');
  for (const loc of [null, undefined, {}, { name: 'Old Maze', dungeon: { recordElement: { header: { locationId: 99 } } } }, { ...sdRealmLocation({ s: 3 }), sdRealm: null }]) assert.equal(madeLevelOf(loc), null);
  assert.deepEqual([...MADE_LEVELS], ['court', 'hour', 'spire', 'ketch']);   // PIN MOVED (KETCH)
  const none = Object.fromEntries(MADE_LEVEL_RULE_KEYS.map((k) => [k, k === 'jumpBuffer' || k === 'latePress' ? 0 : null]));
  // PIN MOVED (EG-PERFECT, 2026-10-18): the running leap refused on the Spire's spans and the Hour's Steps (`runLeap` -
  // test/player/egperfect_runleap.test.js runs it on the real motor)
  assert.deepEqual(MADE_LEVEL_RULES, {
    court: { ...none, save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', portalStone: 'refused', companions: 'out', regen: 'off', death: 'castOut', unstuck: 'refused', says: 'mid' },
    hour: { ...none, save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', recall: 'refused', portalStone: 'refused', companions: 'out', regen: 'off', levitate: 'banned', runLeap: 'refused', resurrect: 'refused', death: 'final', unstuck: 'wayHome', says: 'hour' },
    spire: { ...none, save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', recall: 'refused', portalStone: 'refused', companions: 'out', regen: 'off', potions: 'counted', levitate: 'banned', slowfall: 'banned',
      techFlight: 'refused', jumpBuffer: 0.12, latePress: 0.12, runLeap: 'refused', resurrect: 'refused', avoidDeath: 'refused', death: 'fall', deathPenalty: 'none', unstuck: 'refused', says: 'mid' },
    // PIN MOVED (KETCH, bible/11-Multiplayer/Sky-Ketch.md section 3): the Hour's row for the deck, the Spire's for flight, a death a fall
    ketch: { ...none, save: 'refused', rest: 'refused', automap: 'off', mark: 'refused', recall: 'refused', portalStone: 'refused', companions: 'out', regen: 'off', levitate: 'banned', slowfall: 'banned',
      techFlight: 'refused', runLeap: 'refused', resurrect: 'refused', avoidDeath: 'refused', death: 'fall', deathPenalty: 'none', unstuck: 'refused', says: 'mid' },
  });
  for (const lv of MADE_LEVELS) { assert.ok(Object.isFrozen(MADE_LEVEL_RULES[lv])); assert.deepEqual(Object.keys(MADE_LEVEL_RULES[lv]), [...MADE_LEVEL_RULE_KEYS], lv); }
  assert.deepEqual([EG_JUMP_BUFFER_S, EG_LATE_PRESS_S], [0.12, 0.12], 'section 10.8: 0.12 s each');
  assert.deepEqual(MADE_LEVEL_TEXT, {
    court: { save: COURT_TEXT.noSave, rest: COURT_TEXT.noRest, automap: COURT_TEXT.noMap, mark: COURT_TEXT.noMark, unstuck: COURT_TEXT.noUnstuck },
    hour: { save: SD_REALM_TEXT.noSave, rest: SD_REALM_TEXT.noRest, automap: SD_REALM_TEXT.noMap, mark: SD_REALM_TEXT.noMark, recall: SD_REALM_TEXT.noRecall },
    spire: { save: EG_HALL_TEXT.noSave, rest: EG_HALL_TEXT.noRest, automap: EG_HALL_TEXT.noMap, mark: EG_TEXT.noRecall, recall: EG_TEXT.noRecall, unstuck: `${EG_TEXT.noRecall} The way home stands at a Redoubt.`, techFlight: EG_NO_FLIGHT_TEXT },
    // PIN MOVED (KETCH): her own words, read in the player's language when she refuses (systems/ketch/ketchWords.js)
    ketch: { save: KT_WORDS.noSave, rest: KT_WORDS.noRest, automap: KT_WORDS.noMap, mark: KT_WORDS.noMark, recall: KT_WORDS.noRecall, unstuck: KT_WORDS.noUnstuck, techFlight: KT_WORDS.noFlight },
  });
  assert.deepEqual([madeLevelRule(null, 'save'), madeLevelRule('arena', 'save'), madeLevelRule('spire', 'nope'), madeLevelRule(null, 'jumpBuffer'), madeLevelRule('court', 'latePress')], [null, null, null, 0, 0]);
  assert.deepEqual([madeLevelSays(null, 'save'), madeLevelSays('court', 'recall'), madeLevelSays('spire', 'regen')], ['', '', '']);
  try {
    here('spire', true);
    assert.deepEqual([madeLevelHere(), madeRuleHere('potions'), madeSaysHere('save'), madeOnTraverse()], ['spire', 'counted', EG_TEXT.noSave, true]);
    registerMadeLevelHere(() => 'arena');
    assert.equal(madeLevelHere(), null, 'a word that names no made level is none');
    registerMadeLevelHere(() => { throw new Error('x'); }, () => { throw new Error('y'); });
    assert.deepEqual([madeLevelHere(), madeRuleHere('save'), madeOnTraverse()], [null, null, false], 'a word that throws is none');
  } finally { registerMadeLevelHere(null); }
  assert.equal(madeLevelHere(), null);
  // the mode machine's accessor: the made level of the dungeon standing, null in every other mode
  assert.match(read('src/scenes/worldModes.js'), /madeLevel: \(\) => \(mode === 'dungeon' \? madeLevelOf\(dungeonLoc\) : null\),/);
});

test('EG-H2 THE BURNING COURT AND THE HOUR, UNCHANGED (section 24): rule by rule, the law decides as each door did before it - the saves, the rest and the map refused in each level\'s own words; the Mark refused in both and the Recall in the Hour alone (the court refuses the Mark only), each in its own voice (the mid-screen line, the Hour\'s); companions out; no regeneration; Levitate warded in the Hour and never in the court; Resurrect refused in the Hour and not in the court; a death cast out of the court and final for the Hour\'s Hollow; /unstuck refused in the court in its words and the Hour\'s way home in the Hour; no forgiveness, no slowfall ban, no technique refusal, no potion count, no AvoidDeath refusal and the DEATH-PENALTY in both, as before (mutants: any of the two columns moved)', () => {
  // what each door did before the law, from the doors' own text at 4f0e71965 (each `modes?.gateArenaDay?.()`, `modes?.sdRealmSlot?.()`,
  // `isGateArena(dfLocation)`, `_sdRealm` arm), and what the law decides now
  const before = {
    court: { save: [true, COURT_TEXT.noSave], rest: [true, COURT_TEXT.noRest], automap: [true, COURT_TEXT.noMap], mark: [true, COURT_TEXT.noMark, 'mid'], recall: [false], companions: true, regen: true,
      levitate: false, resurrect: false, death: 'castOut', unstuck: ['refused', COURT_TEXT.noUnstuck], portalStone: true },
    hour: { save: [true, SD_REALM_TEXT.noSave], rest: [true, SD_REALM_TEXT.noRest], automap: [true, SD_REALM_TEXT.noMap], mark: [true, SD_REALM_TEXT.noMark, 'hour'], recall: [true, SD_REALM_TEXT.noRecall, 'hour'], companions: true, regen: true,
      levitate: true, resurrect: true, death: 'final', unstuck: ['wayHome'], portalStone: true },
  };
  for (const [lv, d] of Object.entries(before)) {
    for (const r of ['save', 'rest']) assert.deepEqual([madeLevelRule(lv, r) === 'refused', madeLevelSays(lv, r)], d[r], `${lv} ${r}`);
    assert.deepEqual([madeLevelRule(lv, 'automap') === 'off', madeLevelSays(lv, 'automap')], d.automap, `${lv} map`);
    assert.deepEqual([madeLevelRule(lv, 'mark') === 'refused', madeLevelSays(lv, 'mark'), madeLevelRule(lv, 'says')], d.mark, `${lv} Mark`);
    assert.deepEqual(madeLevelRule(lv, 'recall') === 'refused' ? [true, madeLevelSays(lv, 'recall'), madeLevelRule(lv, 'says')] : [false], d.recall, `${lv} Recall`);
    assert.equal(madeLevelRule(lv, 'companions') === 'out', d.companions, `${lv} companions`);
    assert.equal(madeLevelRule(lv, 'regen') === 'off', d.regen, `${lv} regeneration`);
    assert.equal(madeLevelRule(lv, 'levitate') === 'banned', d.levitate, `${lv} Levitate`);
    assert.equal(madeLevelRule(lv, 'resurrect') === 'refused', d.resurrect, `${lv} Resurrect`);
    assert.equal(madeLevelRule(lv, 'death'), d.death, `${lv} a death`);
    assert.deepEqual(madeLevelRule(lv, 'unstuck') === 'refused' ? ['refused', madeLevelSays(lv, 'unstuck')] : [madeLevelRule(lv, 'unstuck')], d.unstuck, `${lv} /unstuck`);
    assert.equal(madeLevelRule(lv, 'portalStone') === 'refused', d.portalStone, `${lv} the Portal Stone (no portal in any dungeon)`);
    for (const r of ['potions', 'slowfall', 'techFlight', 'avoidDeath', 'deathPenalty']) assert.equal(madeLevelRule(lv, r), null, `${lv} ${r}: as today`);
    assert.deepEqual([madeLevelRule(lv, 'jumpBuffer'), madeLevelRule(lv, 'latePress')], [0, 0], `${lv}: DFU's motor`);
  }
  // the one ward, run: the world host's own registration over the law
  try {
    registerLevitateWard(() => madeRuleHere('levitate') === 'banned');
    for (const [lv, warded] of [['court', false], ['hour', true], ['spire', true], [null, false]]) { here(lv); assert.equal(levitateWarded(), warded, `${lv} warded`); }
  } finally { registerLevitateWard(null); registerMadeLevelHere(null); }
});

test('EG-H2 THE SPIRE\'S RULES AT THEIR DOORS (sections 10.7, 10.8, 17.4, 24), run: THE POTION LAW counts two restoring potions a hall where the law says so and nowhere else; a technique\'s leap refused on the Spire\'s traversal ground in its words, nothing paid, and free on a fight floor, in the court and in the Hour; THE FORGIVENESS on the real motor - a jump pressed 0.08 s before landing fires on it and a plain jump 0.05 s off an edge still leaps, in the Spire alone; the Spire\'s death screen states no loss and its respawn takes none (mutants: the count everywhere; the flight unrefused; the buffer or the late press anywhere but the Spire, or nowhere; the penalty stated)', () => {
  // THE POTION LAW
  const key = (name) => potionRecipeKey(POTION_RECIPES.find((r) => r.name === name).ingredients);
  let left = 2;
  registerSpirePotionLaw({ allowed: () => left > 0, used: () => { left--; } });
  const bottle = () => ({ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, potionRecipeKey: key('healing'), name: 'Healing' });
  const drink = (pack) => { const it = bottle(); pack.push(it); return useItem(it, pack, { drinkPotion: () => 'Healing' }).kind; };
  try {
    here('court');
    const court = [];
    assert.deepEqual([drink(court), drink(court), drink(court)], ['potion', 'potion', 'potion'], 'the court counts none (as today)');
    assert.equal(left, 2, 'nothing counted outside the Spire');
    here('spire');
    const pack = [];
    assert.deepEqual([drink(pack), drink(pack), drink(pack)], ['potion', 'potion', 'refused'], 'two a hall in the Spire');
    assert.equal(spirePotionRefusal(bottle()), SPIRE_POTION_TEXT);
    assert.equal(pack.length, 1, 'the refused bottle kept');
  } finally { registerSpirePotionLaw(null); registerMadeLevelHere(null); }
  // THE TECHNIQUE'S FLIGHT
  const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const leapSword = () => { const it = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(7)); it.isIdentified = true; LR.addTechniqueLine(it, () => 0.5, { id: 'leap' }); LR.techniqueLineOf(it).value = 20; return it; };
  const press = (lv, traverse) => {
    _resetForTests(); setPref('lootRarity', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null);
    here(lv, traverse);
    const me = { isPlayer: true, level: 8, items: [], stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [] };
    const pw = new PlayerWeapon({ weapon: leapSword(), liveSpeed: 50 }); pw.sheathed = false; pw.update(0);
    const said = [];
    T.stepTechnique(1 / 60, { rig: {}, entity: me, pw, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.2, feet: [0, 0, 0] }, collider: { raycast: () => Infinity, surfaceHit: () => null, heightAt: () => 0 }, held: true, ready: true, cancel: false,
      startSwing: () => true, door: { motor: () => ({ grounded: true, techniqueLaunch: () => true }) }, say: (l) => said.push(l), noteShot: () => {} });
    return { said: said.at(-1) ?? null, fatigue: me.fatigue };
  };
  try {
    assert.deepEqual(press('spire', true), { said: EG_NO_FLIGHT_TEXT, fatigue: 6400 }, 'on the Spire\'s traversal ground: refused, nothing paid');
    assert.equal(press('spire', false).said, null, 'on a fight floor: a technique');
    assert.equal(press('court', true).said, null, 'the court: as today');
    assert.equal(press('hour', true).said, null, 'the Hour: as today');
  } finally { registerMadeLevelHere(null); T._resetTechniquesForTests(); _resetForTests(); }
  // THE FORGIVENESS, on the real motor, through the world host's own registration
  const slab = (col, k, y) => { const { positions, indices } = stepTris('drift'); col.addMesh(k, positions, indices, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, y, 0, 1]); };
  const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
  const latePress = () => {
    const col = new Collider(() => -Infinity); slab(col, 'a', 10);
    const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 }); m.spawn(0, 10, 0);
    for (let k = 0; k < 30; k++) m.update(1 / 60, still(), 0);
    let off = null, rose = false;
    for (let k = 0; k < 240 && m.pos[1] > 0; k++) {
      const go = off != null && k - off === 3;   // 0.05 s after the feet left the edge
      m.update(1 / 60, still({ forward: 1, jump: go, up: go }), 0);
      if (off == null && !m.grounded) off = k;
      if (go && m.velY > 0) rose = true;
    }
    return rose;
  };
  const buffered = () => {
    const fall = (pressAt) => {
      const col = new Collider(() => -Infinity); slab(col, 'b', 10);
      const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 }); m.spawn(0, 12, 0);
      let landed = null, rose = false;
      for (let k = 0; k < 200; k++) { const go = k === pressAt; m.update(1 / 60, still({ jump: go, up: go }), 0); if (landed == null && m.grounded) landed = k; if (pressAt != null && k >= pressAt + 1 && m.velY > 0) rose = true; }
      return { landed, rose };
    };
    const { landed } = fall(null);
    return fall(landed - 5).rose;   // a tap 0.08 s before the landing, let go at once
  };
  try {
    registerJumpForgiveness(() => madeRuleHere('jumpBuffer'), () => madeRuleHere('latePress'));
    here('spire');
    assert.equal(buffered(), true, 'the Spire: a press just before landing fires on it');
    assert.equal(latePress(), true, 'the Spire: a plain jump just off an edge still leaps');
    for (const lv of ['court', 'hour', null]) { here(lv); assert.deepEqual([buffered(), latePress()], [false, false], `${lv}: DFU's gate swallows both`); }
  } finally { registerJumpForgiveness(null, null); registerMadeLevelHere(null); }
  // DEATH-PENALTY: the screen states none where the law exempts it (the dungeon host hands `penalty`), a tenth elsewhere
  const who = () => ({ goldPieces: 345, items: [], level: 10, race: 0, gender: 0 });
  stateDeathLoss(null);
  const spire = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: who(), online: true, penalty: madeLevelRule('spire', 'deathPenalty') !== 'none' });
  assert.deepEqual([spire.goldLoss, statedDeathLoss()], [0, 0], 'the Spire: nothing stated, nothing taken');
  stateDeathLoss(null);
  const court = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: who(), online: true, penalty: madeLevelRule('court', 'deathPenalty') !== 'none' });
  assert.deepEqual([court.goldLoss, statedDeathLoss()], [34, 34], 'the court: the tenth, as today');
  stateDeathLoss(null);
});

test('EG-H2 THE SPIRE\'S TRAVERSAL GROUND AND THE CLIENT\'S LAW PIN (sections 10.7, 22): the breach client says my feet are on traversal ground off a hall\'s fight floor (a span\'s course, the void between halls) and not on it, and never as a witness or outside; a breach of another law than mine has each hall of my circle asked once (`{k:\'spec\'}`), I am told once, the halls given are read before any draw, and with all five given the circle standing is built again (mutants: the fight floor called traversal; the spec never asked; asked every frame; the given halls unread; the circle never rebuilt)', async () => {
  let clock = 1_800_000_000_000 + EG_SEALED_MS + 60_000;
  const co = [['acct-0', 'Mac', 1]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: 77, op: 1_800_000_000_000, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 30, clock);
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the circle given at spec law 8 (test/egGive8.mjs): the feet stood at
  // the plate's height on law 8's yard and span (a LAW 9 hall's floors stand at their own heights - test/net/eliteGates/law9_height.test.js's
  // traversal ground by the feet)
  egGive8(77, [1]);
  const circle = egCircleSpecs(77, 1, 0);
  const yard = circle.find((s) => (s.fl ?? []).length), span = circle.find((s) => s.kind === 'span');
  B.h = yard.h; B.sg = 'trial'; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const sent = [], said = [];
  let rebuilt = 0, spireHere = true;
  const player = { pos: [0, 0, 0], height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => (spireHere ? B.b : null), egHallCircle: () => 1, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async () => { rebuilt++; return true; } };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock,
    entity: { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] }, player, cam: { pos: [0, 0, 0] }, say: (t) => said.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {} });
  const tell = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(B, clock));
  const stand = (spec, x, z) => { player.pos = realmToDungeon(spec.x0 + x, 0, z); };
  const f = yard.fl[0], fx = f.t === 'd' ? f.x : (f.ax + f.bx) / 2, fz = f.t === 'd' ? f.z : (f.az + f.bz) / 2;
  assert.equal(egOnFight(yard, fx, fz), true);
  stand(yard, fx, fz);
  assert.equal(client.onTraverse(), false, 'on a fight floor: no traversal ground');
  const course = (span.steps ?? []).find((q) => Number.isFinite(q.x) && Number.isFinite(q.z) && !egOnFight(span, q.x, q.z));
  assert.ok(course, 'a step of the span off every fight floor');
  stand(span, course.x, course.z);
  assert.equal(client.onTraverse(), true, 'a span\'s course: traversal ground');
  player.pos = realmToDungeon(yard.x0 + 250, 0, 20);
  assert.equal(client.onTraverse(), true, 'the void between the halls');
  spireHere = false;
  assert.equal(client.onTraverse(), false, 'outside the Spire: none');
  spireHere = true;
  stand(yard, fx, fz);
  // THE LAW PIN, the client's half: a breach of another law
  assert.equal(sent.filter((w) => w.k === 'spec').length, 0, 'my own law: nothing asked');
  B.egv = EG_SPEC - 1;
  tell(egStateOf(B, clock));
  client.frame(); client.frame();
  const asked = sent.filter((w) => w.k === 'spec').map((w) => w.h);
  assert.deepEqual(asked, [1, 2, 3, 4, 5], 'each hall of my circle asked, once');
  assert.equal(said.filter((t) => t === 'The Spire sends you this breach\'s halls.').length, 1, 'told once');
  try {
    for (const h of [1, 2, 3, 4]) tell({ k: 'spec', egv: B.egv, h, sp: { ...JSON.parse(JSON.stringify(egHallOf(77, h, 0))), laid: 90 + h } });
    assert.equal(egHallOf(77, 2, 0).laid, 92, 'a given hall read before any draw');
    assert.equal(rebuilt, 0, 'four of five: not yet');
    tell({ k: 'spec', egv: B.egv, h: 5, sp: { ...JSON.parse(JSON.stringify(egHallOf(77, 5, 0))), laid: 95 } });
    await new Promise((r) => setImmediate(r));
    assert.equal(rebuilt, 1, 'the circle built again from its given halls');
    tell({ k: 'spec', egv: B.egv, h: 5, sp: { ...JSON.parse(JSON.stringify(egHallOf(77, 5, 0))), laid: 95 } });
    assert.equal(rebuilt, 1, 'once');
    clock += 10_000; client.frame();
    assert.equal(sent.filter((w) => w.k === 'spec').length, 5, 'given halls are not asked again');
  } finally { egSpecForget(); }
});

test('EG-H2 THE SWEEP (section 24, THE ONE CONSTRUCTION SEAM): every rule\'s door in the hosts and the systems reads the made level\'s law for its rule and asks no made level itself; no line anywhere pairs a level\'s own predicate with a rule\'s act; every rule the law names is read at a door (mutants: a door asking the level again; a rule no door reads)', () => {
  const PRED = /gateArenaDay|sdRealmSlot|egHallBreach|isGateArena\(|isSdRealm\(|isEgHall\(|\b_sdRealm\b|\b_egHall\b|diedHere\(/;
  const FILES = { W: 'src/scenes/world.js', D: 'src/scenes/dungeonContext.js', M: 'src/scenes/worldModes.js', K: 'src/systems/eliteGates/spireKit.js', T: 'src/combat/techniques.js', S: 'src/scenes/shared.js' };
  const src = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, read(p)]));
  /** [file, where the door begins, where it ends, the rules it must read] */
  const DOORS = [
    ['D', 'savingPrevented: () =>', '\n', ['save']],
    ['D', 'quickSave(saveName = QUICK_SAVE_NAME', 'const snap = snapshotPlayer(', ['save']],
    ['D', 'toggleAutomap() {', '// EM3:', ['automap']],
    ['D', 'let automapRec =', 'enterDungeonAutomap(', ['automap']],
    ['D', 'toggleRest() {', '// S40:', ['rest']],
    ['D', 'get playerSlowFalling()', '\n', ['slowfall']],
    ['D', 'const _prevAvoidDeath = setAvoidDeathHook(', 'hudText.add(avoidDeathText())', ['avoidDeath']],   // PIN MOVED (the merge of main's L10N arc): the line said through the text core
    ['D', 'activeOverlay = new DeathScreen(', '\n', ['deathPenalty']],
    ['W', 'function companionPlace(', 'const spotOf =', ['companions']],
    ['W', 'function partyCompanions() {', 'const party =', ['companions']],
    ['W', 'function madeSay(rule) {', '\n', ['says']],
    ['W', 'function setRecallAnchor() {', 'const inside =', ['mark']],
    ['W', 'async function recallToAnchor() {', 'const anchor = playerEntity.anchorPosition;', ['recall']],
    ['W', 'const goldLost = wildKilled', '\n', ['deathPenalty']],   // PIN MOVED (FOE-KEEPS): a kill in the zone, no longer any death there
    ['W', 'const diedInHour =', 'const spireBack', ['death']],
    ['W', 'if (/^\\/unstuck(\\s+cancel)?$/i.test(text.trim())) {', 'const inZone =', ['unstuck']],
    ['W', 'registerLevitateWard(() =>', '\n', ['levitate']],
    ['W', 'registerJumpForgiveness(', '\n', ['jumpBuffer', 'latePress']],
    ['W', 'arenaFrame(dt);   // ARENA2', 'egCourtFrame();', ['regen']],
    ['W', 'if (!_rezSeen) _rezSeen =', 'if (rez && legacyHost', ['resurrect']],   // PIN MOVED (REZ-BLOODLINE, at the seventh merge of main): the rise asks Project Legacy first
    ['W', 'const portalDoorRefusal = () => {', 'const hold = portalHoldNow();', ['portalStone']],
    ['K', 'export function spirePotionRefusal(item) {', 'try {', ['potions']],
    ['K', 'export function spirePotionDrunk(item) {', 'try {', ['potions']],
    ['T', 'export function refusal(hand, ctx) {', '\n}\n', ['techFlight']],
    ['S', 'export function parkourDeps(', '\n}\n', ['runLeap']],   // EG-PERFECT: the running leap's door, the four hosts' one parkour deps
  ];
  const readRules = new Set();
  for (const [f, from, to, rules] of DOORS) {
    const s = src[f], a = s.indexOf(from);
    assert.ok(a >= 0, `${FILES[f]}: the door at ${from}`);
    assert.equal(s.indexOf(from, a + 1), -1, `${FILES[f]}: one door at ${from}`);
    const z = s.indexOf(to, a + from.length);
    assert.ok(z > a, `${FILES[f]} ${from}: its end (${JSON.stringify(to)})`);
    const body = s.slice(a, z + to.length).split('\n').map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
    for (const r of rules) {
      assert.match(body, new RegExp(`(madeRuleHere|madeSaysHere)\\('${r}'\\)|madeLevelRule\\(_made, '${r}'\\)`), `${FILES[f]} ${from}: reads the law's ${r}`);
      readRules.add(r);
    }
    assert.doesNotMatch(body, PRED, `${FILES[f]} ${from}: asks no level itself`);
  }
  // no line of the hosts or the systems pairs a level's own predicate with a rule's act
  const ACT = /\.no(Save|Rest|Map|Mark|Recall|Unstuck)\b|setCourtRules\(|LevitateWard\(|rezFor\(|applyDeathPenalty\(|setAvoidDeathHook|detachedAutomapRecord\(|savingPrevented|playerSlowFalling|registerJumpForgiveness|spirePotion|PORTAL_TEXT\.notHere|new DeathScreen\(/;
  for (const p of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/systems/eliteGates/spireKit.js', 'src/systems/useItem.js', 'src/combat/techniques.js', 'src/characters/playerEntity.js', 'src/scenes/shared.js']) {
    read(p).split('\n').forEach((line, i) => {
      const code = line.replace(/\s\/\/ .*$/, '');
      assert.ok(!(PRED.test(code) && ACT.test(code)), `${p}:${i + 1} asks a made level itself for a rule - read systems/madeLevel.js instead: ${code.trim().slice(0, 160)}`);
    });
  }
  // every rule the law names has its door
  for (const r of MADE_LEVEL_RULE_KEYS) assert.ok(readRules.has(r), `the law's ${r} is read at a door`);
});
