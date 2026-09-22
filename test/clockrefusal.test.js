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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceWorldMinutes, worldClockAdvances, setWorldMinutes, setSharedClock, worldMinutes } from '../src/systems/worldTick.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

test('CLOCK-REFUSAL: every caller that moves the world clock consults the refusal, or is named with its reason', () => {
  // THE EXEMPTIONS, each with why it does not need to ask. EMPTY, and
  // that is the finding: the first draft of this pin exempted
  // `scenes/shared.js` as "the raiseTime seam, not a caller that means
  // elapsed time" - and the pin's own staleness check answered back
  // that shared.js already consults `sharedClockOn`. Every caller
  // listens today, so the law stands with nothing excused from it,
  // which is the strongest shape it can have.
  const EXEMPT = {};

  const callers = new Map();
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { walk(rel); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = readFileSync(join(ROOT, rel), 'utf8');
      if (/\badvanceWorldMinutes\s*\(/.test(src) && !/export function advanceWorldMinutes/.test(src)) {
        callers.set(rel, src);
      }
    }
  };
  walk('src');
  assert.ok(callers.size >= 2, `the seam still has callers (${callers.size})`);

  const deaf = [...callers.entries()]
    // A caller is listening if it asks the refusal by either name - the
    // predicate, or `sharedClockOn`, which is the same question from
    // the other side and is what arrestFlow already branches on.
    .filter(([rel, src]) => !/worldClockAdvances\s*\(|sharedClockOn\s*\(/.test(src))
    .map(([rel]) => rel)
    .filter((rel) => !(rel in EXEMPT));
  assert.deepEqual(deaf, [],
    'a caller that means elapsed time and never asks whether it elapsed is the prison-release bug again');

  // ...and an exemption that starts asking should leave the list.
  const stale = Object.keys(EXEMPT).filter((rel) => {
    const src = callers.get(rel);
    return src && /worldClockAdvances\s*\(|sharedClockOn\s*\(/.test(src);
  });
  assert.deepEqual(stale, [], 'an exemption that now consults the refusal should be deleted');
  // an exemption for a file that no longer calls it is dead weight
  const orphan = Object.keys(EXEMPT).filter((rel) => !callers.has(rel));
  assert.deepEqual(orphan, [], 'an exemption for a non-caller is dead weight');
});

test('CLOCK-REFUSAL: the prison release, the one that paid for this, still branches on it', () => {
  // DEATHLOOP1 fixed the consequence; this holds the SHAPE, so the
  // branch cannot be flattened back into a single unconditional call.
  const arrest = readFileSync(join(ROOT, 'src/scenes/arrestFlow.js'), 'utf8');
  assert.match(arrest, /if \(!sharedClockOn\(\)\) fillVitalSigns\(playerEntity\);\n\s*else reviveForPlay\(playerEntity\);/,
    'offline refills, online floors - because online the days it just asked for did not pass');
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
  const { CAMP_TEXT } = await import('../src/systems/survival/camp.js');
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
