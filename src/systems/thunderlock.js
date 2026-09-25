// THE DWARVEN THUNDERLOCK, and the Dwemer Pellet it eats.
//
// Mac, 2026-09-19: "The weapon itself will be called Dwarven
// Thunderlock. Ammo: Dwemer Pellet. Im ready to integrate this as a
// new weapon type. Should work with the archery skill."
//
// THIS IS A DEPARTURE, AND IT IS THE FIRST ONE OF ITS KIND. Every
// other weapon in this port is a translation of a Daggerfall weapon;
// this one is ours. It was prototyped before it was built - the gun
// lab (gun-proto.html, bible/05-Combat/Gun-Lab.md) settled the pose,
// the cadence, the recoil and the sounds while combat/ was untouched -
// and only what survived that is here.
//
// WHAT IT BORROWS, AND WHY. It is an ARCHERY weapon, by Mac's call and
// by its own nature: it is fired rather than swung, it spends
// ammunition, and its cooldown is the bow's. So every law that reads
// "which skill did this hit use" already answers Archery the moment
// weaponSkillUsed names it, and the port's existing ranged lane
// carries the rest.
//
// WHAT IT DOES NOT BORROW: `isBow`. A bow DRAWS - StrikeUp winds up,
// the string holds at frame 3, StrikeDown looses - and a gun does
// none of that; it has a trigger. So the machine runs the melee
// one-shot (six frames, hit on frame 1) with the BOW's cooldown
// bolted on, which is the shape the lab proved and the shape the art
// has. The skill is not the machine.
//
// THE INDICES are 560 and 561, which are past DFU's 288 and past
// Climates & Calories' 530-541 (systems/survival/items.js), so
// registerCustomTemplates takes them and the frozen DFU table stays
// what it is. Nothing here writes to itemTemplates.json.

import { registerCustomTemplates, templateByIndex, mintCondition, setItemFields, registerAmmunition } from './itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from './textureReplacement.js';
import { registerUniqueFind, registerLegendary } from './lootRarity.js';
import { SKILLS } from './skills.js';
import { APP_ROOT } from './appRoot.js';   // AUDIT-THUNDERLOCK F7
import { GUN_FEEL } from '../combat/gunFeel.js';   // FIELD-GUN13: the flash's reach, from the one home the feel lives in (a leaf - no imports of its own)
// The indices live in a LEAF (characters/thunderlockIds.js) because
// characters/weapons.js needs them too and importing this file from
// there would close a cycle through systems/itemTemplates.js. Said out
// loud on the leaf itself.
import {
  THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE, THUNDERLOCK_ARCHIVE, PELLET_ARCHIVE,
  orbColour,   // FIELD-GUN17: the muzzle light wears the orb's own colour, sampled rather than named
} from '../characters/thunderlockIds.js';

/** The two indices, from the leaf that holds them - re-exported so
 *  this file is still the weapon's one front door. NOT wrapped in a
 *  `TEMPLATE` object: systems/survival/food.js already exports that
 *  name with other numbers in it, and one name meaning two things is
 *  what test/audit24_onehome.test.js's ratchet is for. */
export { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE };

/** The group a weapon must be in for equip, the paperdoll and the
 *  damage laws to treat it as one (ItemGroups.Weapons). */
export const WEAPON_GROUP = 'Weapons';

/** The archives its art is registered under - its own, not 234's.
 *  A classic weapon's paperdoll art lives in TEXTURE.234 (233 for
 *  female characters, ApplyWeaponMaterial's tail); this one has no
 *  entry there and no female variant to be off by one from, which is
 *  why characters/paperdollArt.js exempts a custom template from that
 *  subtraction rather than this file pretending to be classic. */
export const ART = Object.freeze({ weaponArchive: THUNDERLOCK_ARCHIVE, ammoArchive: PELLET_ARCHIVE });

/**
 * The rows. Columns are DFU's ItemTemplates.txt's, so every reader
 * that already knows how to read a weapon reads these.
 *
 * `basePrice` 480 puts it above a Long Bow's 20 by two orders - it is
 * a Dwemer machine, not a bent stick - and the pellet at 4 is twice an
 * arrow's 2. `hitPoints` 90 is a shade under a bow's 100: the thing
 * has a firing chamber. `isOneHanded` false, because both hands are on
 * it in the art the lab settled.
 */
export const THUNDERLOCK_TEMPLATES = Object.freeze([
  {
    index: THUNDERLOCK_TEMPLATE,
    name: 'Dwarven Thunderlock',
    baseWeight: 6.0,
    hitPoints: 90,
    basePrice: 480,
    enchantmentPoints: 400,
    rarity: 20,
    drawOrderOrEffect: 100,     // BlitItems' layer - weapons draw last, over the hand
    isBluntWeapon: false,
    isOneHanded: false,
    worldTextureArchive: ART.weaponArchive,
    worldTextureRecord: 0,
    playerTextureArchive: ART.weaponArchive,
    playerTextureRecord: 0,
  },
  {
    index: PELLET_TEMPLATE,
    name: 'Dwemer Pellet',
    baseWeight: 0.2,
    hitPoints: 1,
    basePrice: 4,
    enchantmentPoints: 150,
    rarity: 10,
    drawOrderOrEffect: 0,
    stackable: true,
    isNotRepairable: true,
    hasNoEncumbrance: false,    // an arrow weighs nothing in classic; a lead ball does not
    worldTextureArchive: ART.ammoArchive,
    worldTextureRecord: 0,
    playerTextureArchive: 0,    // ammunition is never worn - the arrow's own 0
    playerTextureRecord: 0,
  },
]);
registerCustomTemplates(THUNDERLOCK_TEMPLATES);

export const isThunderlock = (item) => item?.templateIndex === THUNDERLOCK_TEMPLATE;
export const isPellet = (item) => item?.templateIndex === PELLET_TEMPLATE;

/** THE AMMUNITION LINK lives on the leaf (see the file) - inventory.js
 *  is upstream of everything here and asks it too. Re-exported so this
 *  file stays the weapon's front door. */
export { ammoTemplateFor } from '../characters/thunderlockIds.js';

/** The skill a hit with it is scored on - Mac's call, and the reason
 *  characters/weapons.js names this template in WEAPON_SKILL_USED. */
export const THUNDERLOCK_SKILL = SKILLS.Archery;

/**
 * Its damage span, in the shape CalculateWeaponMin/MaxDamage answers.
 *
 * A Long Bow is 4-18 and a Dai-Katana 3-21, which are the ceilings
 * classic sets. This sits at 7-26: harder than anything classic per
 * shot, and paid for everywhere else - it is the heaviest weapon in
 * the game at 6kg, it spends ammunition that costs twice an arrow, and
 * its cycle is the bow's cooldown plus a reload the eye can see. A
 * weapon that hits like this and fired like a dagger would not be a
 * new weapon type, it would be the end of the others.
 */
export const THUNDERLOCK_DAMAGE = Object.freeze({ min: 7, max: 26 });

/** Mint one. Material rides the classic weapon ladder (the dye and
 *  the damage modifier both read it), defaulting to Dwarven because
 *  that is what it is. */
export function createThunderlock({ material = 4, condition = null } = {}) {
  const item = mintCondition(setItemFields({
    group: WEAPON_GROUP, templateIndex: THUNDERLOCK_TEMPLATE,
    material, flags: 0, variant: 0, message: 0, stackCount: 1,
  }));
  if (condition != null) item.currentCondition = Math.max(0, Math.min(item.maxCondition ?? condition, condition));
  return item;
}

/** Mint a stack of pellets. Material None (0), as CreateWeapon's arrow
 *  arm does - ammunition takes no metal ladder. */
export function createPellets(stackCount = 20) {
  return mintCondition(setItemFields({
    group: WEAPON_GROUP, templateIndex: PELLET_TEMPLATE,
    material: 0, flags: 0, variant: 0, message: 0,
    stackCount: Math.max(1, stackCount | 0),
  }));
}

/** How many pellets a pack is carrying. */
export function pelletCount(items) {
  let n = 0;
  for (const it of items ?? []) if (isPellet(it)) n += Math.max(0, it.stackCount ?? 1);
  return n;
}

/** Spend one. Answers whether there was one to spend, so a caller can
 *  refuse the shot on false rather than firing a blank. */
export function spendPellet(items) {
  const list = items ?? [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (!isPellet(it)) continue;
    const n = Math.max(0, it.stackCount ?? 1);
    if (n <= 0) continue;
    it.stackCount = n - 1;
    if (it.stackCount <= 0) list.splice(i, 1);
    return true;
  }
  return false;
}

/** The art: our own PNGs, through the same vendor-texture door the
 *  survival mod's icons come in by. Record 0 of each archive.
 *
 *  ONE SPRITE, TWO JOBS (characters/paperdollArt.js): the paperdoll
 *  layer and the inventory icon are the same record, which is why
 *  gun-paperdoll.png carries the hand gap and why the icon has a notch
 *  in it - it is a doll layer being shown in a list. */
/**
 * WHERE IT HANGS ON THE PAPER DOLL (FIELD-GUN4).
 *
 * A classic weapon record carries its own offset inside its CIF, and
 * the doll blits it at `offset - paperDollOrigin`. Our sprite is a
 * PNG and has no such field, so the number is declared here - the one
 * place that knows the sprite is 68x42 and where its grip sits in it.
 *
 * The doll's panel is 110x184 with its origin at (200, 8), so these
 * are panel coordinates plus that origin. The gun hangs muzzle-down
 * across the body's right side (the viewer's left, which is where the
 * doll's right hand is), low enough that the grip meets the hand and
 * the barrel runs past the hip.
 *
 * MAC'S EYE IS THE GATE ON THIS ONE. It is a placement, not a law -
 * there is no DFU number to be right or wrong against - so it is one
 * constant, named, for him to move.
 *
 * FIELD-GUN9: and he moved it. The first guess hung the grip three
 * pixels below the hand ("close, really close, but not quite"), so
 * the sprite rises by that much. `y` is the only number that changed
 * and the panel origin stays written out beside it, because
 * `8 + 93` says "93 down the panel" where `101` says nothing.
 */
export const PAPERDOLL_OFFSET = Object.freeze({ x: 200 + 8, y: 8 + 93 });

export const ICON_FILES = Object.freeze([
  { archive: ART.weaponArchive, record: 0, frame: 0, file: 'gun-paperdoll.png', offset: PAPERDOLL_OFFSET },
  { archive: ART.ammoArchive, record: 0, frame: 0, file: 'gun-ammo.png' },
]);

/** AUDIT-THUNDERLOCK F7: the SITE root, not the document's - the
 *  game's document is `/play/index.html` and these live at
 *  `<root>/art/`. See systems/appRoot.js, and the held map before it. */
export const iconUrl = (file) => new URL(`art/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _installed = false;
/** Register the icons once. `fetchBytes` is the test's door. */
export function installThunderlockIcons({ fetchBytes = null } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0;
  _installed = true;
  const load = fetchBytes ?? (async (name) => {
    const r = await fetch(iconUrl(name));
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  });
  // FIELD-GUN1 (Mac, from play: "the inventory sprites dont have
  // their sprites"). `standIn: true` IS THE REGISTRATION, not a hint.
  // Archives 560 and 561 exist ONLY as this art - there is no
  // TEXTURE.560 in ARENA2 and never will be - and `standIn` is the
  // flag the pipeline reads to know that: `isVendorArchive` sends the
  // load down the stand-in branch instead of fetching a file that
  // cannot exist, and `vendorRecordCount` is what every icon door in
  // the port (itemScroller, nativeInventory, paperDoll) gates on
  // before it uploads - `record < tex.recordCount`, which is 0 for an
  // archive with no stand-in registered. So the icons resolved to
  // 560/0 and 561/0 correctly, as the audit said they would, and then
  // every door refused to draw them.
  //
  // This is SURV-ART verbatim, one mod over - "the sprites aren't
  // showing at all" - and textureReplacement.js:203 says so in the
  // comment right above the function. The audit read that file for F7
  // and took the URL law out of it while walking past the flag.
  return addVendorTextures(ICON_FILES.map(({ archive, record, frame, file, offset }) => ({
    archive, record, frame, fileName: file, standIn: true, offset, load: () => load(file),
  })));
}

// ── HOW YOU GET ONE ─────────────────────────────────────────────────
//
// Mac: "This weapon wont be available for purchase and should be one
// of the rarest items to find in the game."
//
// NOT FOR SALE, and that takes no code: a shop's shelf is built from
// GROUP_TEMPLATE_INDICES, which is DFU's own enum table, and a custom
// template is not in it. The survival mod had to ADD its provisions to
// the shelves deliberately; this one simply never appears there.
// test/thunderlock.test.js pins that as a law rather than an accident.
//
// FOUND, THEN, and by the port's own loot ladder (systems/lootRarity.js
// LR1-LR5). It registers as a UNIQUE FIND, which is a different
// question from a rarity tier: a tier decorates an item DFU's loot
// roll already produced, and no DFU roll can produce this weapon at
// all. So it is its own roll - once per loot list, adding rather than
// promoting - and it begins at NOTHING below source tier 4. A rat in a
// shallow crypt cannot drop it at any luck; the Daedra Lord at the
// bottom of a Volcanic Cave is what the number is for.
//
// IT ARRIVES LOADED. A gun found with no ammunition is a gun the
// player cannot fire and cannot buy shot for, which reads as a broken
// drop rather than a rare one. The find mints a handful of pellets
// with it - few enough that the weapon still sends you looking.
export const FIND_MIN_TIER = 4;
export const FIND_PELLETS = Object.freeze({ min: 6, max: 18 });

// The pellet is AMMUNITION: never rarity-promoted, for the Arrow's own
// reason - promoting a stack enchants it, and an enchanted item does
// not stack, so a find of twenty becomes twenty rows to carry.
registerAmmunition(PELLET_TEMPLATE);

registerUniqueFind({
  id: 'dwarven-thunderlock',
  minTier: FIND_MIN_TIER,
  weight: 1,
  mint: (rolls = Math.random) => {
    const n = FIND_PELLETS.min + Math.floor(rolls() * (FIND_PELLETS.max - FIND_PELLETS.min + 1));
    return [createThunderlock(), createPellets(n)];
  },
});

/** And its LEGENDARY record, for the roll that finds one and then
 *  rolls it up: the named, storied one. The affixes are the weapon's
 *  own case - it is already the hardest hitter, so its signature is
 *  what it does to the user rather than more damage. */
registerLegendary({
  id: 'the-last-lock', name: 'The Last Lock', group: WEAPON_GROUP, templates: [THUNDERLOCK_TEMPLATE],
  exclusive: true,   // a gun does not roll up as a blade forged for a dragon hunt
  affixes: [
    { id: 'damage', value: 20 },
    { id: 'stat', param: 'agility', value: 10 },
    { id: 'skill', param: 33, value: 30 },   // Archery
  ],
  enchantment: { type: 3, param: 20 },   // CastWhenStrikes - the shot carries a spell
  lore: 'The Dwemer left no instructions and no second one.',
});

// ── THE SOUND ───────────────────────────────────────────────────────
//
// AUDIT-THUNDERLOCK F8: the clips existed and the GAME NEVER PLAYED
// ONE. They were baked, allow-listed, documented and wired into the
// lab - and the machine only emits `bowSound` for a bow, so the
// weapon fired in silence in all four hosts. A sound nobody hears is
// not a sound, and the lab having it made that harder to notice
// rather than easier.
//
// They go in through the door a mod's WAV already uses:
// audio.registerSound(key, bytes) registers a decoded clip under a
// string key, and every entry point that takes a DAGGER.SND index
// takes that key instead (MW-D40). So the weapon's clips are played
// by `audio.playOneShot('thunderlock:fire')` - no new audio path, and
// no host learns that this weapon has sounds of its own.
export const SFX = Object.freeze({
  fire: 'thunderlock:fire',
  open: 'thunderlock:open',
  close: 'thunderlock:close',
});
/** The picks from public/sfx (see its SOURCES.md - all CC0, all baked
 *  to DAGGER.SND's own 11025Hz 8-bit mono).
 *
 *  FIELD-GUN15 (2026-09-20, Mac, with the lab's panel open: "Use these
 *  sounds"). These three ARE the head of their candidate list in
 *  src/tools/gunLab.js, which is where the audition happens and what
 *  the lab's dropdowns open on - and that is pinned now rather than
 *  just said, because two places holding one decision is how every
 *  earlier round of this weapon went wrong. */
export const SFX_FILES = Object.freeze({
  [SFX.fire]: 'fire-dry.wav',
  [SFX.open]: 'open-gunrack.wav',
  [SFX.close]: 'close-shell.wav',
});
export const sfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _sounds = null;
/** Register the three clips, once. Answers how many took. */
export function installThunderlockSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_sounds ??= (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(sfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the weapon still fires, silently */ }
    }
    return n;
  })());
}

// ── THE MUZZLE'S LIGHT ───────────────────────────────────────────────
//
// FIELD-GUN13 (2026-09-19, Mac: "The muzzle flash itself shouldn't be
// affected by the darkening lighting. It should produce lighting").
//
// TWO ASKS IN ONE SENTENCE, and they are opposite ends of the same
// fact. The flash is the brightest thing in the room for two frames,
// so (a) it cannot be DARKENED by the room - combat/weaponRig.js's
// `drawThunderlock` lifts the sprite's tint to white on the curve -
// and (b) it must LIGHT the room, which is this.
//
// IT IS THE TORCH'S OWN SHAPE, deliberately. `playerTorchLight`
// (systems/playerTorch.js) is the port's one worked example of a
// light the PLAYER carries: a module-level read of state the frame
// already parked on the entity, answering the `{x, y, z, range,
// carried}` record `magicCandle.withPlayerLights` prepends to a
// host's array. Written that way, the six light arrays across the
// four hosts add one argument each and no host learns that a weapon
// can be a lamp. A
// second mechanism for the same job would be a second thing to keep
// in step.
//
// THE BASIS IS YAW ONLY, for the reason the torch's is (see its
// header): the offset is in the player BODY's space and the pitch
// belongs to the camera. A gun does not fire into the ceiling because
// you glanced up - the shot's own trajectory is the ranged lane's
// business, and this is only where the flash sits.
//
// THE COLOUR IS THE ORB'S, and FIELD-GUN17 (Mac: "can we can the
// color of the muzzle flash and the light emitted to the same color as
// the orb?") is what put one here at all. This used to say NO COLOUR,
// on the reading that saying nothing beat inventing a temperature -
// which was right, and stopped one step short: the orb is a texture
// the game loads, so it can be ASKED rather than guessed. It is
// sampled off its own archive the first time one flies
// (characters/thunderlockIds.js orbColour) and the muzzle FLASH is
// painted in the same answer, so the light a shot throws and the thing
// it throws cannot be two different colours. White until the orb has
// been seen, which is what the shared channel gave it before.

/** Where the barrel is, in the player body's frame. The torch's own
 *  two numbers (0.3 out, 1.2 up) put the hand where the hand is; the
 *  forward reach is the barrel's, which is most of an arm further out
 *  than a torch is held. To the RIGHT because that is the hand the
 *  classic sprite draws in - the handedness mirror is a picture, not
 *  a body (FPSWeapon.cs:378 flips the IMAGE). */
export const MUZZLE_OFFSET = Object.freeze({ right: 0.3, up: 1.2, forward: 0.9 });

/**
 * The light the flash throws, or null. Read AFTER the rig's frame,
 * off the glow it parked - so every host answers the same frame's
 * shot, and a host that never runs a weapon rig answers null.
 *
 * @param {object} entity the player
 * @param {number[]} feet the player's feet, the host's `player.pos`
 * @param {number} yaw the camera's yaw
 */
export function thunderlockMuzzleLight(entity, feet, yaw = 0) {
  const glow = entity?._thunderlockFlash;
  if (!(glow > 0) || !feet) return null;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const f = [sy, 0, cy];              // forward
  const r = [cy, 0, -sy];             // right
  const o = MUZZLE_OFFSET;
  return {
    x: feet[0] + r[0] * o.right + f[0] * o.forward,
    y: feet[1] + o.up,
    z: feet[2] + r[2] * o.right + f[2] * o.forward,
    range: GUN_FEEL.flashRange * glow,
    color: orbColour(),   // FIELD-GUN17: `withPlayerLights` takes a light's own colour where it has one
    // MAC-T1: a flash in your own hand gets no bloom glare either -
    // the same exemption the carried torch takes, for the same reason
    // (a torso-sized additive ball painted over the third-person body).
    carried: true,
  };
}
