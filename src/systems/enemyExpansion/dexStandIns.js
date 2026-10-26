// ARN3 (2026-10-26; Mac: "We were instructed to remove Dagger Exapanded Enemy textures. Is there any way to retain it
// but also oblige the creators request?", then "let's do arena") - THE ENEMY EXPANSION WITHOUT ITS AUTHORS' ART.
// Kamer & Kab asked for their textures to come out. The fifty enemies, their tables and their laws stay; every archive
// whose pictures were theirs - their own renders (dexArt.js `own`) and their paint on Daggerfall's sprites (`repainted`,
// Port-Doctrine's fourth exception until this) - is drawn from Bethesda's own art instead, which is never carried:
//   - ARENA'S (`arena`: the creature's CFA set in GLOBAL.BSA), when TES: Arena has the creature and the player has
//     attached Arena - Bethesda's freeware, the player's own files (dexArena.js);
//   - DAGGERFALL'S otherwise (`classic`): a classic archive copied record for record from the player's own TEXTURE file
//     - the sprite a repaint was painted over, or the nearest classic creature or class.
// The pictures the tables draw that ARE Daggerfall's records (derived.json: the five rider sets but one corpse, the
// Will-o'-wisp) were never the authors' and stand as they were.
//
// A LEAF: the table, the record laws and the classic copies' entries; the Arena half registers from dexArena.js.

import { DEX_CLASSIC_FRAMES } from './dexClassicFrames.js';
import { VANILLA_ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import UNPAINTED from '../../../vendor/daggerfall-enemy-expansion/unpainted.json' with { type: 'json' };
import { buildDerivedPicture } from '../../formats/derivedTexture.js';

/** Where each archive's pictures come from now. `arena` the CFA set (files 1-6: five facings and the death),
 *  `classic` the TEXTURE archive copied when Arena is not attached (or has no such creature), `height` the creature's
 *  visible height in the authors' art, measured before it was removed (its rec 0 frame 0 opaque rows times its xml
 *  scale) - what Arena's sprite is scaled to, so a creature stands as tall as it did. `xml` keeps the mod's own xml
 *  scale on a copy of the very sprite a repaint was painted over (or the derived riders' set it joins); every other
 *  copy stands at its classic record's own scale. `only` replaces just those records (the Knight Rider's corpse: the
 *  rest of 1500 is derived). The choice of creature is the owner's to change; each is named. */
export const DEX_STAND_INS = Object.freeze({
  1500: { classic: 380, only: [20], xml: true },            // the riders' corpse (male): a dead man
  1504: { classic: 482, xml: true },                        // Bounty Hunter: TEXTURE.482, the sprite it was painted over
  1505: { classic: 482, xml: true },                        // Royal Knight: TEXTURE.482 (AUDIT DEX B1)
  1507: { classic: 488 },                                   // the classic Barbarian (male): his own sprite again
  1508: { classic: 487 },                                   // the classic Barbarian (female)
  1509: { classic: 486, xml: true },                        // Druid: TEXTURE.486
  1510: { classic: 490 },                                   // Necromancer Glaivier: the Battlemage
  1511: { classic: 486, xml: true },                        // Necromancer Acolyte: TEXTURE.486
  1512: { classic: 490, xml: true },                        // Rogue Druid: TEXTURE.490
  1513: { classic: 488 },                                   // Dark Slayer (male): the Knight
  1514: { classic: 487 },                                   // Dark Slayer (female): the Knight
  1515: { classic: 480 },                                   // Necromancer Assassin: the Assassin
  1516: { classic: 485 },                                   // Witch Defender: the Mage (female)
  1519: { classic: 488 },                                   // the classic Monk (male): his own sprite again
  1520: { classic: 487 },                                   // the classic Monk (female)
  1530: { classic: 491, xml: true },                        // Spellsword and Archer Riders (female): TEXTURE.491
  1531: { classic: 491, xml: true },                        // Spellsword Rider (male): TEXTURE.491
  1532: { classic: 495, xml: true },                        // Archer Rider (female): TEXTURE.495
  1533: { classic: 495, xml: true },                        // Archer Rider (male): TEXTURE.495
  1600: { arena: 'GOBLIN', classic: 262, height: 64 },      // Goblin: Arena's; else the Orc
  1601: { arena: 'LIZARD', classic: 262, height: 78.96 },   // Lizard Man: Arena's; else the Orc
  1602: { arena: 'HOM', classic: 256, height: 38.5 },       // Homunculus: Arena's; else the Imp
  1603: { classic: 258 },                                   // Bat: the Giant Bat
  1604: { classic: 265 },                                   // Nymph: Daggerfall's
  1605: { arena: 'SKELE', classic: 270, height: 78.4 },     // Skeletal Soldier: Arena's skeleton; else the Skeletal Warrior
  1606: { classic: 277 },                                   // Grotesque: the Gargoyle
  1607: { arena: 'LIZARD', classic: 267, height: 81.48 },   // Lizard Warrior: Arena's lizard man; else the Orc Sergeant
  1609: { classic: 473, xml: true },                        // Vengeful King Lysandus: TEXTURE.473, the sprite under the paint
  1611: { arena: 'MEDUSA', classic: 297, height: 46.4 },    // Medusa: Arena's; else the Lamia
  1612: { arena: 'WOLF0', classic: 260, height: 53.2 },     // Wolf: Arena's; else the Sabretooth
  1613: { arena: 'WOLF0', classic: 260, height: 42.24 },    // Dog: Arena's wolf; else the Sabretooth
  1614: { arena: 'HOUND', classic: 260, height: 57.75 },    // Hell Hound: Arena's; else the Sabretooth
  1615: { arena: 'SWOLF0', classic: 260, height: 44.1 },    // Snow Wolf: Arena's; else the Sabretooth
  1616: { classic: 259 },                                   // Boar: the Grizzly Bear
  1617: { classic: 260 },                                   // Mountain Lion: the Sabretooth
  1618: { arena: 'TROLL', classic: 271, height: 73 },       // Troll: Arena's; else the Giant
  1619: { classic: 271 },                                   // Ogre: the Giant
  1620: { classic: 275 },                                   // Mudcrab: the Giant Scorpion
  1621: { classic: 296 },                                   // Land Dreugh: the Dreugh
  1622: { arena: 'WRAITH', classic: 278, height: 99 },      // Gloom Wraith: Arena's; else the Wraith
  1623: { arena: 'GHOST', classic: 273, height: 95 },       // Faded Ghost: Arena's; else the Ghost
  1624: { arena: 'SPIDER', classic: 261, height: 35 },      // Blood Spider: Arena's; else the Spider
  1625: { arena: 'ICE', classic: 293, height: 77 },         // Ice Golem: Arena's; else the Ice Atronach
  1626: { arena: 'GHOUL', classic: 272, height: 82.4 },     // Ghoul: Arena's; else the Zombie
  1627: { arena: 'DEAMON', classic: 281, height: 88.8 },    // Fire Daemon: Arena's; else the Fire Daedra
  1628: { arena: 'PAT', classic: 282, height: 106 },        // Minotaur: Arena's (PAT*.CFA); else the Daedroth
  1629: { arena: 'IRON', classic: 291, height: 99.6 },      // Iron Golem: Arena's; else the Iron Atronach
  1630: { arena: 'GHOUL', classic: 274, height: 82.4 },     // Dire Ghoul: Arena's ghoul; else the Mummy
  1631: { arena: 'STONE', classic: 291, height: 89.6 },     // Stone Golem: Arena's; else the Iron Atronach
  1639: { classic: 291 },                                   // Centurion Sphere: the Iron Atronach
  1640: { classic: 291 },                                   // Steam Centurion: the Iron Atronach
  1703: { classic: 256 },                                   // Scamp: the Imp
  1708: { classic: 281 },                                   // Dremora Churl: the Fire Daedra
});

/** The record a row's corpse picture is in, for the archives that hold their own (MonsterBase / ClassBase .mdb.csv
 *  CorpseTextureArchive / FemaleCorpseTextureArchive naming the archive itself). Every other row's corpse is a classic
 *  archive's already. */
export const DEX_CORPSE_RECORDS = Object.freeze({
  1500: 20, 1510: 25, 1513: 25, 1514: 25, 1515: 30, 1516: 25, 1530: 20,
  1600: 20, 1601: 20, 1602: 15, 1607: 20, 1611: 25, 1612: 20, 1613: 20, 1614: 20, 1615: 20, 1616: 20, 1617: 20, 1618: 20,
  1619: 20, 1620: 20, 1621: 20, 1624: 20, 1625: 20, 1626: 20, 1627: 25, 1628: 20, 1629: 20, 1630: 20, 1639: 20, 1640: 20,
  1703: 25, 1708: 25,
});

/** A person's corpse (the classes' own CorpseTexture, TEXTURE.380 record 1). */
export const PERSON_CORPSE = Object.freeze([380, 1]);

/** The corpse a classic archive's own creature leaves - its classic row's CorpseTexture - or a person's. */
export function classicCorpseOf(archive) {
  const rows = Array.isArray(VANILLA_ENEMY_BASICS) ? VANILLA_ENEMY_BASICS : Object.values(VANILLA_ENEMY_BASICS);
  const row = rows.find((r) => r?.maleTexture === archive || r?.femaleTexture === archive);
  const c = row?.corpseTexture;
  return c && c.archive > 0 ? [c.archive, c.record] : PERSON_CORPSE;
}

/** The classic record a mod record is copied from: the same record where the classic sprite has it; a ranged or spell
 *  record it lacks (20-29) its attack at the same facing, a hurt or idle one (10-19) its move's - or null. */
export function classicRecordOf(record, frames) {
  if (record < frames.length && frames[record] > 0) return record;
  if (record >= 20 && record < 30 && frames[5 + (record % 5)] > 0) return 5 + (record % 5);
  if (record >= 10 && record < 20 && frames[record % 5] > 0) return record % 5;
  return null;
}

/** The frame each repainted picture was painted over (vendor/.../unpainted.json: name -> `{ from: [archive, record,
 *  frame] }`), found by its outline against every frame of its source archive while the pictures were still here -
 *  numbers about the files, no pixel of either. The riders' new attack drawings (1530-1533 at records 5, 6 and 9) trace
 *  no frame and copy their source's record instead. */
export const DEX_UNPAINTED = UNPAINTED;

/** The classic copies, as texture-door entries, for every record of the mod's layout (`dexFrames`, dexArt.js): a
 *  repaint's picture from the frame it was painted over, at the mod's own frame counts; any other record from its
 *  classic record - all of a move or attack's frames, the first of a stand-in hurt or idle - and a corpse record from
 *  the classic creature's corpse. Built from the player's own files at the archive's load (`ctx.classicRgba`), each
 *  sized by its classic record's scale unless the mod's xml sizes it. */
export function classicStandInEntries(archive, dexFrames) {
  const s = DEX_STAND_INS[archive];
  if (!s?.classic) return [];
  const frames = DEX_CLASSIC_FRAMES[s.classic];
  if (!frames) throw new Error(`[DEX] no classic frame count for TEXTURE.${s.classic} (tools/dexStandInFrames.mjs)`);
  const corpseRecord = DEX_CORPSE_RECORDS[archive];
  const out = [];
  const push = (record, frame, from) => out.push({
    archive, record, frame, map: 'Albedo', standIn: true, readOnly: true, fileName: `${archive}_${record}-${frame}`,
    build: async (ctx) => {
      const pic = await buildDerivedPicture({ from }, ctx.classicRgba);
      if (s.xml) return pic;
      const scale = await ctx.classicScale?.(from[0], from[1]);
      return scale ? { ...pic, scale } : pic;
    },
  });
  dexFrames.forEach((n, record) => {
    if (!n || (s.only && !s.only.includes(record))) return;
    if (record === corpseRecord) {
      const [ca, cr] = s.classic === PERSON_CORPSE[0] ? PERSON_CORPSE : classicCorpseOf(s.classic);
      push(record, 0, [ca, cr, 0]);
      return;
    }
    if (DEX_UNPAINTED[`${archive}_${record}-0`]) {
      for (let f = 0; f < n; f++) {
        const spec = DEX_UNPAINTED[`${archive}_${record}-${f}`];
        if (!spec) break;   // as DFU imports: frame 0 to the first one missing
        push(record, f, spec.from);
      }
      return;
    }
    const from = classicRecordOf(record, frames);
    if (from == null) return;
    const count = from === record || record >= 20 ? frames[from] : 1;
    for (let f = 0; f < count; f++) push(record, f, [s.classic, from, f]);
  });
  return out;
}
