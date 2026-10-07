// MW-CAST1 (2026-10-07): AN ARM THAT CAN CAST. No committed fixture .kf carries Morrowind's spellcast group, so the
// cast lane (fpArm.castSpell, MW-D39) was pinned by its source alone and its keys were never crossed in a test. This
// is armfpweapon.kf - its every record written back by tools/nifWrite.mjs, which reproduces the file byte for byte -
// with the spellcast group and its idle appended after the file's last key: the three ranges' start / release / stop,
// as Morrowind's base_anim.1st.kf carries them, at times a pin can step to.
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/mwNifFile.js';
import { writeNif } from '../../../tools/nifWrite.mjs';

/** The keys appended, in file time. "<type> release" is where OpenMW casts (character.cpp handleTextKey). */
export const CAST_KEYS = Object.freeze([
  [8.4, 'SpellCast: Equip Start'], [8.5, 'SpellCast: Equip Stop'],
  [8.6, 'SpellCast: Self Start'], [8.8, 'SpellCast: Self Release'], [9.0, 'SpellCast: Self Stop'],
  [9.1, 'SpellCast: Touch Start'], [9.3, 'SpellCast: Touch Release'], [9.5, 'SpellCast: Touch Stop'],
  [9.6, 'SpellCast: Target Start'], [9.9, 'SpellCast: Target Release'], [10.2, 'SpellCast: Target Stop'],
  [10.3, 'IdleSpell: Start'], [10.5, 'IdleSpell: Stop'],
]);

/** armfpweapon.kf with CAST_KEYS appended (`without` drops keys by text - a cast with no release, say). */
export function castClip({ without = [] } = {}) {
  const nif = parseNif(new Uint8Array(readFileSync(new URL('./armfpweapon.kf', import.meta.url))));
  const records = nif.records.map((r) => ({ ...r }));
  const tk = records.find((r) => r.type === 'NiTextKeyExtraData');
  tk.keys = [...tk.keys, ...CAST_KEYS.filter(([, text]) => !without.includes(text)).map(([time, text]) => ({ time, text }))];
  return writeNif(records, nif.roots);
}
