// @ts-check
// SKIN2 (Mac, 2026-09-25: "Implement these as new skin options"): DAGGERFALL'S OWN CLASSES, AS SKINS - on-foot sets 16
// onward. A class sheet is Daggerfall's enemy-class shape, five orientations a group: 0-4 walk, 5-9 swing, 10-14 hurt,
// 15-19 idle, 20-24 ranged or spell, 25-29 bow where the sheet has one, in the mod's orientation order. This file maps
// a body table to a class record for `spriteFor` (bible/06-Systems/Eye-Of-The-Beholder.md SKIN2). OWN-WORK4
// (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): the pictures are ours. Each skin names its
// classic sheet (`from`, in the player's ARENA2); player/classSkinArt.js dyes and marks each frame.

/** The mod's own on-foot sets (Graphics.OnFoot 0..15); a class skin is an index past them. */
export const EOTB_FOOT_SET_COUNT = 16;

/** A classic class sheet's frames a group (walk, swing, hurt, idle, cast, bow), and the records that differ - read off
 *  the player's TEXTURE files: TEXTURE.477 swings its record 8 in seven, TEXTURE.485 casts in five. */
const GROUP_FRAMES = Object.freeze([4, 6, 1, 1, 4, 4]);
const ODD_RECORDS = Object.freeze({
  477: Object.freeze({ 8: 7 }),
  485: Object.freeze({ 20: 5, 21: 5, 22: 5, 23: 5, 24: 5 }),
});
/** The sheets of thirty records, whose last group is the bow. */
export const BOW_SHEETS = Object.freeze([475, 489, 490]);
const sheetFrames = (/** @type {number} */ from) =>
  Array.from(
    { length: BOW_SHEETS.includes(from) ? 30 : 25 },
    (_, record) => ODD_RECORDS[from]?.[record] ?? GROUP_FRAMES[Math.floor(record / 5)],
  );

/** @typedef {{archive:number, name:string, gender:string|null, from:number, bow:boolean, scale?:Readonly<Record<string, number>>, frames:ReadonlyArray<number>}} ClassSkin */
/** ACRO-SHORT: a classic record drawn at another scale than its group - TEXTURE.483's front three-quarter idle is a
 *  whole figure 81 pixels tall where the idle's other views are 110. Every skin painted on that sheet carries it. */
const SHEET_SCALE = Object.freeze({ 483: Object.freeze({ 16: 81 / 110 }) });
/** One skin: its key (`archive`, the port's own number, never read from ARENA2), its name and sex, and `from`, the classic
 *  sheet its frames are built from - the one SKIN2's pictures were sized by. */
const classSkin = (archive, name, gender, from) =>
  Object.freeze({
    archive,
    name,
    gender,
    from,
    bow: BOW_SHEETS.includes(from),
    ...(SHEET_SCALE[from] ? { scale: SHEET_SCALE[from] } : {}),
    frames: Object.freeze(sheetFrames(from)),
  });

/** The twenty, in the order a saved `Graphics.OnFoot` names them (16 + the index). The female monk is drawn on the robed
 *  woman's sheet (485), the partner of the male monk's 486. */
/** @type {ReadonlyArray<ClassSkin>} */
export const CLASS_SKINS = Object.freeze([
  classSkin(1523, 'Acrobat', 'male', 482),
  classSkin(1524, 'Acrobat', 'female', 483),
  classSkin(1536, 'Assassin', 'male', 490),
  classSkin(1537, 'Assassin', 'female', 489),
  classSkin(1538, 'Burglar', 'male', 480),
  classSkin(1539, 'Burglar', 'female', 479),
  classSkin(1504, 'Bounty Hunter', 'male', 482),
  classSkin(1535, 'Dark Acolyte', null, 486),
  classSkin(1513, 'Dark Brotherhood', 'male', 482),
  classSkin(1514, 'Daggerfall Adventurer', null, 483),
  classSkin(1530, 'Healer', 'male', 486),
  classSkin(1527, 'Healer with Shield', 'male', 486),
  classSkin(1528, 'Healer', 'female', 485),
  classSkin(1519, 'Monk', 'male', 486),
  classSkin(1520, 'Monk', 'female', 485),
  classSkin(1525, 'Nightblade', 'male', 490),
  classSkin(1526, 'Nightblade', 'female', 489),
  classSkin(1529, 'Pirate', 'male', 484),
  classSkin(1540, 'Sorcerer', 'male', 488),
  classSkin(1541, 'Sorcerer', 'female', 477),
]);

/** How many class frames the build can draw - every record's every frame of the twenty. */
export const CLASS_SPRITE_COUNT = CLASS_SKINS.reduce((sum, skin) => sum + skin.frames.reduce((a, b) => a + b, 0), 0);

/**
 * ACRO-SHORT (2026-09-27, Discord: "acrobat sprite is super short on certain angles"). A record drawn at another scale
 * than its group is sized as drawn, as `TextureReplacement.SetBillboardScale` (TextureReplacement.cs:663-675) sizes a
 * DFU billboard by its XML: a skin on TEXTURE.483 carries 81/110 on record 16 (SHEET_SCALE); `spriteOffset` reads it.
 */
export function classRecordScale(archive, record) {
  return CLASS_SKINS.find((s) => s.archive === archive)?.scale?.[record] ?? 1;
}

/** Every on-foot set the player can wear: the mod's sixteen and the classes after them. */
export const FOOT_SKIN_COUNT = EOTB_FOOT_SET_COUNT + CLASS_SKINS.length;

/** The class skin an on-foot index names, or null for one of the mod's own sets. */
export const classSkinOf = (onFoot) =>
  Number.isInteger(onFoot) && onFoot >= EOTB_FOOT_SET_COUNT
    ? (CLASS_SKINS[onFoot - EOTB_FOOT_SET_COUNT] ?? null)
    : null;

/** The label a class skin is shown under: "Healer (female)", "Dark Acolyte". */
export const classSkinLabel = (skin) => (skin.gender ? `${skin.name} (${skin.gender})` : skin.name);

/** OWN-WORK4: the class frame a sprite key names (`<archive>_<record>-<frame>` of a class skin), or null. */
export function classSkinKeyOf(key) {
  const match = /^(\d+)_(\d+)-(\d+)$/.exec(typeof key === 'string' ? key : '');
  const skin = match ? CLASS_SKINS.find((s) => s.archive === Number(match[1])) : null;
  if (!skin) return null;
  const record = Number(match[2]),
    frame = Number(match[3]);
  return frame < (skin.frames[record] ?? 0) ? { skin, record, frame } : null;
}

/**
 * Which class record group each of the body's on-foot tables reads. The READY tables stand in the idle pose (a
 * Daggerfall foe is never unarmed), the armed walks in the walk, death in the hurt pose (a class sheet carries no
 * fall - the corpse is a separate sprite), the loose on the bow where the set has one and the ranged throw where it
 * does not, and the cast on the ranged-or-spell group.
 */
export const CLASS_TABLE_BASE = Object.freeze({
  Idle: 15,
  Move: 0,
  Death: 10,
  IdleMelee: 15,
  MoveMelee: 0,
  AttackMelee: 5,
  IdleRanged: 15,
  MoveRanged: 0,
  AttackRanged: 20,
  IdleSpell: 15,
  MoveSpell: 0,
  AttackSpell: 20,
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
  return Math.floor((f * n) / t); // f < t, so never past the record's last
}
