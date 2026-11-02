// CLOCK-REFUSAL (2026-09-22) - THE NO-OP NOBODY COULD SEE.
//
// `advanceWorldMinutes` is refused under the shared clock (WORLD5: the
// world's time is not this player's to move) and it answers a NUMBER
// either way - the shared minute when it refuses, the new minute when
// it moves. So a caller that MEANS the passage of time gets a
// plausible answer back and cannot tell that nothing happened.
//
// THAT HAS ALREADY COST ONE BUG, and it is the reason this file
// exists rather than a comment: DEATHLOOP1's second half was the
// prison release asking for the sentence's days, getting a number, and
// letting the player out at the health they walked in with - which for
// trashBattery, arrested while dying of a fall, was dead, straight
// into a deathloop he had to force-kill the process to escape.
//
// So the law: every caller that asks the world clock to move either
// CONSULTS the refusal or is listed below with the reason it does not
// have to. The list may shrink and never grow silently - a new caller
// fails here.
//
// LIVED1 (2026-09-29) removed the trap at its root: a caller that MEANS
// the passage of time - a sentence, a turn, a cure, a quest's RaiseTime -
// moves the CHARACTER's own clock (worldTick.js advanceOwnMinutes), which
// is theirs online and the one clock offline, and is never refused. No
// caller asks the world's clock to move any more; the refusal stands for
// anything that ever does, and this file holds both halves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceWorldMinutes, worldClockAdvances, setWorldMinutes, setSharedClock, worldMinutes, advanceOwnMinutes, ownMinutes, setOwnMinutes } from '../../src/systems/worldTick.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('CLOCK-REFUSAL: the refusal is askable, and it answers the truth on both sides', () => {
  setSharedClock(null);
  setWorldMinutes(1000);
  assert.equal(worldClockAdvances(), true, 'offline the clock is this player\'s to move');
  advanceWorldMinutes(60);
  assert.equal(worldMinutes(), 1060, 'and it moves');

  // Online: the shared clock stands, the request is dropped, and the
  // answer is still a perfectly plausible number - which is the whole
  // trap.
  setSharedClock(() => 5000);
  assert.equal(worldClockAdvances(), false, 'online it is nobody\'s to move');
  const answered = advanceWorldMinutes(60);
  assert.equal(answered, 5000, 'the answer looks like a clock reading, not a refusal');
  assert.notEqual(answered, 5060, 'and the hours asked for did NOT pass');
  setSharedClock(null);
});

test('CLOCK-REFUSAL (LIVED1): the passage of time is the character\'s and is never refused - online it moves their own clock and not the world\'s, offline the one clock', () => {
  setSharedClock(null);
  setWorldMinutes(1000);
  assert.equal(advanceOwnMinutes(60), 1060, 'offline: the one clock moves');
  assert.equal(worldMinutes(), 1060);
  let world = 5000;
  setSharedClock(() => world);
  setOwnMinutes(4000);
  assert.equal(advanceOwnMinutes(60), 4060, 'online: the character\'s clock takes the hour');
  assert.equal(ownMinutes(), 4060);
  assert.equal(worldMinutes(), 5000, 'and the world\'s does not');
  world += 5;
  assert.equal(ownMinutes(), 4060, 'the character\'s clock moves in a tick, not by reading the world\'s');
  setSharedClock(null);
});

test('CLOCK-REFUSAL (LIVED1): no caller asks the world clock to move - every caller that means elapsed time moves the character\'s own clock, which answers the truth on both sides', () => {
  const callers = (re) => {
    const out = new Map();
    const walk = (dir) => {
      for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) { walk(rel); continue; }
        if (!e.name.endsWith('.js')) continue;
        const src = readFileSync(join(ROOT, rel), 'utf8');
        if (re.test(src)) out.set(rel, src);
      }
    };
    walk('src');
    return out;
  };
  const world = [...callers(/\badvanceWorldMinutes\s*\(/).keys()].filter((rel) => rel !== 'src/systems/worldTick.js');
  assert.deepEqual(world, [], 'a caller that means elapsed time and asks the WORLD for it is the prison-release bug again');
  const own = [...callers(/\badvanceOwnMinutes\s*\(/).keys()].filter((rel) => rel !== 'src/systems/worldTick.js').sort();
  assert.deepEqual(own, ['src/scenes/arrestFlow.js', 'src/scenes/dungeonContext.js', 'src/scenes/shared.js', 'src/scenes/world.js'], 'the sentence, the turn\'s fortnight, the cures, a quest\'s RaiseTime - and TIME3: the dungeon\'s rest and collapse, raises counted like the rest');
});

test('CLOCK-REFUSAL: the prison release, the one that paid for this - LIVED1: its days are the prisoner\'s own, served online too, so it refills in both lanes', () => {
  // DEATHLOOP1 fixed the consequence of a refused sentence; LIVED1 serves it
  const arrest = readFileSync(join(ROOT, 'src/scenes/arrestFlow.js'), 'utf8');
  assert.match(arrest, /advanceDays = \(days\) => advanceOwnMinutes\(days \* MINUTES_PER_DAY\),/, 'the days are the prisoner\'s own');
  assert.match(arrest, /playerEntity\.inPrison = false;\s*(?:\/\/[^\n]*\n\s*)*fillVitalSigns\(playerEntity\);/, 'and the refill is their price, in both lanes');
});

// ── CAMP-SILENT: USING AN ITEM ALWAYS SAYS SOMETHING ─────────────
//
// DragynDance on Discord (2026-09-22): "camp kits don't work for me."
// Filed here rather than in its own file because it is the same fault
// as the clock's: a refusal the caller - and in this case the PLAYER -
// cannot see. Every other arm of the camp placement refuses with
// words (in town, indoors, foes near, no ground, worn out, too many);
// one returned false with none, so a player whose host could not
// answer for the ground got an item that did nothing and no reason.
// "Doesn't work" was all they could tell us, because it was all the
// game told them.
test('CAMP-SILENT: no arm of the camp placement refuses without words', async () => {
  const { CAMP_TEXT } = await import('../../src/systems/survival/camp.js');
  assert.equal(typeof CAMP_TEXT.noSpot, 'string');
  assert.ok(CAMP_TEXT.noSpot.length > 0, 'the last silent arm has words now');

  const src = readFileSync(join(ROOT, 'src/scenes/camps.js'), 'utf8');
  const fn = src.slice(src.indexOf('function placeItem('));
  const body = fn.slice(0, fn.indexOf('\n  }\n'));

  // THE LAW, read off the code rather than off this one arm: inside
  // the placement, no `return false` is reached without words - either
  // on its own line or on the line just above it, which is where the
  // shared arm's `if (r.text) say(r.text);` sits. The first draft of
  // this pin read ONE line and blamed that shared arm, which speaks
  // perfectly well; a refusal is an arm, not a line.
  const lines = body.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
  const silent = lines.filter((l, i) => /return false;/.test(l) && !/say\(/.test(l) && !/say\(/.test(lines[i - 1] ?? ''));
  assert.deepEqual(silent.map((l) => l.trim()), [],
    'a refusal with no words is indistinguishable from a broken item');

  // ...and the shared arm's words can only be absent for an item that
  // is not camping gear at all, which never reaches this door: every
  // OTHER refusal in the decision carries its own text.
  const campSrc = readFileSync(join(ROOT, 'src/systems/survival/camp.js'), 'utf8');
  const textless = [...campSrc.matchAll(/return \{ ok: false, text: ([^,}]+)[,}]/g)].map((m) => m[1].trim());
  assert.deepEqual(textless.filter((t) => t === 'null').length, 1,
    'exactly one textless refusal - the not-camping-gear guard');

  // and the one that paid for it says so by name
  assert.match(body, /if \(!cam\?\.feet\) \{ say\(CAMP_TEXT\.noSpot\); return false; \}/);
});
