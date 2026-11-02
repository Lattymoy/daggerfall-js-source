// POWER-CEILING (2026-10-27, bible/05-Combat/Power-Ceiling.md; the player: "I would hate hate hate to see go down the path
// of Retail WoW ... keeping you on a tread mill"): THE COMPOSITE CEILINGS. A blow's powers multiply across six registries
// and a hurt's guards compose across five; BAL7 (Balance-Arc.md section 13) recorded both with no ceiling. Each is held
// now to the product of today's registry tops (src/systems/powerCeiling.js), measured from the records the code reads
// (tools/powerCeiling.mjs) - pinned here by the measurement, by execution through the real registries and runners with
// the strongest kits minted by their own producers, and by a sweep of the source: every blow modifier and every guard
// asks for its room.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { setStruck, setBlow, setStrike, setDamageMod, SIGIL_SETS_POWER, _resetSetPowersForTests, _setSetPowersClockForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { SIGIL_SETS, _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { SIGIL_XP_MAX, setSigilOnline, setSigilRenown, sigilBlow, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import '../../src/systems/firmamentPowers.js';
import '../../src/systems/weaponMastery.js';
import '../../src/systems/martialPowers.js';
import '../../src/systems/arcanePowers.js';
import '../../src/systems/thunderlock.js';
import { GILDED_RECORDS } from '../../src/systems/gilded.js';
import { STARSPUN_SET_PIECES, RAID_SET_PIECES, NUMIDIUM_SET_PIECES, mintAetheric } from '../../src/systems/aetheric.js';
import { weaponBlowMods, registerWeaponBlowMod } from '../../src/systems/entityMods.js';
import { hurtPlayer, registerPlayerDamageMod } from '../../src/characters/playerEntity.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { Collider } from '../../src/player/collider.js';
import { sensesContext } from '../../src/scenes/shared.js';
import { foeUnaware } from '../../src/combat/playerWeapon.js';
import { handleAttackFromSource } from '../../src/systems/concealment.js';
import {
  BLOW_TOPS, GUARD_TOPS, BLOW_MOST, GUARD_LEAST, blowRoom, guardRoom, openBlowCeiling, closeBlowCeiling, openGuardCeiling,
  closeGuardCeiling, ceilingProducts,
} from '../../src/systems/powerCeiling.js';
import {
  measureBlowTops, measureGuardKeeps, setsBlowTop, setsGuardKeep, lootBlowTop, lootGuardKeep, productOf, keepOf, setKits,
  SET_TIER_BLOW, SET_TIER_GUARD, SET_TIER_OTHER, POWER_BLOW, POWER_GUARD, POWER_OTHER,
} from '../../tools/powerCeiling.mjs';

const RULE = 'THE CEILING HOLDS (bible/05-Combat/Power-Ceiling.md): a stronger kit needs the owner\'s word, quoted there';
const close = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} is not ${b}`);
let T = 0;
LP._setLootPowersClockForTests(() => T);
_setSetPowersClockForTests(() => T);
LP._setLootPowersRandForTests(() => 0.99);   // no evasion, no echo
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
function fresh() {
  _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests(); _resetSigilForTests();
  setPlayerDoor(null); T = 0;
  setSigilOnline(true); setSigilRenown(40);   // online, Renown 40: every stage open
}
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(50), level: 30, career: {}, activeEffects: [], health: 10000, maxHealth: 10000, magicka: 50, maxMagicka: 100 });
const wear = (e, ...items) => { for (const it of items) { e.items.push(it); equipItem(e, it); } return e; };
const ascendant = (it, set, power) => { it.sigil = { ...(power ? { power } : {}), set, party: 1, xp: SIGIL_XP_MAX }; return it; };
/** A Legendary of a record, minted by the ladder's own door. */
function legendary(id, templateIndex = null) {
  const rec = LR.legendaryById(id);
  const t = templateIndex ?? rec.templates?.[0];
  const base = rec.group === 'Weapons' ? createWeapon(t ?? 120, 0, () => 0.5)
    : mintCondition({ group: rec.group, templateIndex: t, material: rec.group === 'Armor' ? ARMOR_MATERIAL.Steel : undefined, flags: 0 });
  const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}
const rareArmor = (templateIndex) => { const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Ebony, flags: 0 }); it.rarity = 'rare'; it.affixes = []; return it; };
/** Nightwhisper, Exalted by its own door with a slayer's line against humanoids at the band's top. */
function nightwhisperExalted() {
  for (let seed = 1; seed < 20000; seed++) {
    const it = legendary('nightwhisper');
    LR.exaltLegendary(it, lcg(seed));
    const a = it.affixes.at(-1);
    if (a.id === 'slayer' && a.param === 'humanoid' && a.value === LR.AFFIX_RANGES.slayer.legendary[1]) return it;
  }
  throw new Error('no seed exalts a slayer at the top');
}

test('POWER-CEILING THE TOPS, MEASURED: each registry\'s own most from the records and laws it reads - the blow\'s +12 / +200 / +240 / +50 / +80 / +40, the guards\' 55 / 50 / 15 / 30 / 20 off - and the law\'s tables are those numbers (mutants: a top in the law raised; Bound in Silk at 150; Last Stand at 30)', () => {
  assert.deepEqual(BLOW_TOPS, { sigil: 12, sets: 200, loot: 240, firmament: 50, mastery: 400, martial: 40 }, RULE);   // PIN MOVED: WEAPON-GEAR (2026-10-27) - mastery's top the live skill's x5, was the climb's +80%
  assert.deepEqual(GUARD_TOPS, { loot: 55, sets: 50, firmament: 15, martial: 30, arcane: 20 }, RULE);
  assert.deepEqual(measureBlowTops(), BLOW_TOPS, `a record moved a registry's top onto one blow - ${RULE}`);
  const keeps = measureGuardKeeps();
  assert.deepEqual(Object.keys(keeps), Object.keys(GUARD_TOPS));
  for (const [k, v] of Object.entries(keeps)) close((1 - v) * 100, GUARD_TOPS[k], `${k}'s guards - ${RULE}`);
  close(BLOW_MOST, 119.952, 'the blow\'s product');   // PIN MOVED: WEAPON-GEAR, x43.18272 before it
  close(productOf(measureBlowTops()), BLOW_MOST, 'the measured product is the law\'s');
  close(GUARD_LEAST, 0.1071, 'the guards\' share kept');
  close(keepOf(keeps), GUARD_LEAST, 'the measured share is the law\'s');
  assert.deepEqual(setsBlowTop().kit, ['nocturnal 4', 'starspun 4'], 'the sets\' top: Nightfall and Bound in Silk');
  assert.deepEqual(setsGuardKeep().kit, ['malacath 6'], 'the sets\' guards: Unbroken');
  assert.deepEqual(lootBlowTop().kit, ['nightwhisper', 'night-mothers-embrace', 'duelists-vambrace', 'slayer 30', 'fresh']);
  assert.deepEqual(lootGuardKeep().kit, ['the-warden', 'mountains-root', 'witch-sisters-ring']);
  assert.equal(setKits().every((kit) => kit.reduce((n, [, c]) => n + c, 0) <= 9), true, 'never past the nine places');
});

test('POWER-CEILING EVERY TIER AND EVERY POWER MEASURED: each set tier and each Legendary or Gilded power kind is a blow\'s, a guard\'s or named as neither - a new one fails until it is measured (mutant: a tier dropped from the measure)', () => {
  const tiers = Object.values(SIGIL_SETS).flatMap((s) => s.tiers.map((t) => t.key));
  const known = new Set([...Object.keys(SET_TIER_BLOW), ...Object.keys(SET_TIER_GUARD), ...SET_TIER_OTHER]);
  assert.deepEqual(tiers.filter((k) => !known.has(k)), [], `a set tier the ceiling has not measured - ${RULE}`);
  assert.equal(known.size, tiers.length, 'each named once, none stale');
  const kinds = new Set([...LR.allLegendaries().map((r) => LR.powerOf(r.id)?.kind), ...GILDED_RECORDS.map((r) => r.power.kind)].filter(Boolean));
  const named = new Set([...Object.keys(POWER_BLOW), ...Object.keys(POWER_GUARD), ...POWER_OTHER]);
  assert.deepEqual([...kinds].filter((k) => !named.has(k)), [], `a power the ceiling has not measured - ${RULE}`);
  assert.deepEqual([...named].filter((k) => !kinds.has(k)), [], 'a kind named that no record carries');
});

test('POWER-CEILING THE ROOM: a power alone has its own; inside a runner the product stays under BLOW_MOST and the share over GUARD_LEAST; a price is taken whole; a nested runner keeps its own (mutants: the room past the product; a price cut)', () => {
  assert.deepEqual(ceilingProducts(), { blow: null, guard: null }, 'nothing held open outside a runner');
  close(blowRoom(1e9), (BLOW_MOST - 1) * 100, 'alone, the whole product');
  assert.equal(blowRoom(40), 40);
  const was = openBlowCeiling();
  assert.equal(blowRoom(200), 200);
  close(blowRoom(1e9), (BLOW_MOST / 3 - 1) * 100, 'what is left after +200%');
  assert.equal(blowRoom(5), 0, 'nothing left');
  assert.equal(blowRoom(-20), -20, 'a price taken whole');
  close(blowRoom(1e9), 25, 'and it makes room');
  const inner = openBlowCeiling();
  assert.equal(blowRoom(300), 300, 'a nested blow has its own');
  closeBlowCeiling(inner);
  assert.equal(blowRoom(1), 0, 'and the outer is as it was');
  closeBlowCeiling(was);
  const g = openGuardCeiling();
  assert.equal(guardRoom(50), 50);
  close(guardRoom(99), (1 - GUARD_LEAST / 0.5) * 100, 'the rest of the share');
  assert.equal(guardRoom(1), 0);
  assert.equal(guardRoom(-10), -10, 'more damage taken: a price, whole');
  closeGuardCeiling(g);
  assert.deepEqual(ceilingProducts(), { blow: null, guard: null });
  assert.equal(blowRoom(NaN), 0);
  assert.equal(guardRoom(Infinity), 0);
});

test('POWER-CEILING THE BLOW, BY EXECUTION: the sigil\'s +12%, the sets\' +200% (Nightfall on an unaware foe, Bound in Silk\'s fourth blow) and the loot\'s +240% (Silent Death, the Night Mother\'s execution, First Blood, a slayer\'s 30) reach their tops through the real registries, multiply whole in the runner (x11.42 - nothing a player has is cut) and a power past the product is cut to BLOW_MOST (mutants: a registry not asking its room; the runner not opening the product)', () => {
  fresh();
  const me = player();
  const nw = ascendant(nightwhisperExalted(), 'nocturnal', 12);
  const nme = ascendant(legendary('night-mothers-embrace'), 'nocturnal');
  const spun = ['starspun-cowl', 'starspun-right-pauldron', 'starspun-left-pauldron', 'starspun-greaves'].map((id) => ascendant(mintAetheric(STARSPUN_SET_PIECES.find((r) => r.id === id)), 'starspun'));
  wear(me, nw, nme, ascendant(rareArmor(103), 'nocturnal'), ascendant(rareArmor(108), 'nocturnal'), ...spun, legendary('duelists-vambrace'));
  const foe = { affinity: 'Human', careerIndex: 0, career: {}, health: 10, maxHealth: 100, level: 10 };
  for (let i = 0; i < 3; i++) setStrike(me, foe, 10, nw, {});   // three strands laid: the web holds the fourth
  const unaware = { unaware: true };
  assert.equal(sigilBlow(nw, 1000, me, foe, unaware), 1120, 'the sigil at Ascendant: +12%');
  assert.equal(setBlow(nw, 1000, me, foe, unaware), 3000, 'the sets: +60% and +140%');
  assert.equal(LP.lootBlow(nw, 1000, me, foe, unaware), 3400, 'the loot: +100%, +50%, +60%, +30%');
  assert.equal(weaponBlowMods(nw, 1000, me, foe, unaware), 11424, 'together, whole: 1.12 x 3 x 3.4');
  assert.deepEqual(ceilingProducts(), { blow: null, guard: null }, 'the runner closes its product');
  registerWeaponBlowMod('powerceiling-test', (w, d) => d + Math.floor((d * blowRoom(1e6)) / 100));
  try {
    // PIN MOVED: WEAPON-GEAR (2026-10-27) - at x119.952 the runner's floors land a point under the exact product's
    assert.ok(Math.abs(weaponBlowMods(nw, 1000, me, foe, unaware) - Math.floor(1000 * BLOW_MOST)) <= 1, `a power past the product is cut to x${BLOW_MOST.toFixed(2)}`);
    for (const fill of ['sigil', 'sets', 'loot']) {
      const was = openBlowCeiling();
      blowRoom(1e9);   // the product already full
      const d = fill === 'sigil' ? sigilBlow(nw, 1000, me, foe, unaware) : fill === 'sets' ? setBlow(nw, 1000, me, foe, unaware) : LP.lootBlow(nw, 1000, me, foe, unaware);
      closeBlowCeiling(was);
      assert.equal(d, 1000, `${fill}: no room, no more`);
    }
  } finally { registerWeaponBlowMod('powerceiling-test', null); }
});

test('POWER-CEILING THE SETS\' TOP IS A BLOW IN PLAY: Nightfall and Bound in Silk\'s fourth blow land on one blow when the foe the web holds is still unaware - under True Invisibility a foe struck three times never sees me (a Normal concealment breaks on the first blow), so the host\'s own reading hands the fourth blow `unaware` and the sets\' +200% is reached, not only measured (mutant: a True concealment broken by a blow)', () => {
  fresh();
  setPref('enhancedAI', false);
  const me = player();
  me.activeEffects = [{ kind: 'invisTrue', roundsRemaining: 30 }];
  const nw = ascendant(nightwhisperExalted(), 'nocturnal', 12);
  const spun = ['starspun-cowl', 'starspun-right-pauldron', 'starspun-left-pauldron', 'starspun-greaves'].map((id) => ascendant(mintAetheric(STARSPUN_SET_PIECES.find((r) => r.id === id)), 'starspun'));
  wear(me, nw, ascendant(legendary('night-mothers-embrace'), 'nocturnal'), ascendant(rareArmor(103), 'nocturnal'), ascendant(rareArmor(108), 'nocturnal'), ...spun);
  const entity = { affinity: 'Human', careerIndex: 0, career: {}, health: 100, maxHealth: 100, level: 10 };
  const foe = { entity, ai: new EnemyAI(new Collider(() => -100), [0, 0, 0], 0, {}) };
  const senses = () => sensesContext(me, 2, { movingLessThanHalfSpeed: false });
  const tick = () => { for (let i = 0; i < 4; i++) foe.ai.update(1 / 60, [0, 0, 1.5], senses()); };   // I stand at arm's length, in front of it
  tick();
  assert.equal(foeUnaware(foe), true, 'invisible: unseen at arm\'s length');
  for (let i = 0; i < 3; i++) {
    setStrike(me, entity, 10, nw, { unaware: foeUnaware(foe) });   // a strand laid
    handleAttackFromSource(me);   // the blow's tail: a Normal concealment ends here, a True one stands
    foe.ai.makeEnemyHostileToAttacker({ isPlayer: true }, [0, 0, 1.5]);
    tick();
  }
  assert.equal(foeUnaware(foe), true, 'struck three times, still blind to me');
  assert.equal(setBlow(nw, 1000, me, entity, { unaware: foeUnaware(foe) }), 3000, 'the fourth blow: Nightfall\'s +60% and the web\'s +140%');
  me.activeEffects = [{ kind: 'invisNormal', roundsRemaining: 30 }];
  handleAttackFromSource(me);
  tick();
  assert.equal(foeUnaware(foe), false, 'a Normal invisibility ends with the blow, and the foe sees me');
});

test('POWER-CEILING THE GUARDS, BY EXECUTION: the loot\'s three (a hexed foe, Bedrock\'s five stacks, the Last Stand) leave 45 of a hundred and Unbroken half of that, through the real door - 225 of 1000, whole - and a guard past the share is held at GUARD_LEAST (mutants: a guard not asking its room; the runner not opening the share)', () => {
  fresh();
  const me = player();
  const kit = [ascendant(legendary('the-warden', 102), 'malacath'), ascendant(legendary('mountains-root'), 'malacath'),
    ...[107, 106, 105, 108].map((t) => ascendant(rareArmor(t), 'malacath')), legendary('witch-sisters-ring')];
  wear(me, ...kit);
  const orc = { careerIndex: 7, career: {}, health: 100, maxHealth: 100, level: 10 };
  const blow = (n) => { setStruck(orc, me, n); hurtPlayer(me, n); };
  for (let i = 0; i < 5; i++) blow(10);   // Bedrock's five stacks; the orc hexed
  assert.equal(LP.bedrockStacks(), 5);
  me.health = 50;
  hurtPlayer(me, 100000);   // Unbroken: left at 1, half damage for 8 s
  assert.equal(me.health, 1);
  me.health = 2000;   // under a quarter: the Last Stand
  blow(1000);
  assert.equal(2000 - me.health, 225, '1000 x 0.75 x 0.8 x 0.75 x 0.5');
  assert.deepEqual(ceilingProducts(), { blow: null, guard: null }, 'the door closes its share');
  registerPlayerDamageMod('powerceiling-test', (_e, d) => Math.round(d * (1 - guardRoom(99) / 100)));
  try {
    me.health = 2000;
    blow(1000);
    assert.equal(2000 - me.health, Math.round(1000 * GUARD_LEAST), `a guard past the share is held at ${(GUARD_LEAST * 100).toFixed(2)}%`);
  } finally { registerPlayerDamageMod('powerceiling-test', null); }
  me.health = 2000;
  blow(1000);
  assert.equal(2000 - me.health, 225, 'and every guard as it was without it');
  const g = openGuardCeiling();
  guardRoom(99.9);   // the share already spent
  const d = LP.lootDamageMod(me, 1000);
  closeGuardCeiling(g);
  assert.equal(d, 1000, 'no room: the loot\'s guards take nothing more');
});

test('POWER-CEILING THE SETS\' OTHER GUARDS: Hold the Line and Gearward take their share whole while there is room, and nothing once a guard before them spent it (mutants: either not asking its room)', () => {
  fresh();
  const RAID = RAID_SET_PIECES.filter((r) => r.set === 'oath' && r.group === 'Armor').slice(0, 6);
  const me = wear(player(), ...RAID.map((r) => ascendant(mintAetheric(r), 'oath')));
  const orc = { careerIndex: 7, career: {}, health: 100, maxHealth: 100, level: 10 };
  const blow = (n) => { const was = me.health; setStruck(orc, me, n); hurtPlayer(me, n); return was - me.health; };
  me.health = 4000;   // under half: the Line holds
  assert.equal(blow(1000), 750, 'Hold the Line at Ascendant: a quarter off');
  const brass = wear(player(), ...NUMIDIUM_SET_PIECES.filter((r) => r.group === 'Armor').slice(0, 4).map((r) => ascendant(mintAetheric(r), 'numidium')));
  const gear = (n) => { const was = brass.health; setStruck(orc, brass, n); hurtPlayer(brass, n); return was - brass.health; };
  brass.health = 4000;
  assert.equal(gear(1000), 700, 'Gearward at Ascendant: the wound blow 30% lighter');
  // a guard before them spends the whole share: they take nothing more
  registerPlayerDamageMod('powerceiling-spend', (_e, d) => { guardRoom(100); return d; });
  registerPlayerDamageMod(SIGIL_SETS_POWER, null);
  registerPlayerDamageMod(SIGIL_SETS_POWER, setDamageMod);   // registered again: now after the spender
  try {
    me.health = 4000;
    assert.equal(blow(1000), 1000, 'no room: the Line takes nothing');
    T = 100;   // the gear wound again
    brass.health = 4000;
    assert.equal(gear(1000), 1000, 'no room: the gear takes nothing');
  } finally { registerPlayerDamageMod('powerceiling-spend', null); }
});

test('POWER-CEILING THE SOURCE: every blow modifier the tree registers asks blowRoom, and every damage modifier but the three that land no blow at all asks guardRoom - a new power cannot step round the product, inline or named (mutants: a power that never asks; AUDIT HORIZONTAL D2: an inline blow power, a share added to a veto)', () => {
  const root = new URL('../../', import.meta.url).pathname;
  const files = readdirSync(join(root, 'src'), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => join('src', f));
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  // AUDIT HORIZONTAL D2: every call by its name, its arguments read to the closing paren - a pattern on the arguments' shape
  // let an inline arrow and a `const f = () => expr` step round the sweep
  const calls = (src, fn) => {
    const out = [];
    for (const m of src.matchAll(new RegExp(`(?<![\\w$.])(?<!function )${fn}\\(`, 'g'))) {
      let depth = 0, i = m.index + m[0].length - 1, cut = [], from = i + 1;
      for (; i < src.length; i++) {
        const c = src[i];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c) && --depth === 0) break;
        else if (c === ',' && depth === 1) { cut.push(src.slice(from, i)); from = i + 1; }
      }
      cut.push(src.slice(from, i));
      out.push(cut.map((a) => a.trim()));
    }
    return out;
  };
  /** A named function's braced body - `function name(` or `const name = (...) => {` - or null (an expression body is none). */
  const body = (src, name) => {
    const decl = src.match(new RegExp(`function ${name}\\s*\\(|const ${name}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*=>\\s*\\{`));
    if (!decl) return null;
    let i = src.indexOf('{', decl.index + (decl[0].endsWith('{') ? decl[0].length - 1 : 0)), depth = 0;
    for (let j = i; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1); }
    return null;
  };
  const VETOES = Object.freeze(['eg-witness', 'poi-editor', 'kt-down']);   // a witness, an editor's body, a body lying down: no blow lands at all
  /** A veto lands nothing or the blow whole: `(e, d) => (<cond> ? 0 : d)` - a share in it would step round the product. */
  const veto = (fn) => /^\(\s*[\w$]+\s*,\s*([\w$]+)\s*\)\s*=>\s*\(?.+\?\s*0\s*:\s*([\w$]+)\s*\)?$/.exec(fn);
  const seen = { blow: [], guard: [] };
  for (const f of files) {
    const src = strip(readFileSync(join(root, f), 'utf8'));
    for (const [, fn] of calls(src, 'registerWeaponBlowMod')) {
      assert.match(fn ?? '', /^[A-Za-z_$][\w$]*$/, `${f}: a blow modifier is a named function (${String(fn).slice(0, 40)}) - ${RULE}`);
      const b = body(src, fn);
      assert.ok(b, `${f}: ${fn}'s body, a function or an arrow with braces`);
      assert.match(b, /blowRoom\(/, `${f}: the blow modifier ${fn} never asks blowRoom - ${RULE}`);
      seen.blow.push(fn);
    }
    for (const [id, fn] of calls(src, 'registerPlayerDamageMod')) {
      const name = String(id).replace(/['"`]/g, '');
      if (VETOES.includes(name)) {
        const v = veto(fn ?? '');
        assert.ok(v && v[1] === v[2], `${f}: the veto ${name} lands nothing or the blow whole - (e, d) => (cond ? 0 : d) - ${RULE}`);
        seen.guard.push(name);
        continue;
      }
      assert.match(fn ?? '', /^[A-Za-z_$][\w$]*$/, `${f}: the damage modifier ${name} is a named function (an inline one is a veto, named in VETOES)`);
      const b = body(src, fn);
      assert.ok(b, `${f}: ${fn}'s body, a function or an arrow with braces`);
      assert.match(b, /guardRoom\(/, `${f}: the damage modifier ${fn} never asks guardRoom - ${RULE}`);
      seen.guard.push(fn);
    }
  }
  assert.deepEqual(seen.blow.sort(), ['firmamentBlow', 'lootBlow', 'martialBlow', 'setBlow', 'sigilBlow', 'weaponMasteryBlow']);
  assert.deepEqual(seen.guard.sort(), ['eg-witness', 'firmamentDamage', 'kt-down', 'lootDamageMod', 'martialDamageMod', 'pathDamageMod', 'poi-editor', 'setDamageMod']);
  // AUDIT HORIZONTAL D4: every room asked names its registry, a registry the tops know - one asked unnamed is held by the
  // product alone, and cuts whoever asks after it
  const named = { blowRoom: new Set(), guardRoom: new Set() };
  for (const f of files.filter((x) => !x.endsWith('powerCeiling.js'))) {
    const src = strip(readFileSync(join(root, f), 'utf8'));
    for (const [fn, tops] of [['blowRoom', BLOW_TOPS], ['guardRoom', GUARD_TOPS]]) {
      for (const args of calls(src, fn)) {
        const m = /^'([a-z]+)'$/.exec(args[1] ?? '');
        assert.ok(args.length === 2 && m && Object.hasOwn(tops, m[1]), `${f}: ${fn}(${args.join(', ').slice(0, 60)}) names no registry of ${Object.keys(tops).join(', ')} - ${RULE}`);
        named[fn].add(m[1]);
      }
    }
  }
  assert.deepEqual([...named.blowRoom].sort(), Object.keys(BLOW_TOPS).sort(), 'every blow registry asks under its own name');
  assert.deepEqual([...named.guardRoom].sort(), Object.keys(GUARD_TOPS).sort(), 'every guard registry asks under its own name');
});

test('POWER-CEILING THE CUT LANDS WHERE THE POWER GREW (AUDIT HORIZONTAL D4): a registry past its own top is cut at that top, in any order of asking, and every other registry keeps its whole - the product alone cut the last one asked, a player\'s martial path 40 to 8 for a loot power past 240 (mutants: a registry\'s own top not read; its own product not kept)', () => {
  const WORLD = ['sigil', 'sets', 'loot', 'firmament', 'mastery', 'martial'];   // world.js's import graph
  const EXTERIOR = ['sigil', 'mastery', 'sets', 'loot', 'martial', 'firmament'];   // exterior.js's
  for (const order of [WORLD, EXTERIOR, [...WORLD].reverse()]) {
    const was = openBlowCeiling();
    const got = Object.fromEntries(order.map((k) => [k, blowRoom(k === 'loot' ? 340 : BLOW_TOPS[k], k)]));
    closeBlowCeiling(was);
    assert.deepEqual(got, { ...BLOW_TOPS }, `${order.join(' ')}: the loot cut at its 240, every other whole - ${RULE}`);
  }
  const was = openBlowCeiling();
  assert.equal(blowRoom(30, 'sets'), 30);
  close(blowRoom(200, 'sets'), (3 / 1.3 - 1) * 100, 'a registry asked twice: its own product kept, x3 in all');
  closeBlowCeiling(was);
  close(blowRoom(1e9, 'sigil'), 12, 'alone, at its own top');
  assert.equal(blowRoom(5, 'nobody'), 0, 'a registry with no measured top has no room');
  for (const order of [['loot', 'sets', 'firmament', 'martial', 'arcane'], ['arcane', 'martial', 'firmament', 'sets', 'loot']]) {
    const g = openGuardCeiling();
    const got = {};
    for (const k of order) {
      got[k] = k === 'loot' ? [25, 20, 25, 10].map((l) => +guardRoom(l, 'loot').toFixed(9)) : guardRoom(GUARD_TOPS[k], k);
    }
    closeGuardCeiling(g);
    assert.deepEqual(got.loot, [25, 20, 25, 0], `${order.join(' ')}: the Hex, Bedrock and the Last Stand whole, a fourth share past the loot's 55 cut`);
    for (const k of order.filter((x) => x !== 'loot')) assert.equal(got[k], GUARD_TOPS[k], `${order.join(' ')}: ${k} whole - ${RULE}`);
  }
  close(guardRoom(99, 'arcane'), 20, 'alone, at its own top');
});
