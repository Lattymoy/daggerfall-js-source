// HARD2 - THE ACTIVATION RACE, ONE HOME (2026-09-14).
//
// The second slice of `01-Overview/Hardening.md`, and the first that
// moves code rather than adding a gate.
//
// WHAT MOVED, AND WHY. DFU fires one ray and the nearest thing it
// strikes is the hit. Deciding WHICH thing that is - the body against
// the pile, the torch against both and the door, and the two rivals
// AUDIT 65 MC-2 split - is pure arithmetic over distances, and it was
// written out by hand in BOTH exterior hosts, character for character.
// AUDIT 66 F7 is what that costs: the torch's line was added to one arm
// of it and compared against the corpse and the pile alone, so a torch
// anywhere under the ray ate the click a shop door at arm's length was
// owed. The law was right in three places and short a term in the
// fourth, in two files at once.
//
// THE RULE THIS SLICE WORKS BY: move composition, never laws. The hosts
// keep their ladders - the ARMS are theirs, because what each does with
// a win differs - and ask `player/activationRace.js` who won. Behaviour
// is identical by construction: the same expressions, in one place.
//
// The proof that it is identical is the four cases AUDIT 63 wrote for
// the body-and-pile decision. That pin used to LIFT the line out of the
// host with `new Function`, because the law lived inline in two hosts
// and there was nothing to import; it now calls the law, with its
// assertions unchanged. A pin getting SIMPLER at an extraction is the
// sign the extraction was real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { raceActivation } from '../src/player/activationRace.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const at = (key, distance, reach = 3.2) => ({ key, distance, reach });

test('HARD2: the body and the pile are decided by DISTANCE, and the tie goes to the body', () => {
  // AUDIT 24 wave 38 + AUDIT 65 MC-2, unchanged - these are the cases
  // audit63_guilds_court.test.js has held since MC-2, now run against
  // the law instead of against a line lifted out of a host.
  const keys = (r) => [r.loot?.key ?? null, r.drop?.key ?? null];
  assert.deepEqual(keys(raceActivation({ corpse: at('foeCorpse:1', 8), pile: at('droppedLoot:2', 1) })), [null, 'droppedLoot:2'],
    'a pile at arm\'s length beats a body across the room');
  assert.deepEqual(keys(raceActivation({ corpse: at('foeCorpse:1', 1), pile: at('droppedLoot:2', 8) })), ['foeCorpse:1', null],
    'and the nearer body beats the pile');
  assert.deepEqual(keys(raceActivation({ pile: at('droppedLoot:2', 8) })), [null, 'droppedLoot:2'], 'with no body, the pile is the hit');
  assert.deepEqual(keys(raceActivation({ corpse: at('foeCorpse:1', 8) })), ['foeCorpse:1', null], 'and with no pile, the body');
  assert.deepEqual(keys(raceActivation({ corpse: at('foeCorpse:1', 4), pile: at('droppedLoot:2', 4) })), ['foeCorpse:1', null],
    'the TIE goes to the body - the pre-MC-2 precedence, which DFU cannot contradict because one ray has one hit');
  assert.deepEqual(keys(raceActivation()), [null, null], 'and an empty ray decides nothing');
});

test('HARD2: the two rivals are SPLIT - the person arm never measures against the persons, the foe arm measures against everything', () => {
  // AUDIT 65 MC-2's split. The regex this replaces (`_rivalDist =
  // Math.min(_nonPersonRival, ..._livePersons.map(`) passed the moment
  // the expression was reformatted, whatever it then computed.
  const r = raceActivation({
    corpse: at('foeCorpse:1', 9), pile: at('droppedLoot:2', 7), torch: at('droppedTorch:3', 5),
    doorDistance: 11, personDistances: [3, 40],
  });
  assert.equal(r.nonPersonRival, 5, 'the nearest thing that is not a person - here the torch');
  assert.equal(r.rival, 3, 'and the foe must beat the townsfolk too');
  assert.equal(raceActivation({ personDistances: [3] }).nonPersonRival, Infinity, 'nothing on the ground: the person arm has no rival');
  assert.equal(raceActivation({ personDistances: [3] }).rival, 3, '...and the foe arm still has one');
  assert.equal(raceActivation({}).rival, Infinity, 'an empty ray refuses nothing');
  assert.equal(raceActivation({ doorDistance: 2, personDistances: [] }).nonPersonRival, 2, 'the door counts as ground');
});

test('HARD2: the torch takes the click only when nothing on the ground AND no door is nearer (AUDIT 66 F7, as a law)', () => {
  const torch = at('droppedTorch:1', 5);
  assert.equal(raceActivation({ torch }).torchWins, true, 'alone under the ray, it wins');
  assert.equal(raceActivation({ torch, doorDistance: 2 }).torchWins, false, 'a nearer door takes it - the finding itself');
  assert.equal(raceActivation({ torch, pile: at('droppedLoot:2', 2) }).torchWins, false, 'so does a nearer pile');
  assert.equal(raceActivation({ torch, corpse: at('foeCorpse:2', 2) }).torchWins, false, 'and a nearer body');
  assert.equal(raceActivation({ torch, doorDistance: 5 }).torchWins, true, 'a tie goes to the torch, as the arm above the door reads it');
  assert.equal(raceActivation({ torch: null, doorDistance: 99 }).torchWins, false, 'and no torch never wins');
  // the winner's REACH is the arm's business, not the race's: every
  // handler family in this port answers "You are too far away" rather
  // than dropping the click (MC-2), so the race hands over an
  // out-of-reach winner on purpose.
  assert.equal(raceActivation({ torch: at('droppedTorch:1', 60) }).torchWins, true, 'a winner out of reach is still the winner, and its arm refuses out loud');
});

test('HARD2: the extraction is EQUIVALENT - the law the hosts used to write out, over every input, agrees', () => {
  // AUDIT-HARD put this in the tree. The extraction's proof was a
  // differential run in a scratchpad and quoted in a commit message,
  // which is a proof nobody can re-run - and this port's whole doctrine
  // is that the evidence is checkable. So the OLD arithmetic lives here,
  // lifted character for character out of world.js at d784ecd~1, and the
  // two are made to agree on every combination of the inputs that can
  // reach them. Change `activationRace.js` and this says whether the law
  // moved or only the code did.
  const old = (corpse, pile, torch, doorDist, persons) => {
    const _pileNearer = !!pile && !(corpse && corpse.distance <= pile.distance);
    const _lootPick = _pileNearer ? null : corpse, _dropPick = _pileNearer ? pile : null;
    const _nonPersonRival = Math.min(
      _lootPick?.distance ?? Infinity,
      _dropPick?.distance ?? Infinity,
      torch?.distance ?? Infinity,
      doorDist,
    );
    return {
      loot: _lootPick, drop: _dropPick,
      torchWins: !!torch && torch.distance <= Math.min(_lootPick?.distance ?? Infinity, _dropPick?.distance ?? Infinity, doorDist),
      nonPersonRival: _nonPersonRival,
      rival: Math.min(_nonPersonRival, ...persons),
    };
  };
  // 0 and Infinity for the edges; 3.2 and 3.3 straddle the reach, which
  // is where MC-2's "a winner out of reach still answers" lives; the
  // person lists cover none, one, a tie, and one that never wins.
  const D = [null, 0, 0.5, 1, 3.2, 3.3, 8, 76.8, Infinity];
  const PERSONS = [[], [3], [0.5, 40], [Infinity], [3.2, 3.2]];
  let n = 0;
  const differ = [];
  for (const c of D) for (const pl of D) for (const t of D) for (const dd of D) for (const ps of PERSONS) {
    const corpse = c === null ? null : at('foeCorpse:1', c);
    const pile = pl === null ? null : at('droppedLoot:2', pl);
    const torch = t === null ? null : at('droppedTorch:3', t);
    const door = dd === null ? Infinity : dd;
    const a = old(corpse, pile, torch, door, ps);
    const b = raceActivation({ corpse, pile, torch, doorDistance: door, personDistances: ps });
    n += 1;
    const same = (a.loot?.key ?? null) === (b.loot?.key ?? null) && (a.drop?.key ?? null) === (b.drop?.key ?? null)
      && a.torchWins === b.torchWins && Object.is(a.nonPersonRival, b.nonPersonRival) && Object.is(a.rival, b.rival);
    if (!same && differ.length < 5) differ.push({ in: [c, pl, t, dd, ps], old: a, now: b });
  }
  assert.equal(n, 32805, 'the whole input domain, so a narrowed one cannot make this pass by covering less');
  assert.deepEqual(differ, [], 'the extracted law disagrees with the one the hosts used to write out');
});

test('HARD2: both exterior hosts ask the ONE race and hand-roll none of it, and no other host grew a second copy', () => {
  const HOSTS = ['src/scenes/world.js', 'src/scenes/exterior.js'];
  for (const host of HOSTS) {
    const src = read(host);
    assert.match(src, /import \{ raceActivation \} from '\.\.\/player\/activationRace\.js';/, `${host}: imports the law`);
    assert.match(src, /const _race = raceActivation\(\{\s*\n\s*corpse: _corpsePick,\s*\n\s*pile: _pilePick,\s*\n\s*torch: _torchPick,\s*\n\s*wagon: _wagonPick,\s*\n\s*doorDistance: modes\.exteriorActivationDistance\(cam\.pos, useFwd\),\s*\n\s*personDistances: _livePersons\.map\(\(p\) => rayPersonDistance\(cam\.pos, useFwd, p\.pos\)\),\s*\n\s*\}\);/, `${host}: and feeds it every family the ray can strike`);
    for (const [name, re] of [['the body and the pile', /const _lootPick = _race\.loot, _dropPick = _race\.drop;/],
      ['the person arm\'s rival', /const _nonPersonRival = _race\.nonPersonRival;/],
      ['the foe arm\'s rival', /const _rivalDist = _race\.rival;/],
      ['the torch', /const _torchNearest = _race\.torchWins;/]]) {
      assert.match(src, re, `${host}: ${name} comes off the race`);
    }
    // ...and nothing of the race is written out here any more. These
    // are the exact shapes the two copies used to carry.
    assert.doesNotMatch(src, /const _pileNearer =/, `${host}: the body/pile decision is not re-inlined`);
    assert.doesNotMatch(src, /_torchPick\?\.distance \?\? Infinity/, `${host}: nor the torch's term`);
    assert.doesNotMatch(src, /Math\.min\(_nonPersonRival/, `${host}: nor the rival's composition`);
  }
  // The gate's other half: a THIRD copy must not appear. A host that
  // picks more than one activatable family is racing them, and the race
  // has one home. (The interior and dungeon hosts pick ONE merged target
  // list and pass that single pick's distance as the rival, which is the
  // same law arriving by a different road - AUDIT 63 pins that shape.)
  //
  // The SIGNATURE of a hand-rolled race is a `Math.min(` composing two
  // or more picks' distances. A single pick's distance handed to an arm
  // as its rival is NOT that - it is the merged-list road, where the one
  // pick already IS the ray's nearest hit, and AUDIT 63 pins that shape
  // in the interior and dungeon ladders. Counting `?.distance` alone
  // confuses the two, which this gate did on its first run.
  const RACERS = new Set(HOSTS);
  const grew = [];
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/dungeon.js', 'src/scenes/interiorContext.js', 'src/scenes/interior.js']) {
    for (const m of read(host).matchAll(/Math\.min\(([^;]{0,400}?)\)/g)) {
      const terms = (m[1].match(/\?\.distance/g) ?? []).length;
      if (terms > 1 && !RACERS.has(host)) grew.push(`${host}: a Math.min over ${terms} picks' distances - race them through player/activationRace.js`);
    }
  }
  assert.deepEqual(grew, [], 'a host has grown its own copy of the race');
});
