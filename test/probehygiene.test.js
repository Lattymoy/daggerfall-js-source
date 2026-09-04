// T2: THE PROBES' OWN HYGIENE.
//
// A probe that lies is worse than no probe. tools/tradeModeProbe.mjs
// spent its whole life reporting "the commit did not charge" against a
// game that charged correctly, because it booted the exterior host
// WITHOUT a class parameter - so the chargen wizard mounted, took
// townTalk's overlay slot, and townTalk.keydown (first in that host's
// keydown ladder, exterior.js:1955-1957) swallowed every
// page.keyboard.press the probe made. Staging passed, the offer box
// appeared, and the Yes never arrived, which reads exactly like a
// broken commit.
//
// It was not one probe. The sweep that found it found FIFTEEN, among
// them bankProbe (five digits typed into a character-creation screen)
// and tavernProbe and guildServiceProbe with seven presses each. The
// trap had already cost X11c an afternoon at the other end of the same
// seam. This file is the guard so it cannot come back a fourth time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const TOOLS = 'tools';

/** The two probes that drive the wizard ON PURPOSE - for them, a
 *  headless-chargen skip would remove the thing under test. */
const DRIVES_CHARGEN = new Set([
  'chargenProbe.mjs', 'customClassProbe.mjs', 'chargenClickProbe.mjs',
  // T2's sweep found these two the hard way: both READ __chargenFlow(),
  // so a headless skip does not just make them redundant, it makes them
  // hang - audit17mProbe timed out at its waitForFunction the moment
  // class=16 was added. The membership test below is what tells the two
  // kinds apart mechanically rather than by name.
  'audit17mProbe.mjs', 'specialAdvProbe.mjs', 'dungeonChargenProbe.mjs',
]);

const probes = readdirSync(TOOLS).filter((n) => n.endsWith('.mjs'))
  .map((f) => ({ f, src: readFileSync(`${TOOLS}/${f}`, 'utf8') }));

/** Every literal URL a probe navigates to. Probes that build their URL
 *  from a table are read whole instead - the class param has to be in
 *  the file either way. */
const gotoUrls = (src) => [...src.matchAll(/page\.goto\(\s*[`']([^`']*)[`']/g)].map((m) => m[1]);

/** The hosts that mount the chargen wizard when the entity has not
 *  been made: the exterior page and the streaming world page
 *  (exterior.js:966-976 and world.js's copy of the same fork). The
 *  standalone dungeon route runs its own wizard through a different
 *  slot and is covered by the same rule. */
const MOUNTS_CHARGEN = /exterior|world|nomenu|shot/;

test('T2: no probe types into a chargen wizard it never knew was up', () => {
  const offenders = [];
  for (const { f, src } of probes) {
    if (DRIVES_CHARGEN.has(f)) continue;
    const presses = (src.match(/page\.keyboard\.(press|type|down|insertText)\(/g) ?? []).length;
    if (!presses) continue;                       // no keys, no trap
    const urls = gotoUrls(src);
    if (!urls.length) continue;                   // builds its URL elsewhere
    if (!urls.some((u) => MOUNTS_CHARGEN.test(u))) continue;
    // the skip can be in the URL itself or in the table the URL is
    // built from, so the whole file is the haystack
    if (/[?&]class=/.test(src)) continue;
    offenders.push(`${f} (${presses} key presses, no class= anywhere)`);
  }
  assert.deepEqual(offenders, [],
    'these probes press keys into a host that mounts the chargen wizard, with no headless-chargen skip - '
    + 'the wizard holds the overlay slot and every press is swallowed');
});

test('T2: the probes that DO drive the wizard still drive it', () => {
  // The allowlist above is only honest while its members really are
  // chargen probes. If one of them grows a class= skip it has stopped
  // being one, and it belongs under the rule rather than beside it.
  for (const f of DRIVES_CHARGEN) {
    const p = probes.find((x) => x.f === f);
    if (!p) continue;                             // deleted is fine; stale allowlist is not a failure
    assert.ok(!/[?&]class=1?[0-9]/.test(p.src),
      `${f} is on the chargen allowlist but skips chargen - take it off the list`);
    // ...and it must actually TOUCH the wizard. A probe parked here to
    // silence the rule, rather than because it drives chargen, is the
    // way this gate would rot.
    assert.match(p.src, /__chargen(Flow|Race|Confirm)|chargenDone/,
      `${f} is on the chargen allowlist but never reads the wizard`);
  }
});

test('T2: tradeModeProbe walks BOTH proceeds arms, not just the one its purse allowed', () => {
  // The second lie in the same file: it stuffed 500,000 gold into the
  // purse, which at 0.0025 kg/piece is 1250 kg against a
  // MaxEncumbrance near 90 - so every sale correctly took
  // ConfirmTrade's letter-of-credit branch and the probe asserted
  // coins. Both arms are deliberate now, and the probe reads the
  // window's OWN weighing rather than recomputing it.
  const src = readFileSync(`${TOOLS}/tradeModeProbe.mjs`, 'utf8');
  assert.ok(src.includes('weighing()'), 'the probe no longer reads the window\'s weighing');
  assert.ok(/the COIN arm is unreachable/.test(src), 'the coin sale does not check that it IS the coin arm');
  assert.ok(/the LETTER arm is unreachable/.test(src), 'the overloaded sale does not check that it IS the letter arm');
  assert.ok(src.includes('minted in silence'), 'the probe does not check the letter is ANNOUNCED');
});

// ── T3: THE PROBES THAT CANNOT FAIL ──────────────────────────────
//
// T2 caught guildServiceProbe printing "OK" and exiting 0 on a run
// where its character had been turned away at the Mages Guild door and
// no service ran at all. That is the same disease as a probe that
// lies, one step further along: a probe whose exit code has nothing to
// do with whether its subject worked.
//
// THE SURVEY THAT FOUND THE REST WAS WRONG THREE TIMES FIRST, always
// in the same direction - accusing working code by missing an idiom.
// It is worth writing the vocabulary down, because the next sweep will
// reach for the same regex:
//   1st: counted only `assert` and `process.exit(1)`, and so accused
//        every probe using the local `die()` / `fail()` helpers.
//   2nd: added those, and still accused the `check()` harness probes.
//   3rd: added check(), and accused castProbe and firstHourProbe -
//        45 judgements between them - because they accumulate and end
//        on `process.exit(ok ? 0 : 1)`, which is not `exit(1)`.
// Below is the fourth version, and it is checked against the corpus
// rather than trusted.
const JUDGES = [
  /\b(die|fail|check)\s*\(/,              // the three locally-defined helpers
  /process\.exit\(\s*(?!0\s*\))/,         // exit with anything but a literal 0
  /process\.exitCode\s*=\s*(?!0)/,
  /throw new \w*Error/,
  /\bassert[.(]/,
];
/** A helper's own DEFINITION is not a judgement. */
const isHelperDef = (l) => /^\s*(const|function)\s+(die|fail|check)\b/.test(l);
const judges = (l) => !isHelperDef(l) && JUDGES.some((re) => re.test(l));

/** Tools whose output is an IMAGE or a WAV for a human to look at or
 *  listen to. They have no machine-checkable subject, so "judges
 *  nothing" is correct for them, not a defect - screenshot.mjs is the
 *  clearest case: it exists to produce a PNG. */
const EYEBALL_TOOLS = new Set([
  'screenshot.mjs',      // "Headless screenshot proof for the current milestone scene"
  'musicRender.mjs',     // "render a song to a WAV so a human can HEAR it"
  'splashProbe.mjs',     // shoots ANIM0001.VID mid-play for a human to compare
  'titleProbe.mjs',      // the title screen, captured
  'townProbe.mjs',       // close-up screenshot (doctrine)
  'monsterProbe.mjs',    // "compare the crop against the RAW record art"
]);

const browserProbes = readdirSync(TOOLS).filter((n) => n.endsWith('.mjs'))
  .map((f) => ({ f, src: readFileSync(`${TOOLS}/${f}`, 'utf8') }))
  .filter(({ src }) => /page\.goto\(/.test(src));

test('T3: every browser probe judges its subject', () => {
  const mute = [];
  for (const { f, src } of browserProbes) {
    if (EYEBALL_TOOLS.has(f)) continue;
    if (!src.split('\n').some(judges)) mute.push(f);
  }
  assert.deepEqual(mute, [],
    'these probes run the game and never decide whether it worked - their exit code is 0 whatever happens');
});

test('T3: a probe does not keep printing after its last judgement', () => {
  // guildServiceProbe had THREE judgements and still could not fail:
  // all three were setup guards (no guild door, no billboard, no
  // popup), and past them it printed ten states and judged none of
  // them. Counting judgements alone would have cleared it. A healthy
  // probe's tail is its one-or-two-line summary; ten is a subject
  // nobody looked at.
  const offenders = [];
  for (const { f, src } of browserProbes) {
    if (EYEBALL_TOOLS.has(f)) continue;
    const lines = src.split('\n');
    let last = -1;
    lines.forEach((l, i) => { if (judges(l)) last = i; });
    const tail = lines.slice(last + 1).filter((l) => /console\.log\(/.test(l)).length;
    if (tail >= 3) offenders.push(`${f} (${tail} states printed after the last judgement)`);
  }
  assert.deepEqual(offenders, [],
    'these probes exercise their subject and then stop judging - the tail is unchecked');
});

test('T3: the eyeball-tool allowlist is honest on both sides', () => {
  // The failure mode of any allowlist is a probe parked on it to
  // silence the rule. A tool is only exempt because its output is a
  // FILE for a human - so it has to actually write one, and it must
  // not have grown judgements in the meantime (if it has, it is a
  // probe now and belongs under the rule).
  for (const f of EYEBALL_TOOLS) {
    const p = browserProbes.find((x) => x.f === f);
    if (!p) continue;               // deleted is fine; a stale name is not a failure
    assert.match(p.src, /page\.screenshot\(|writeFileSync\(/,
      `${f} is exempt as an eyeball tool but writes no file for anyone to look at`);
  }
});

// ---------------------------------------------------------------------------
// ROAD-E E8: THE THREE STALE PROBES OF Port-Ledger.md:607, closed.
//
// A probe that drives a window the port no longer HAS is the same lie
// as a probe that cannot fail: it reports a failure the game does not
// have. All three named in that row drove surfaces that had moved on -
// two of them to the native windows U8c/U40 and B5-6 built, and one of
// them into a frozen world.
// ---------------------------------------------------------------------------

test('E8: no probe drives the keyed browse window the native trade screen replaced', () => {
  // shopProbe read `overlay.options` for digit rows ("1 - ...") and
  // died on undefined.some, because U8c/U40 replaced that window with
  // the native trade screen. Its subject - buy and sell at a shop
  // shelf - is covered twice over by tradeModeProbe and
  // nativeTradeProbe, so E8 RETIRED it rather than writing a third.
  assert.equal(browserProbes.some((p) => p.f === 'shopProbe.mjs'), false,
    'shopProbe.mjs is retired - its drive lives in nativeTradeProbe.mjs');
  const survivors = ['tradeModeProbe.mjs', 'nativeTradeProbe.mjs'];
  for (const f of survivors) {
    assert.ok(browserProbes.some((p) => p.f === f), `${f} carries the retired probe's subject`);
  }
  // and the two that took the subject really do drive BOTH halves
  const nt = browserProbes.find((p) => p.f === 'nativeTradeProbe.mjs').src;
  assert.match(nt, /BUY \+ SELL/);
});

test('E8: the tone probe reads the NATIVE talk window, not a text option row', () => {
  const tone = browserProbes.find((p) => p.f === 'toneProbe.mjs');
  assert.ok(tone, 'toneProbe.mjs still exists - it was ported, not retired');
  // B5-6's window draws the tone as three 6x6 art radios, so there is
  // no "tone: Normal" row to find and looking for one failed against
  // a window that was working.
  assert.equal(/tone: Normal/.test(tone.src), false,
    'toneProbe still hunts a text option row the native window does not draw');
  assert.match(tone.src, /greet\.native/, 'it asks whether the ART window is up');
  assert.match(tone.src, /topicMode/, 'and reads the live where-is walk off the window itself');
});

test('E8: the streaming where-is probe drains the opening boxes before it waits for a walker', () => {
  const wi = browserProbes.find((p) => p.f === 'worldWhereIsProbe.mjs');
  assert.ok(wi, 'worldWhereIsProbe.mjs still exists - it was ported, not retired');
  // A modal holds the motor: every host returns at its overlay gate
  // before the frame body, so while the quest arc's boot boxes are up
  // the town does not tick and NOBODY WALKS. This probe reported NO
  // LIVE WALKER against a healthy host for exactly that reason;
  // firstHourProbe learned it first and drains them the same way.
  const drain = wi.src.indexOf('opening boxes drained');
  const walker = wi.src.lastIndexOf('NO LIVE WALKER');
  assert.ok(drain > 0, 'the drain is missing');
  assert.ok(drain < walker, 'the drain must come BEFORE the walker poll, or it drains nothing in time');
  assert.match(wi.src, /AN OPENING BOX WILL NOT CLOSE/, 'and it judges the drain rather than hoping');
});
