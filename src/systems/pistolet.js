// THE DWARVEN PISTOLET - the port's second gun, and the first one a pair of can be carried.
//
// The owner, 2026-10-21: "this spritesheet is to be for our new weapon type, which can also be duel wielded. Its a dwarven
// flintlock style pistol. We need to use the same prototype testing we did for the thunderlock" - the pistol lab
// (pistol-proto.html, bible/05-Combat/Pistol-Lab.md) - then "Next this is the paperdoll model/inventory. The gun should
// use the same ammo the thunderlock uses", and "Dwarven Pistolet" for its name. Design and record:
// bible/05-Combat/Dwarven-Pistolet.md.
//
// IT IS THE THUNDERLOCK'S SHAPE, ONE WEAPON ALONG (systems/thunderlock.js is the worked example and every law here names
// the one it follows): an ARCHERY weapon that keeps the melee one-shot machine and pays the ranged cooldown; a custom
// template past DFU's table; its own art archive; its pictures through the vendor-texture door. What is its own:
//   - ONE-HANDED (characters/equipTable.js answers Either), so a second one in the other hand is a pair
//     (combat/twoHands/handsLaw.js DUAL_GUN_TYPES) - and a pair of guns reloads hand by hand (combat/playerWeapon.js);
//   - it spends the THUNDERLOCK'S PELLET (characters/thunderlockIds.js ammoTemplateFor), so it has no ammunition of its own
//     and the shops' Pellets (systems/shopStock.js) feed both guns;
//   - the owner's lab numbers (combat/gun/gunFeel.js PISTOLET_FEEL), and art drawn at Daggerfall's own scale.
//
// THE INDEX is 562, the next past the Thunderlock's pair - past DFU's 288 and Climates & Calories' 530-541, so
// registerCustomTemplates takes it and the frozen DFU table stays what it is.

import { registerCustomTemplates, mintCondition, setItemFields, registerOwnItemImage } from './item/itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from './textureReplacement.js';
import { SKILLS } from './skills.js';
import { APP_ROOT } from './appRoot.js';
import { PISTOLET_FEEL } from '../combat/gun/gunFeel.js';
import { WEAPON_GROUP, GUN_SHARE, setSecondGun } from './thunderlock.js';   // the Pellet's home, and the find's rules - one gun's laws, the other's to read
import { EQUIP_SLOTS } from '../characters/paperdoll/paperdoll.js';   // the slot a hand's weapon is worn in
import { PISTOLET_TEMPLATE, PISTOLET_ARCHIVE, PISTOLET_SPAN } from '../characters/thunderlockIds.js';

export { PISTOLET_TEMPLATE, PISTOLET_ARCHIVE };

/**
 * The row, in DFU's ItemTemplates.txt columns (the Thunderlock's own reasoning, scaled to a weapon a third its size).
 * The owner's numbers: 2.5 kg (the Thunderlock 6), 260 gold (480). `hitPoints` 90 is the Thunderlock's - the same
 * firing chamber - and the weapons' one pool sets the condition anyway (characters/weapons.js WEAPON_CONDITION_POOL).
 * `isOneHanded` TRUE: the art holds it in one fist, and a pair is the point. `enchantmentPoints` 250, between a dagger's
 * and the Thunderlock's 400.
 */
export const PISTOLET_TEMPLATES = Object.freeze([{
  index: PISTOLET_TEMPLATE,
  name: 'Dwarven Pistolet',
  baseWeight: 2.5,
  hitPoints: 90,
  basePrice: 260,
  enchantmentPoints: 250,
  rarity: 20,
  drawOrderOrEffect: 100,     // BlitItems' layer - weapons draw last, over the hand
  isBluntWeapon: false,
  isOneHanded: true,
  worldTextureArchive: PISTOLET_ARCHIVE,
  worldTextureRecord: 0,
  playerTextureArchive: PISTOLET_ARCHIVE,
  playerTextureRecord: 0,
}]);
registerCustomTemplates(PISTOLET_TEMPLATES);

export const isPistolet = (item) => item?.templateIndex === PISTOLET_TEMPLATE;

/** The skill a hit with it is scored on - the Thunderlock's, for the Thunderlock's reason (characters/weapons.js). */
export const PISTOLET_SKILL = SKILLS.Archery;
/** Its damage span, from the leaf that holds it once (characters/thunderlockIds.js PISTOLET_SPAN): 4-15 - a Long Bow is
 *  4-18 and the Thunderlock 7-26. One-handed and quicker to the next shot, so a pair is two of these, each hand on its
 *  own reload, at the dual wielder's off-hand terms (handsLaw.js DUAL). */
export const PISTOLET_DAMAGE = PISTOLET_SPAN;

/** Mint one - the Thunderlock's createThunderlock, one template along: Dwarven by default, the metal ladder's dye and
 *  damage modifier reading `material`. */
export function createPistolet({ material = 4, condition = null } = {}) {
  const item = mintCondition(setItemFields({
    group: WEAPON_GROUP, templateIndex: PISTOLET_TEMPLATE,
    material, flags: 0, variant: 0, message: 0, stackCount: 1,
  }));
  if (condition != null) item.currentCondition = Math.max(0, Math.min(item.maxCondition ?? condition, condition));
  return item;
}

// ── THE PICTURES ─────────────────────────────────────────────────────
//
// ONE PICTURE PER JOB, as the Thunderlock's since THUNDERLOCK-ART: the doll layer carries the fist's gap, the list
// shows the whole gun. The owner's 24x17 sprite IS the list's picture; tools/pistoletArt.mjs cuts each hand's doll
// layer from it - each tilted barrel-down, the right hand's flipped to point toward the left's - and gilds all three
// for the Sunken Sovereign (systems/gilded.js).
//
// TWO HANDS ON THE DOLL. A classic Either-hand weapon carries two doll records - TEXTURE.234's base for the left hand and
// +1 for the right (ui/paperDoll.js: "an Either-hand weapon worn RIGHT uses the +1 record") - because a pair puts one in
// each hand and they cannot share a place. The Pistolet's two are each hand's own layer, at each hand's own offset.

/**
 * WHERE EACH HANGS (FIELD-GUN4's question, the Thunderlock's PAPERDOLL_OFFSET, for two hands). The doll's fists were
 * MEASURED, not guessed: the gap a classic one-handed weapon's doll record leaves for the fist (TEXTURE.234, the
 * player's own ARENA2 - dagger, mace, shortsword, war axe, each hand's record) closes at panel (27, 96) for the right
 * hand and (69, 95) for the left.
 *
 * THE LEFT HAND (the picture's right) wears the sprite as drawn, tilted 45 degrees barrel-down to the picture's left
 * (the owner, 2026-10-22: "It should be at a downward angle in the right hand in the picture. Not mirrored" - and of
 * it, "Much better"). Its band centre - the grip's middle, where the fist closes (tools/pistoletArt.mjs
 * dollGrip('left'), layer pixel (20.8, 9.9)) - goes on the measured gap: panel (69 - 20.8, 95 - 9.9).
 *
 * THE RIGHT HAND (the picture's left) wears the sprite FLIPPED, tilted 60 degrees barrel-down to the picture's right,
 * toward the other gun - the owner's pick from rendered options after five rejected cuts of this hand: "#4 is the
 * closest but needs adjusting", "C but lower", then 2 px lower ("Sorry I meant #2"). Its band centre (dollGrip('right'),
 * (9.7, 8.6)) sits 2 px below the measured gap - panel (27, 98), the layer at (27 - 9.7, 98 - 8.6) - the owner's eye,
 * not a rule: the right fist is not the left's mirror, so no one rule seats both. The owner names hands as the picture
 * shows them. Screen coordinates, the panel's origin (200, 8) written beside them as the Thunderlock's are.
 */
// AUDIT PISTOLET M8: the Pistolet's own names - the Thunderlock's records are PAPERDOLL_OFFSET, ART_RECORDS, ICON_FILES,
// SFX, SFX_FILES, iconUrl and sfxUrl, and two modules declaring one name is AUDIT 24's ONE HOME gate (audit24_onehome).
export const PISTOLET_PAPERDOLL_OFFSET = Object.freeze({ right: Object.freeze({ x: 200 + 17, y: 8 + 89 }), left: Object.freeze({ x: 200 + 48, y: 8 + 85 }) });

/** The records of archive 562, by job. */
export const PISTOLET_ART_RECORDS = Object.freeze({ doll: 0, icon: 1, gildedDoll: 2, gildedIcon: 3, dollLeft: 4, gildedDollLeft: 5 });
export const PISTOLET_ICON_FILES = Object.freeze([
  { archive: PISTOLET_ARCHIVE, record: PISTOLET_ART_RECORDS.doll, frame: 0, file: 'pistolet-paperdoll.png', offset: PISTOLET_PAPERDOLL_OFFSET.right },
  { archive: PISTOLET_ARCHIVE, record: PISTOLET_ART_RECORDS.icon, frame: 0, file: 'pistolet-icon.png' },
  { archive: PISTOLET_ARCHIVE, record: PISTOLET_ART_RECORDS.gildedDoll, frame: 0, file: 'pistolet-paperdoll-gilded.png', offset: PISTOLET_PAPERDOLL_OFFSET.right },
  { archive: PISTOLET_ARCHIVE, record: PISTOLET_ART_RECORDS.gildedIcon, frame: 0, file: 'pistolet-icon-gilded.png' },
  { archive: PISTOLET_ARCHIVE, record: PISTOLET_ART_RECORDS.dollLeft, frame: 0, file: 'pistolet-paperdoll-left.png', offset: PISTOLET_PAPERDOLL_OFFSET.left },
  { archive: PISTOLET_ARCHIVE, record: PISTOLET_ART_RECORDS.gildedDollLeft, frame: 0, file: 'pistolet-paperdoll-left-gilded.png', offset: PISTOLET_PAPERDOLL_OFFSET.left },
]);
/** Which of them an item wears for a job: on the doll its HAND's layer (the left hand's only when it is worn there - an
 *  unworn one and a right-hand one wear the right's), in a list the whole gun; gold for a Gilded piece. */
export function pistoletImageRecord(item, forPaperDoll) {
  const gilded = item?.rarity === 'gilded';
  if (!forPaperDoll) return gilded ? PISTOLET_ART_RECORDS.gildedIcon : PISTOLET_ART_RECORDS.icon;
  const left = item?.equipSlot === EQUIP_SLOTS.LeftHand;
  if (gilded) return left ? PISTOLET_ART_RECORDS.gildedDollLeft : PISTOLET_ART_RECORDS.gildedDoll;
  return left ? PISTOLET_ART_RECORDS.dollLeft : PISTOLET_ART_RECORDS.doll;
}
registerOwnItemImage(PISTOLET_TEMPLATE, (item, { forPaperDoll = false } = {}) => ({ archive: PISTOLET_ARCHIVE, record: pistoletImageRecord(item, forPaperDoll) }));

/** AUDIT-THUNDERLOCK F7: the site's root, never the document's. */
export const pistoletIconUrl = (file) => new URL(`art/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _installed = false;
/** Register the pictures once (installThunderlockIcons' door - `standIn: true` IS the registration: archive 562 exists
 *  only as this art, FIELD-GUN1). `fetchBytes` is the test's door. */
export function installPistoletIcons({ fetchBytes = null } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0;
  _installed = true;
  const load = fetchBytes ?? (async (name) => {
    const r = await fetch(pistoletIconUrl(name));
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  });
  return addVendorTextures(PISTOLET_ICON_FILES.map(({ archive, record, frame, file, offset }) => ({
    archive, record, frame, fileName: file, standIn: true, offset, load: () => load(file),
  })));
}

// ── HOW YOU GET ONE ──────────────────────────────────────────────────
//
// The Thunderlock's way exactly (its file says why): never on a shelf - a custom template is in no shop's group table,
// and shopStock.js shelves the Pellet alone - and found from source tier 4 up, arriving loaded. The owner, the same day:
// "make the thunderlock in general more rare along with the new hand cannon" - so it is the SECOND GUN of the
// Thunderlock's own find, GUN_SHARE of its mints (systems/thunderlock.js says why one find and not two): each gun half
// as often as the Thunderlock alone was, the two together exactly as often.
export { GUN_SHARE };
setSecondGun(() => createPistolet());

// ── THE SOUND ────────────────────────────────────────────────────────
//
// The Thunderlock's door (AUDIT-THUNDERLOCK F8): three clips registered under string keys through the mod-sound door, so
// the rig plays `pistolet:fire` and no host learns the weapon has sounds. The files are the owner's three picks off the
// lab's panel, read from the one row that holds them (combat/gun/gunFeel.js PISTOLET_FEEL.sfx) - the pistol lab's
// dropdowns open on the same row, so the audition and the game cannot disagree.
export const PISTOLET_SFX = Object.freeze({ fire: 'pistolet:fire', open: 'pistolet:open', close: 'pistolet:close' });
export const PISTOLET_SFX_FILES = Object.freeze({
  [PISTOLET_SFX.fire]: `${PISTOLET_FEEL.sfx.fire}.wav`,
  [PISTOLET_SFX.open]: `${PISTOLET_FEEL.sfx.open}.wav`,
  [PISTOLET_SFX.close]: `${PISTOLET_FEEL.sfx.close}.wav`,
});
export const pistoletSfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _sounds = null;
/** Register the three clips, once. Answers how many took. */
export function installPistoletSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_sounds ??= (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(pistoletSfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(PISTOLET_SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the weapon still fires, silently */ }
    }
    return n;
  })());
}
