// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SKIN2 — DAGGERFALL'S OWN CLASSES, AS SKINS.
//
// Mac (2026-09-25), with an archive of redrawn Daggerfall class sprites
// (ExistingClasses: the acrobat, assassin, burglar, bounty hunter, dark
// acolyte, Dark Brotherhood, healer, monk, nightblade, pirate and
// sorcerer, most in both sexes, and a vanilla adventurer): "Implement
// these as new skin options".
//
// THEY ARE NOT EYE OF THE BEHOLDER'S LAYOUT. The mod draws a player from
// twelve on-foot tables of five records each (player/eotbBillboard.js
// STATE_TABLES: idle, walk, death, ready, armed walk, swing, bow ready,
// bow walk, loose, spell ready, spell walk, cast - 155 sprites). These
// are Daggerfall's own enemy-class sheets, the shape DFU's MobileEnemy
// reads for a human foe, five records of five orientations each:
//
//     0-4    walk            (4 frames)
//     5-9    primary attack  (6 frames - the swing)
//     10-14  hurt            (1 frame)
//     15-19  idle            (1 frame)
//     20-24  ranged / spell  (4 frames - a caster's cast, a thief's throw)
//     25-29  bow             (4 frames - on the sets that carry one)
//
// The five orientations are the mod's own (front, three-quarter, side,
// three-quarter back, back, the other side mirrored - RECORD_OFFSETS), so
// the wheel, the mirror and the size law carry over unchanged; only which
// record a table reads and how many frames it holds differ. That mapping
// is this file, and `spriteFor` asks it for any set past the mod's
// sixteen - so the body, the preload, the peers and the Skin card all
// draw a class skin through the one door they already use.
//
// THE ART is vendored under `vendor/class-skins/<archive>/` with a
// manifest of every record's real frame count (`skins.json`, written
// when the archive was unpacked: the pack is not uniform - the female
// healer's cast is five frames, the bounty hunter's last record two, a
// walk record of the pirate's three).
// ═══════════════════════════════════════════════════════════════════

import manifest from '../../vendor/class-skins/skins.json' with { type: 'json' };

/** The mod's own on-foot sets (Graphics.OnFoot 0..15); a class skin is an index past them. */
export const EOTB_FOOT_SET_COUNT = 16;

/** @typedef {{archive:number, name:string, gender:string|null, bow:boolean, frames:ReadonlyArray<number>}} ClassSkin */
/** @type {ReadonlyArray<ClassSkin>} */
export const CLASS_SKINS = Object.freeze(manifest.skins.map((s) => Object.freeze({ ...s, frames: Object.freeze([...s.frames]) })));

/** Every on-foot set the player can wear: the mod's sixteen and the classes after them. */
export const FOOT_SKIN_COUNT = EOTB_FOOT_SET_COUNT + CLASS_SKINS.length;

/** The class skin an on-foot index names, or null for one of the mod's own sets. */
export const classSkinOf = (onFoot) => (Number.isInteger(onFoot) && onFoot >= EOTB_FOOT_SET_COUNT ? CLASS_SKINS[onFoot - EOTB_FOOT_SET_COUNT] ?? null : null);

/** The label a class skin is shown under: "Healer (female)", "Dark Acolyte". */
export const classSkinLabel = (skin) => (skin.gender ? `${skin.name} (${skin.gender})` : skin.name);

/**
 * Which class record group each of the body's on-foot tables reads. The READY tables stand in the idle pose (a
 * Daggerfall foe is never unarmed), the armed walks in the walk, death in the hurt pose (a class sheet carries no
 * fall - the corpse is a separate sprite), the loose on the bow where the set has one and the ranged throw where it
 * does not, and the cast on the ranged-or-spell group.
 */
export const CLASS_TABLE_BASE = Object.freeze({
  Idle: 15, Move: 0, Death: 10,
  IdleMelee: 15, MoveMelee: 0, AttackMelee: 5,
  IdleRanged: 15, MoveRanged: 0, AttackRanged: 20,
  IdleSpell: 15, MoveSpell: 0, AttackSpell: 20,
});
/** The bow's group, on a set that carries one. */
export const CLASS_BOW_BASE = 25;

/** The class record a table's orientation offset reads (`offset` 0..4, the wheel's RECORD_OFFSETS). */
export function classRecord(skin, table, offset) {
  const base = table === 'AttackRanged' && skin.bow ? CLASS_BOW_BASE : CLASS_TABLE_BASE[table];
  return base == null ? null : base + offset;
}

/**
 * The class frame for the body's frame `frame` of a table `tableFrames` long. The body's clocks run the mod's clip
 * lengths (TABLE_FRAMES), so the class record's own frames are spread over them in order: a four-frame walk under a
 * two-frame armed walk shows its frames 0 and 2, a one-frame idle under a two-frame spell ready holds its one.
 */
export function classFrame(skin, record, frame, tableFrames) {
  const n = skin.frames[record] ?? 1;
  const t = Math.max(1, tableFrames | 0);
  const f = Math.min(Math.max(frame | 0, 0), t - 1);
  return Math.floor((f * n) / t);   // f < t, so never past the record's last
}
