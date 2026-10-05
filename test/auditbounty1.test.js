// AUDIT BOUNTY1 (2026-09-28, Mac: "Continue, I also want to fit these in since they're specifically made for our
// codebase") - the bounty boards and the online death penalty, taken in from the two archives Mac handed over and read
// line by line against this tree (`06-Systems/Bounty-Boards.md` 9, the integration's findings). B1-B4 are one pin
// per finding paid, each failing on the archive's own code; B5 pins the wiring the findings rest on. Host slices are MOUNTED from comment-stripped source where they can be
// run (the suite's precedent: auditpscale1's camp stand), matched where they are wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partyGroupMembers } from '../src/systems/partyScale.js';
import { PACK_SPACING, PACK_ALERT_RADIUS } from '../src/systems/campEncounters.js';
import { BOUNTY_MIN_PX, BOUNTY_MAX_PX, bountyItemRule } from '../src/systems/bountyBoard.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };
/** The balanced `open`..`close` run starting at the first `open` at or after `from`. */
function balanced(text, from, open = '(', close = ')') {
  let depth = 0;
  for (let i = text.indexOf(open, from); i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(from, i + 1);
  }
  throw new Error('unbalanced');
}
/** The world host's camp stand, mounted over the given scope. */
function campStand(scope) {
  const t = strip(read('src/scenes/world.js'));
  const at = t.indexOf('const _standCampEncounter = (hit, feet) => {');
  assert.ok(at > 0, 'the camp stand is found');
  const fn = balanced(t, at + 'const _standCampEncounter = '.length, '{', '}');
  return mount('', scope, `return (hit, feet) => ${fn.slice(fn.indexOf('{'))};`);
}

test('AUDIT BOUNTY1 B1: the payday notice waits for EVERY window - the street slot and the interior and dungeon stacks (the archive asked townTalk alone, so a mate\'s clear stood the notice over an open shop or the pack indoors)', () => {
  const w = strip(read('src/scenes/world.js'));
  const at = w.indexOf('showNotice: (notice) => {');
  assert.ok(at > 0, 'the host hands the bounty host its notice door');
  const door = w.slice(at, w.indexOf('\n    },', at));
  assert.match(door, /if \(\(townTalk\.overlayActive && !townTalk\.overlayDone\) \|\| \(modes\?\.overlayHeld \?\? false\) \|\| \(modes\?\.deathUp\?\.\(\) \?\? false\)\) return false;/,
    'the modal stacks hold it too - `modes.overlayHeld`, the host\'s own gamePaused half');
});

test('AUDIT BOUNTY1 B2: ONE STAND FOR A GROUP IN THE WILDERNESS - the bounty pack stands through the camp\'s own stand, fixed at the posting\'s count, loose and transient (the archive copied the stand, so CAMP-SIGHT and PSCALE1 COUNT-3 read two stands)', async () => {
  const w = strip(read('src/scenes/world.js'));
  const at = w.indexOf('const _standBountyPack = (');
  const pack = w.slice(at, w.indexOf('\n  };', at));
  assert.match(pack, /const stood = _standCampEncounter\(\{\s*mobileTypes: Array\(count\)\.fill\(mobileType\), fixed: true, spacing: PACK_SPACING, alertRadius: PACK_ALERT_RADIUS,/,
    'the camp\'s stand, one beast `count` times, never grown');
  assert.match(pack, /spawnOpts: \{ loose: true, transient: true \}/, 'uncapped and never saved');
  assert.doesNotMatch(pack, /placeFoeFreely|placeFoeEnv|sightRadius/, 'no second copy of the member law');
  assert.equal((w.match(/placeFoeFreely\(memberEnv,/g) ?? []).length, 1, 'the camp\'s members are placed in one place');

  // mounted: a party of eight grows a camp and leaves a bounty's pack at its count, and the stand answers what it stood
  const stood = [];
  const stand = campStand({
    placeFoeEnv: () => ({}), collider: {}, cam: { yaw: 0 }, fieldOfView: () => 1, entityOccupancy: () => () => false, _placingPool: () => [],
    campAnchorSpot: () => ({ x: 20, y: 0, z: 0 }), LOOSE_FOE_PLACE_ATTEMPTS: 1, placeFoeFreely: () => ({ x: 1, y: 0, z: 1 }),
    _inAnyLocationRect: () => false, _nearRoad: () => false, _overDeepWater: () => false, _inRock: () => false, CAMP_ROAD_CLEAR_M: 4,   // BOUNTY-ROCK: no rock here
    // MERGE 2: main's OW6 - the growth one home (`campMembers`, bounded by the pool) and the camp ids the pool's one counter
    campMembers: (types) => partyGroupMembers(types, 8).slice(0, 8), ENEMY_BASICS: {}, CAMP_SIGHT_RADIUS: 60,
    exteriorFoes: { newCampId: (() => { let n = 1; return () => n++; })(), spawnFoe: (mobileType, at, opts) => { stood.push([mobileType, opts]); return Promise.resolve({ ai: {}, entity: {} }); } },
  });
  const camp = stand({ mobileTypes: [10, 11, 12], minDistance: 14, maxDistance: 26, spacing: 3, alertRadius: 9 }, [0, 0, 0]);
  assert.ok(stood.length > 3, 'a camp grows with the party it meets (PSCALE1)');
  assert.equal(stood[0][1].loose, undefined, 'and a camp is capped as ever');
  stood.length = 0;
  const bounty = stand({ mobileTypes: [4, 4, 4, 4, 4], fixed: true, spacing: PACK_SPACING, alertRadius: PACK_ALERT_RADIUS, minDistance: 60, maxDistance: 110, bearingDegrees: 90, spawnOpts: { loose: true, transient: true } }, [0, 0, 0]);
  assert.deepEqual(stood.map(([t]) => t), [4, 4, 4, 4, 4], 'the posting\'s five, not grown by the party of eight');
  assert.ok(stood.every(([, o]) => o.loose === true && o.transient === true && Number.isFinite(o.yaw)), 'each loose and transient, and still facing the anchor');
  const foes = await bounty.foes;
  assert.equal(foes.length, 5, 'the stand answers what it stood');
  const id = foes[0].campId;
  assert.equal(id, 2, 'its own camp id, the next after the camp\'s');
  assert.ok(foes.every((f) => f.campId === id && f.campAlertRadius === PACK_ALERT_RADIUS && f.ai.sightRadius === 60 && f.entity.campId === id),
    'one camp id, the pack\'s shout, a camp\'s sight - the camp\'s own tags');
  assert.deepEqual(bounty.anchorFeet, [20, 0, 0], 'and where its anchor stands, for the host\'s line');
  assert.ok(camp && Array.isArray(camp.anchorFeet), 'the roll\'s own callers may ignore the answer');
});

test('AUDIT BOUNTY1 B3: the archive\'s words that no longer said the law - the ring and the blue - read as the constants do', () => {
  assert.deepEqual([BOUNTY_MIN_PX, BOUNTY_MAX_PX], [4, 10]);
  assert.equal(bountyItemRule(4).magicChance, 0.5, 'blue from level 4');
  const board = read('src/systems/bountyBoard.js');
  assert.doesNotMatch(board, /one to four|1 to 4 pixels|from level 11/, 'bountyBoard.js: no comment still says 1-4 pixels or blue from 11');
  assert.match(board, /a map pixel four to ten pixels from the town/);
  assert.doesNotMatch(read('src/systems/bountyReward.js'), /from level 11/, 'bountyReward.js: nor the piece\'s header');
});

test('AUDIT BOUNTY1 B4: the relay pins say who moved it - BOUNTY1 + AUDIT 28 (world131 since MERGE 2; world125 at the merge of main; world122 and world123 on the branch), then REALM-DOOR (world130); STRIKE-SHARED moved it on after (world132), SOFTCAP1 after it (world133), PARTY-MAP after SOFTCAP1 (world134), WB9 after PARTY-MAP (world135), GATE-UX after WB9 (world136), KEPT-KILL after GATE-UX (world137), HERALD after KEPT-KILL (world138), LOOT7 after HERALD (world139), WB11 after LOOT7 (world140), CLIMB5 and CLIMB6 after WB11 (world141), FRIENDS-SYNC after CLIMB5 and CLIMB6 (world142), ELITE FOES after FRIENDS-SYNC (world143), SEAT1b after ELITE FOES (world144), SEAT1c after SEAT1b (world145), PVP-REF after SEAT1c (world146), SEAT2a after PVP-REF (world147), CROWN1 part two after SEAT2a (world148), SEASON1 part two, the banner ribbon after CROWN1 part two (world149), SEAT2b part two (b) after the banner ribbon (world150), and WB12 after SEAT2b part two (b) (world151), REVENANT-WIRE after WB12 (world152), and ARENA4 after BROKER-CAGE (world155 - world142 on its branch, renumbered past main\'s FRIENDS-SYNC to BROKER-CAGE at the merge), and HOTFIX 1003f after ARENA4 (world156), and AEGIS after the DFO integration\'s world157-world159 (world160), GUILD2 after AEGIS (world161) and PRIMARCH after GUILD2 (world162), and SUNBABY1 after PRIMARCH (world163)', () => {
  for (const f of ['test/soc1_hub.test.js', 'test/allycast.test.js', 'test/guild1c.test.js', 'test/renown1.test.js']) {
    const t = read(f);
    assert.ok(t.includes("RELAY_VERSION, 'world169'"), `${f}: the pin is on world169`);
    assert.ok(/AUDIT ARENA-LADDER moved it on last \(world169[^\n]*SERAPH-WINGS moved it on \(world168[^\n]*SHADOW-CLOAK moved it on \(world167[^\n]*SERPENT2 moved it on \(world166[^\n]*SERPENT1 moved it on \(world165[^\n]*PARTY-LEAD moved it on \(world164[^\n]*SUNBABY1 moved it on \(world163[^\n]*PRIMARCH moved it on \(world162[^\n]*GUILD2 moved it on \(world161[^\n]*AEGIS moved it on \(world160[^\n]*ARENA4 moved it on \(world155[^\n]*BROKER-CAGE moved it on \(world154[^\n]*REVENANT-WIRE moved it on \(world153[^\n]*GLYPH-WEAR moved it on \(world152[^\n]*WB12 moved it on \(world151[^\n]*SEAT2b part two \(b\) moved it on \(world150[^\n]*SEASON1 part two, the banner ribbon moved it on \(world149[^\n]*CROWN1 part two moved it on \(world148[^\n]*SEAT2a moved it on \(world147[^\n]*PVP-REF moved it on \(world146[^\n]*SEAT1c moved it on \(world145[^\n]*SEAT1b moved it on \(world144[^\n]*ELITE FOES moved it on \(world143[^\n]*FRIENDS-SYNC moved it on \(world142[^\n]*CLIMB5 and CLIMB6 moved it on \(world141[^\n]*WB11 moved it on \(world140[^\n]*LOOT7 moved it on \(world139[^\n]*HERALD moved it on \(world138[^\n]*KEPT-KILL moved it on \(world137[^\n]*GATE-UX moved it on \(world136[^\n]*WB9 moved it on \(world135[^\n]*PARTY-MAP moved it on \(world134[^\n]*SOFTCAP1 moved it on \(world133[^\n]*STRIKE-SHARED moved it on \(world132[^\n]*MERGE 2 moved it on \(world131: the professions branch, BOUNTY1 \+ AUDIT 28[^\n]*REALM-DOOR moved it on \(world130/.test(t), `${f}: crediting BOUNTY1 + AUDIT 28, then REALM-DOOR`);
    assert.ok(!/world13[01][^\n]*REALM-DOOR moved it on last/.test(t), `${f}: and does not still credit REALM-DOOR with the move`);
  }
});

test('AUDIT BOUNTY1 B5: the board\'s press and its plaque ride the streaming host alone; the fixed city and the standalone dungeon keep DFU\'s board', () => {
  const m = read('src/scenes/worldModes.js');
  assert.match(m, /if \(aabb\.bounty && openBountyBoard\?\.\(aabb\.bounty\)\) return;/, 'a bounty board\'s press opens the window, before the rumour');
  assert.match(m, /BOUNTY_BOARD_TEXT : BULLETIN_BOARD_TEXT/, 'and names itself on hover');
  const w = read('src/scenes/world.js');
  assert.match(w, /openBountyBoard: \(town\) => bountyHost\?\.openBoard\(town\) \?\? false,/, 'the streaming host hands the press to the bounty host');
  assert.match(w, /\.\.\.\(bountyAt\.has\(i\) \? \{ bounty: \{ px: p\.px, py: p\.py, name: p\.location \} \} : \{\}\),/, 'and marks the half of the boards that post bounties');
  for (const f of ['src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(f), /bountyHost|openBountyBoard/, `${f}: no bounty board`);
});
