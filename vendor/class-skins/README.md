# Daggerfall class skins (SKIN2)

Twenty redrawn sprite sheets of Daggerfall's own enemy classes, worn as
on-foot skins 16-35 after Eye of the Beholder's sixteen sets
(`src/player/classSkins.js`; the arc's record is
`bible/06-Systems/Eye-Of-The-Beholder.md` SKIN2).

Mac (Lattymoy) handed the archive over on 2026-09-25
(`ExistingClasses.rar`, a RAR5 holding one RAR per set): "Implement
these as new skin options".

**Permission: [Mac: record the artists' permission, or the link to it,
here. The archive names one artist folder, "KAMER - Bounty Hunter".]**

## Layout

`<archive>/<archive>_<record>-<frame>.png`, the key the port's sprite
bundle already indexes by (`player/eotbSprite.js`). A sheet is
Daggerfall's enemy-class shape, five orientation records per group:

| Records | Group | Frames |
|---|---|---|
| 0-4 | walk | 4 |
| 5-9 | primary attack | 6 |
| 10-14 | hurt | 1 |
| 15-19 | idle | 1 |
| 20-24 | ranged / spell | 4 |
| 25-29 | bow (only on the assassin and nightblade sheets) | 4 |

`skins.json` lists each skin's archive, name, sex, whether it has a bow
and **every record's real frame count**, counted off the files. The
pack is not uniform: the female healer's ranged records have five
frames, the bounty hunter's (78 pictures) record 24 has two, and the
pirate's record 3 has three. `test/skin2_class_skins.test.js` checks
the manifest against this folder.

## From the archive

| Archive | Skin | Source folder |
|---|---|---|
| 1523 | Acrobat (male) | `Acrobate male` |
| 1524 | Acrobat (female) | `Acrobat Female` |
| 1536 | Assassin (male) | `Assassin Males/Males` |
| 1537 | Assassin (female) | `Assassin Female/Female` |
| 1538 | Burglar (male) | `Burglar male/Final` |
| 1539 | Burglar (female) | `Burglar Female/Final` |
| 1504 | Bounty Hunter (male) | `Male Bounty Hunter/KAMER - Bounty Hunter` |
| 1535 | Dark Acolyte | `Dark Acolayed` |
| 1513 | Dark Brotherhood (male) | `DB Male/Finished` |
| 1514 | Daggerfall Adventurer | `DF Vanilla` |
| 1530 | Healer (male) | `Healer male/Finished` |
| 1527 | Healer with Shield (male) | `Healer male/Finished/Shield` |
| 1528 | Healer (female) | `Healer Female/Finished` |
| 1519 | Monk (male) | `Monk Male/Finished` |
| 1520 | Monk (female) | `Monk Female/Final` |
| 1525 | Nightblade (male) | `Nightblade Male/Male 2` |
| 1526 | Nightblade (female) | `Nightblade Female/2` |
| 1529 | Pirate (male) | `Pirate_Male` |
| 1540 | Sorcerer (male) | `Sorccerer Male` |
| 1541 | Sorcerer (female) | `Sorccer Female/Final` |

What changed on the way in:

- **Port-assigned archives.** Three sets came without an archive
  number in their file names: the male healer's plain set (`<record>-<frame>.png`)
  and both nightblades. They were given 1530, 1525 and 1526, which no
  other set here uses. The number is only a key: the art is not read
  from ARENA2.
- **Renumbered frames.** Two records had gaps in their frame numbers:
  the vanilla adventurer's record 3 (0, 1, 2, 4) and the pirate's
  record 3 (0, 2, 3). Each was renumbered in order, so a record's frames
  always run 0..n-1.
- **Left out.** `Healer male/Finished/Bonus` (12 loose pictures, not a
  full sheet).
