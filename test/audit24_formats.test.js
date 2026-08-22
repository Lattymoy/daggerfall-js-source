// AUDIT 24 (the full-codebase parity sweep), the two format findings
// whose harnesses live nowhere else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBiog, DEFAULT_BACKSTORIES_START } from '../src/formats/biogFile.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { TextRsc } from '../src/formats/textRsc.js';
import { factionRaceFromRace, raceFromFactionRace } from '../src/characters/staticNpc.js';
import { RACES } from '../src/systems/races.js';

test('audit24 formats: the BIOG # id parses like int.TryParse, all-or-nothing', () => {
  // BiogFile.cs:74 - `if (!int.TryParse(value, out backstoryId))` falls
  // back to defaultBackstoriesStart + classIndex. TryParse rejects the
  // WHOLE string unless it parses cleanly; parseInt takes the leading
  // digits and answers a number for every one of these.
  const biog = (first) => parseBiog(`${first}\nQuestion?\nA\n`, 7);
  assert.equal(biog('#4116').backstoryId, 4116, 'a clean id is taken');
  assert.equal(biog('# 4116 ').backstoryId, 4116, 'NumberStyles.Integer allows surrounding white');
  assert.equal(biog('#-3').backstoryId, -3, 'and a sign');
  const fallback = DEFAULT_BACKSTORIES_START + 7;
  for (const bad of ['#4116abc', '#0x10', '#12.5', '#', '#abc', '#4 116', '#99999999999']) {
    assert.equal(biog(bad).backstoryId, fallback, `${bad} falls back`);
  }
});

test('audit24 formats: a 1-frame weapon-anim record answers (0,0), not undefined', () => {
  // ReadWeaponCif sets only Header.FrameCount over a default
  // ImgFileHeader STRUCT (CifRciFile.cs:456), so Width/Height/XOffset/
  // YOffset are 0 - and GetSize/GetOffset's frameCount <= 1 arms
  // (:223-226, :240-243) hand those zeros back. The port's record
  // carried no such keys, so the arms answered undefined and any
  // arithmetic on them NaN.
  const src = readFileSync(new URL('../src/formats/cifRciFile.js', import.meta.url), 'utf8');
  assert.match(src, /header: \{ frameCount, width: 0, height: 0, xOffset: 0, yOffset: 0 \}/,
    'the mint carries the struct defaults');
  const f = Object.create(CifRciFile.prototype);
  f._records = [{ header: { frameCount: 1, width: 0, height: 0, xOffset: 0, yOffset: 0 } }];
  assert.deepEqual(f.getSize(0), { width: 0, height: 0 });
  assert.deepEqual(f.getOffset(0), { x: 0, y: 0 });
  assert.equal(Number.isNaN(f.getSize(0).width + 1), false, 'and the arithmetic is a number');
});

test('audit24 formats: MapsFile.getRegionIndex is PlayerGPS\'s politic derivation, not the location\'s region', () => {
  // PlayerGPS.CurrentRegionIndex (PlayerGPS.cs:165-186) reads the
  // POLITIC map, which answers on EVERY pixel of the world - the port
  // had been reading currentLocation().regionIndex, which is -1 across
  // the whole wilderness, and getNameBankOfRegion(-1) is Breton. So
  // every quest humanoid named outdoors came out Breton whatever
  // province he stood in.
  const m = Object.create(MapsFile.prototype);
  let politic = 0;
  m.getPoliticIndex = () => politic;

  politic = 128 + 17;
  assert.equal(m.getRegionIndex(0, 0), 17, 'the +128 band is the region');
  politic = 64;
  assert.equal(m.getRegionIndex(0, 0), 31, 'the one exception: 64 is High Rock sea coast');
  politic = 128 + 105;
  assert.equal(m.getRegionIndex(0, 0), 16, 'the known bad value patches to Wrothgarian Mountains');
  politic = 0;
  assert.equal(m.getRegionIndex(0, 0), 0, 'below the band clamps to 0');
  politic = 128 + 62;
  assert.equal(m.getRegionIndex(0, 0), 0, 'and >= 62 clamps to 0');
  politic = 128 + 61;
  assert.equal(m.getRegionIndex(0, 0), 61, '61 is the last real one');
  // NEVER -1: the derivation cannot answer "no region", which is the
  // whole point - the Breton fallback is unreachable through it.
  for (let p = 0; p < 256; p++) {
    politic = p;
    const r = m.getRegionIndex(0, 0);
    assert.ok(r >= 0 && r < 62, `politic ${p} -> ${r} stays in range`);
  }
});

test('audit24 formats: TextRsc.randomTextById is GetRandomText - a FLAT pool, not a variant pick', () => {
  // TextProvider.GetRandomText (:250-268) walks the WHOLE record's
  // tokens, collects every Text one, and picks ONE. It is not
  // GetRandomTokens' variant pick, and it is certainly not "join every
  // line with a space", which is what the talk seam had been doing -
  // %oth read all of a record's oaths in one breath.
  const r = Object.create(TextRsc.prototype);
  //  "one" \n "two" 0xFF(subrecord) "three" 0xFE(end)
  const enc = (s) => [...s].map((c) => c.charCodeAt(0));
  r.bytesById = () => Uint8Array.from([...enc('one'), 0x00, ...enc('two'), 0xff, ...enc('three'), 0xfe]);
  assert.deepEqual([0, 0.34, 0.67, 0.999].map((v) => r.randomTextById(0, () => v)),
    ['one', 'two', 'three', 'three'], 'all three land in ONE pool, across the subrecord break');
  const empty = Object.create(TextRsc.prototype);
  empty.bytesById = () => null;
  assert.equal(empty.randomTextById(0), '', 'a missing record answers the empty string');
  const blank = Object.create(TextRsc.prototype);
  blank.bytesById = () => Uint8Array.from([0xfe]);
  assert.equal(blank.randomTextById(0), '', 'and so does a record with no Text tokens');
});

test('audit24 formats: GetFactionRaceFromRace is not an offset of its inverse', () => {
  // The two enums disagree in ORDER as well as base: Nord is Races 3
  // and FactionRaces 0; DarkElf is Races 4 and FactionRaces 7. Every
  // place the port added a race to a base id without converting was
  // naming a different race.
  assert.equal(factionRaceFromRace(RACES.Nord), 0);
  assert.equal(factionRaceFromRace(RACES.Khajiit), 1);
  assert.equal(factionRaceFromRace(RACES.Redguard), 2);
  assert.equal(factionRaceFromRace(RACES.Breton), 3);
  assert.equal(factionRaceFromRace(RACES.Argonian), 4);
  assert.equal(factionRaceFromRace(RACES.WoodElf), 5);
  assert.equal(factionRaceFromRace(RACES.HighElf), 6);
  assert.equal(factionRaceFromRace(RACES.DarkElf), 7);
  assert.equal(factionRaceFromRace(-1), -1, 'None');
  assert.equal(factionRaceFromRace(9), -1, 'Vampire has no FactionRaces counterpart, nor do 10/11');
  // and it round-trips its inverse on every mapped value
  for (let fr = 0; fr <= 7; fr++) {
    assert.equal(factionRaceFromRace(raceFromFactionRace(fr)), fr, `FactionRaces ${fr} round-trips`);
  }
});
