// T2: THE PROBES' OWN HYGIENE.
//
// A probe that lies is worse than no probe. tools/tradeModeProbe.mjs
// spent its whole life reporting "the commit did not charge" against a
// game that charged correctly, because it booted the exterior host
// WITHOUT a class parameter - so the chargen wizard mounted, took
// townTalk's overlay slot, and townTalk.keydown (first in that host's
// keydown ladder, exterior.js:1046-1047) swallowed every
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
 *  (exterior.js:532-562 and world.js's copy of the same fork). The
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
