// PWR7 (2026-10-23, bible/05-Combat/Power-Arc.md; Mac: "Lets do all of it. 1 through 7 in its entirety and do it right.
// No band aids or short cuts"): THE KITS THE POWER MEASURE WEARS - a player of a stated level and Renown, dressed in
// pieces the game's own producers mint (lootRarity.js applyRarity, its gems' setGem, a sigil and a set's record as the
// won-loot door stamps them), its Firmament allocated through the sky's own law (firmamentLaw.js pathTo, treeStats), its
// masteries and its martial path chosen through their own doors (masterSkills.js, martialPaths.js chooseMartialPath).
// Nothing here is a scalar standing in for a system: tools/heroMeasure.mjs's `kitAt` and `onlineAt` multiplied a stated
// blow and guard into its sums; this file wears the pieces and lets the registries do what they do in the game.
//
// THE FOUR BUILDS (the measure's rows; every one a stated character, not a save):
//   plain    - heroMeasure's stated player (its ANCHORS, its metals): a longsword and seven pieces of plate, no ladder,
//              offline. The floor every edge is read against.
//   ladder   - the ladder's middles by level, offline: a Magic blade from 8, a Rare one from 15 (a Flawed Diamond set
//              in it), Ansei's Edge from 20; Rare plate with an armour and a stat line from 15, two Legendary pieces and
//              two Legendary jewels from 20 - the BAL7 kit's own records.
//   online   - the ladder at the level's Renown (Renown 1.5 a level, to 50), online: the same pieces, a Rare sigil's
//              middle on the blade, a world set's four pieces at the Renown's stage, the Firmament spent by a melee
//              player (the greedy route below), the weapon's climb past 100 two points a Renown past 30.
//   stacked  - BAL7's whole kit at the level, online at Renown 50: Ansei's Edge with two Flawless Diamonds and an
//              Ascendant sigil of 12, Titanheart, Mountain's Root, Raven's Wings and the Visor, three Rares imprinted
//              Dawnward, Last Stand and Bulwark, Divine Grace, Hex, Hist-Sap and First Blood - Dagon's four pieces and
//              Nocturnal's two at Ascendant, the whole sky, Long Blade, Short Blade and Critical Strike mastered and
//              climbed to 140, the Blademaster's path the two blades open.
// PWR2: every kit attunes ATTUNE_CHOICE where it wears them (three awake - the rest of its powers sleep).
//
// Not a DFU member; tooling, never shipped.
import { buildAt } from '../heroMeasure.mjs';

const SRC = new URL('../../src/', import.meta.url);
const mod = (p) => import(new URL(p, SRC).href);

/** The page the measure stands on: online (`?online`) or not - systems/online/onlineLane.js isOnlinePage reads it. */
export function standOnline(on) {
  globalThis.location = /** @type {any} */ ({ search: on ? '?online' : '' });
}

// Loaded once, in the game's own order of registration (scenes/world.js imports them so): every power registry fills
// at its module's import.
const [LR, LP, SSP, SG, FP, FL, FLAW, FTREE, WM, MP, MPATH, MS, AP, EQ, EE, IT, AM, UP, SETS, PDOOR, GEMS] = await Promise.all([
  mod('systems/loot/lootRarity.js'), mod('systems/loot/lootPowers.js'), mod('systems/sigil/sigilSetPowers.js'),
  mod('systems/sigil/sigil.js'), mod('systems/firmamentPowers.js'), mod('systems/firmamentLive.js'),
  mod('net/firmament/firmamentLaw.js'), mod('net/firmament/firmamentTree.js'), mod('systems/weaponMastery.js'),
  mod('systems/martialPowers.js'), mod('systems/martialPaths.js'), mod('systems/masterSkills.js'),
  mod('systems/arcanePowers.js'), mod('systems/equip.js'), mod('combat/enemyEquipment.js'),
  mod('systems/item/itemTemplates.js'), mod('systems/armorMaterials.js'), mod('systems/uiPrefs.js'),
  mod('systems/sigil/sigilSets.js'), mod('systems/playerDoor.js'), mod('systems/gems.js'),
]);
const { SKILLS } = await mod('systems/skills.js');
const { renownBonus } = await mod('net/renown.js');
export { LR, LP, SSP, SG, FP, FL, FLAW, MPATH, MS, EQ, SETS };

export const BUILDS = Object.freeze(['plain', 'ladder', 'online', 'stacked']);
/** The pieces every kit attunes, in order, where it wears them (PWR2). */
export const ATTUNE_CHOICE = Object.freeze(['anseis-edge', 'duelists-vambrace', 'ravens-wings']);
/** The Renown the stated online player holds at level `L`: one and a half a level, to 50 (BAL11's pairs: 10 and 15,
 *  20 and 30, 30 and 45). */
export const renownAt = (L) => Math.max(1, Math.min(50, Math.round(1.5 * L)));

/** A seeded source for the mints - an LCG, as the ladder's own tests seed it. */
export const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };

// ── the switches ─────────────────────────────────────────────────────
/**
 * Stand the game's switches for one build: the ladder's preference on, the page online or not, the sigil's session
 * (online, the Renown), the Firmament's tree and its online word, and every power module's own state reset. `tree`
 * null leaves the sky empty.
 */
export function wake({ online = false, renown = null, tree = null } = {}) {
  UP._resetForTests();
  UP.setPref(LR.LOOT_RARITY_KEY, true);
  standOnline(online);
  LP._resetLootPowersForTests();
  SSP._resetSetPowersForTests();
  SG._resetSigilForTests?.();
  SETS._resetSigilSetsForTests();
  FL._resetFirmamentLiveForTests();
  FP._resetFirmamentPowersForTests?.();
  PDOOR.setPlayerDoor(null);
  SG.setSigilOnline(online);
  if (online && renown) SG.setSigilRenown(renown);
  FL.setFirmamentOnline(online);
  // the purses the sky plays under (PWR2, PWR4): the active Stars Renown's soft cap holds it to; no Craft (the stated
  // characters keep no trade)
  if (online && tree?.start) FL.setFirmamentTree(tree, { stars: activeStars(renown), craft: 0 });
}

// ── the pieces ───────────────────────────────────────────────────────
const LONGSWORD = 120;
/** heroMeasure's metals, read as the item tables' material ids: weapons by WEAPON_MATERIAL index, plate 0x0200 + it,
 *  chain 0x0100. */
const plateMaterial = (pmat) => (pmat < 0 ? 0x0100 : 0x0200 + pmat);

/** A weapon of `template` and `wmat`, fresh and kept fresh (the measure is not a wear study - WEAR-VANILLA). */
function blade(template, wmat) {
  const w = EE.createWeapon(template, wmat, () => 0.5);
  w.maxCondition = 1e9; w.currentCondition = 1e9;
  return w;
}
/** A body piece of plate (or chain) of template `t`. */
function plate(t, pmat) {
  const it = IT.mintCondition({ group: 'Armor', templateIndex: t, material: plateMaterial(pmat), name: `a${t}` });
  it.maxCondition = 1e9; it.currentCondition = 1e9;
  return it;
}
/** A Legendary piece minted on its record (`base` the item it is laid on). */
function legendaryOn(base, id, seed) {
  const rec = LR.legendaryById(id);
  if (!rec) throw new Error(`powerKit: no Legendary record ${id}`);
  const it = LR.applyRarity(base, 'legendary', lcg(seed), [rec]);
  it.isIdentified = true;
  return it;
}
/** A Rare piece minted on `base`, its lines rolled from `seed`, optionally imprinted with a Legendary's power. */
function rareOn(base, seed, imprint = null) {
  const it = LR.applyRarity(base, 'rare', lcg(seed));
  it.isIdentified = true;
  if (imprint) it.imprint = imprint;
  return it;
}
/** A Magic piece. */
function magicOn(base, seed) {
  const it = LR.applyRarity(base, 'magic', lcg(seed));
  it.isIdentified = true;
  return it;
}
/** A jewel of the record's own template, minted Legendary. */
function jewel(id, seed) {
  const rec = LR.legendaryById(id);
  const t = rec.templates?.[0] ?? 135;
  return legendaryOn(IT.mintCondition({ group: rec.group, templateIndex: t, flags: 0 }), id, seed);
}
/** Set `gems` into a piece's sockets - the sockets laid first as the ladder's pass lays them (empty), then the gems
 *  through the ladder's own setGem, which lays their lines. */
function socket(item, gems) {
  item.sockets = gems.map(() => 'empty');
  for (const g of gems) if (!LR.setGem(item, g)) throw new Error(`powerKit: ${g} would not set`);
  return item;
}
/** The xp a sigil holds at stage `rank` (0 Faint .. 4 Ascendant) - the stage's own threshold. */
const xpForRank = (rank) => SG.SIGIL_STAGES[Math.max(0, Math.min(SG.SIGIL_STAGES.length - 1, rank))].xp;
/** The highest stage Renown `R` opens (sigil.js renownSigilStage). */
const rankForRenown = (R) => Math.max(0, SG.renownSigilStage(R));

// ── the sky ──────────────────────────────────────────────────────────
/** What a melee player values a channel at - the blow first, then the guard, then the body (a stated taste, not a law). */
const MELEE_TASTE = Object.freeze({
  weaponDmg: 3, meleeDmg: 3, longDmg: 3, rageDmg: 1, unawareDmg: 0.5, blowTaken: -2, spellTaken: -0.5, evade: 2,
  hp: 0.08, hpPct: 1, hpRegen: 1, killHeal: 1, armor: 0.3, strength: 0.4, agility: 0.4, endurance: 0.3, speed: 0.2,
  'skill.LongBlade': 0.5, 'skill.CriticalStrike': 0.5, 'resist.magic': 0.05,
});
const valueOf = (stats) => Object.entries(stats).reduce((s, [k, v]) => s + (MELEE_TASTE[k] ?? 0) * v, 0);
/**
 * THE GREEDY ROUTE: from `start`, spend `stars` on the sky one path at a time - at each step the path (pathTo's
 * shortest) whose capped value (treeStats, through the stated taste) gains most a star - the min-maxer's sky. Stars the
 * law will not take (a path longer than what is left) are left unspent.
 */
export function greedyTree(start, stars) {
  let tree = { start, keys: [] };
  let have = valueOf(FLAW.treeStats(tree));
  let left = stars;
  while (left > 0) {
    let best = null;
    for (const key of FTREE.FIRM_NODES.keys()) {
      if (tree.keys.includes(key) || key === start) continue;
      const path = FLAW.pathTo(tree, key);
      if (!path.length || path.length > left) continue;
      const next = { start, keys: [...tree.keys, ...path].sort() };
      const gain = (valueOf(FLAW.treeStats(next)) - have) / path.length;
      if (!best || gain > best.gain + 1e-9 || (Math.abs(gain - best.gain) <= 1e-9 && key < best.key)) best = { key, gain, next, cost: path.length };
    }
    if (!best || !(best.gain > 0)) break;
    tree = best.next; have = valueOf(FLAW.treeStats(tree)); left -= best.cost;
  }
  return Object.freeze({ start, keys: Object.freeze(tree.keys) });
}
/** The Stars a sky in force spends at Renown `R` - PWR4's soft cap where the tree carries it, else every Star (a tree
 *  from before PWR4, measured for the record's "before"). */
const activeStars = (R) => (FLAW.activeStarsFor ?? FLAW.starsFor)(R);
const _trees = new Map();
/** The best melee sky a Renown buys: every start's greedy route, the most valuable kept (cached a Renown) - PWR4: on the
 *  Stars a sky in force may spend (firmamentLaw.js activeStarsFor - Renown's to the soft cap). */
export function meleeTree(renown) {
  const stars = activeStars(renown);
  if (_trees.has(stars)) return _trees.get(stars);
  let best = null;
  for (const start of FTREE.START_KEYS) {
    const t = greedyTree(start, stars);
    const v = valueOf(FLAW.treeStats(t));
    if (!best || v > best.v) best = { t, v };
  }
  _trees.set(stars, best.t);
  return best.t;
}

// ── the body ─────────────────────────────────────────────────────────
const STATS = (B) => ({ strength: B.STR, intelligence: 50, willpower: B.WIL, agility: B.AGI, endurance: B.END, personality: 50, speed: B.SPD, luck: B.LUC });
/** The stated body at level `L` - heroMeasure's ANCHORS (buildAt): attributes, skills, health, magicka. */
function body(L, { online = false } = {}) {
  const B = buildAt(L);
  const skills = new Array(35).fill(B.other);
  skills[SKILLS.LongBlade] = B.LB; skills[SKILLS.CriticalStrike] = B.crit; skills[SKILLS.Dodging] = B.dodge;
  const p = {
    isPlayer: true, _online: online, level: L, raceId: 1, name: 'the measure', stats: STATS(B), skills, items: [],
    career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0, attackModifierFlags: 0 },
    activeEffects: [], health: B.hp, maxHealth: B.hp, magicka: 60 + 2 * L, maxMagicka: 60 + 2 * L, fatigue: 1e6, maxFatigue: 1e6,
    armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0, masteredSkills: [],
  };
  return { p, B };
}
const ARMOR_SLOTS = Object.freeze([[102, 'chest'], [103, 'hands'], [104, 'legs'], [105, 'left arm'], [106, 'right arm'], [107, 'head'], [108, 'feet']]);
const wear = (p, it) => { p.items.push(it); if (!EQ.equipItem(p, it)) throw new Error(`powerKit: ${it.name} would not equip`); return it; };

/** The weapon the ladder hands a stated player at level `L` (the build's own rule). */
function ladderBlade(L, B, seed) {
  const w = blade(LONGSWORD, B.wmat);
  if (L >= 20) return socket(legendaryOn(w, 'anseis-edge', seed), ['flawed-diamond']);
  if (L >= 15) return socket(rareOn(w, seed), ['flawed-diamond']);
  if (L >= 8) return magicOn(w, seed);
  return w;
}

/**
 * THE KIT: build `build` at level `L` (Renown `R`, default the stated renownAt for the online builds) - `{ player,
 * weapon, online, renown, tree }`. The switches are NOT stood here: `wake` takes the returned `online`, `renown` and
 * `tree`, so a measure can wear several kits under one switch.
 */
export function kitAt(build, L, { R = null, seed = 1 } = {}) {
  if (!BUILDS.includes(build)) throw new Error(`powerKit: no build ${build}`);
  const online = build === 'online' || build === 'stacked';
  const renown = online ? (build === 'stacked' ? 50 : R ?? renownAt(L)) : null;
  const { p, B } = body(L, { online });
  let weapon;
  if (build === 'plain') {
    weapon = wear(p, blade(LONGSWORD, B.wmat));
    for (const [t] of ARMOR_SLOTS) wear(p, plate(t, B.pmat));
  } else if (build === 'ladder' || build === 'online') {
    weapon = wear(p, ladderBlade(L, B, seed));
    if (online && L >= 8) weapon.sigil = { power: 6, party: 1, xp: xpForRank(rankForRenown(renown)) };
    const legendaryArmor = L >= 20 ? { 104: 'mountains-root', 105: 'ravens-wings' } : {};
    for (const [t] of ARMOR_SLOTS) {
      let it = plate(t, B.pmat);
      if (legendaryArmor[t]) it = legendaryOn(it, legendaryArmor[t], seed + t);
      else if (L >= 15) it = rareOn(it, seed + t);
      if (online && L >= 15 && [102, 103, 107, 108].includes(t)) it.sigil = { set: 'dagon', party: 1, xp: xpForRank(rankForRenown(renown)) };
      wear(p, it);
    }
    if (L >= 20) { wear(p, jewel('duelists-vambrace', seed + 1)); wear(p, jewel('mark-of-the-hist', seed + 2)); }
  } else {
    // stacked: BAL7's kit, every power the ladder's records hold for a sword-and-plate fighter
    weapon = wear(p, socket(legendaryOn(blade(LONGSWORD, B.wmat), 'anseis-edge', seed), ['flawless-diamond', 'flawless-diamond']));
    weapon.sigil = { power: SG.SIGIL_POWER_MAX, party: 1, xp: xpForRank(4) };
    const kit = { 102: ['legendary', 'titanheart', 'dagon'], 104: ['legendary', 'mountains-root', 'dagon'], 105: ['legendary', 'ravens-wings', 'dagon'],
      107: ['legendary', 'lysandus-visor', 'dagon'], 103: ['imprint', 'the-warden', 'nocturnal'], 106: ['imprint', 'aegis-of-dawn', 'nocturnal'], 108: ['imprint', 'wall-of-daggerfall', null] };
    for (const [t] of ARMOR_SLOTS) {
      const [how, id, set] = kit[t];
      const base = plate(t, B.pmat);
      const it = how === 'legendary' ? legendaryOn(base, id, seed + t) : rareOn(base, seed + t, id);
      if (set) it.sigil = { set, party: 1, xp: xpForRank(4) };
      wear(p, it);
    }
    for (const [i, id] of ['amulet-of-the-nine', 'witch-sisters-ring', 'mark-of-the-hist', 'duelists-vambrace'].entries()) wear(p, jewel(id, seed + 10 + i));
    // the masteries and the path: Long Blade, Short Blade and Critical Strike mastered and climbed to 140 effective
    // (raw 200) - three of the five a character may master (masterSkills.js MASTERY_SLOTS); the two blades open the
    // Blademaster's path (martialPaths.js PATH_ROWS), its Flowing Steel the sword's own
    for (const s of [SKILLS.LongBlade, SKILLS.ShortBlade, SKILLS.CriticalStrike]) p.skills[s] = 200;
    p.masteredSkills = [SKILLS.LongBlade, SKILLS.ShortBlade, SKILLS.CriticalStrike];
  }
  if (build === 'online' && renown > 30) {
    const climb = Math.min(40, 2 * (renown - 30));
    p.skills[SKILLS.LongBlade] = rawForClimb(climb);
    p.masteredSkills = [SKILLS.LongBlade];
  }
  if (build === 'stacked') {
    const open = MPATH.MARTIAL_PATHS.find((m) => m.skills.every((s) => p.masteredSkills.includes(s)));
    if (open) MPATH.chooseMartialPath(p, open.id);
  }
  // PWR2: the three a min-maxing sword-and-plate fighter attunes (systems/power/attunement.js - three awake): the blade's
  // own Way of the Sword, First Blood's +60% and the Raven's evasion; any other power piece worn sleeps
  // (every stamp the equip's settle laid as the pieces went on is taken off first - the settle attunes what it finds worn)
  for (const it of p.items) delete it.attuned;
  ATTUNE_CHOICE.forEach((id, i) => { const it = p.items.find((x) => x.legendary === id || x.imprint === id); if (it) it.attuned = i + 1; });
  if (online) {
    const rb = renownBonus(renown);
    p.maxHealth += rb.hp; p.health = p.maxHealth;
    p.maxMagicka += rb.mp; p.magicka = p.maxMagicka;
  }
  const tree = online ? meleeTree(renown) : null;
  return { player: p, weapon, online, renown, tree, build, level: L };
}
/** The raw skill whose effective climb past 100 is `climb` (skillSoftcap.js effectiveSkill's inverse, by search). */
let _effective = null;
const SOFTCAP = await mod('systems/skillSoftcap.js');
function rawForClimb(climb) {
  _effective ??= SOFTCAP.effectiveSkill;
  for (let raw = 100; raw <= 200; raw++) if (_effective(raw) - 100 >= climb) return raw;
  return 200;
}

/** Wear a kit: stand its switches (`wake`) and fold its mods (equip.js's listener ran at every equip; the tree and
 *  the Renown change the folds' answers, so they are folded again). */
export function dress(kit) {
  wake({ online: kit.online, renown: kit.renown, tree: kit.tree });
  EQ.rebuildEquipState?.(kit.player);
  return kit;
}
