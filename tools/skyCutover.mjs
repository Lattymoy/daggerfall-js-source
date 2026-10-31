#!/usr/bin/env node
// TIME1 (bible/06-Systems/Online-Time-Arc.md section 4): WHEN THE SKY MAY SWITCH. A row in src/net/skyLaw.js's
// SKY_SEGMENTS turns the sky's dial at an instant; at an ALIGNED instant the sky's hour as it stands already equals the
// new schedule's, so nothing skips at the switch and the new rate's midnights fall on whole fractions of the real day
// for good. This lists them, after now or a given instant, for the last segment's rate or a given TimeScale.
//
//   node tools/skyCutover.mjs                      the next aligned instants for the sky's own rate
//   node tools/skyCutover.mjs --after 2026-10-05   ...after a date (any Date.parse string, UTC)
//   node tools/skyCutover.mjs --scale 60           ...for another TimeScale (60: a day every 24 real minutes)
//
// The first switch must fall after the build that carries it is live (skyLaw.js says why); pick one after the merge.
// AUDIT TIME: at the last row's own rate (the default) the instants listed are where that row may MOVE - laid on the
// sky without it, so a merge that lands after the row's switch still finds the next aligned one; at another rate,
// where it may be REPLACED while it is not live yet, and where a NEW row may follow it once it is (second round).
import { SKY_SEGMENTS, alignedSkySwitches, skyLawOf } from '../src/net/skyLaw.js';
import { isMain } from './lib/isMain.mjs';

/** The CLI's answer as lines, pure over its arguments and `now`. */
export function cutoverLines(argv, now = Date.now()) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  const scale = Number(arg('--scale') ?? NaN);
  const minutesPerMs =
    Number.isFinite(scale) && scale > 0 ? scale / 60 / 1000 : SKY_SEGMENTS[SKY_SEGMENTS.length - 1].minutesPerMs;
  const afterText = arg('--after');
  const after = afterText ? Date.parse(afterText) : now;
  if (!Number.isFinite(after)) return [`--after: "${afterText}" is not a date`];
  const ts = minutesPerMs * 60 * 1000;
  const last = SKY_SEGMENTS[SKY_SEGMENTS.length - 1];
  // the last row MOVES at its own rate; at another rate it is REPLACED while it is not live yet (the instants laid on the
  // sky without it), and only once it is live does a NEW row follow it - never before it (AUDIT TIME, second round)
  const moving = !!last && last.minutesPerMs === minutesPerMs;
  const replacing = !moving && !!last && after < last.fromMs;
  const segments = moving || replacing ? SKY_SEGMENTS.slice(0, -1) : SKY_SEGMENTS;
  const what = moving
    ? `instants for the last row (now ${new Date(last.fromMs).toISOString()})`
    : replacing
      ? `instants to replace the last row (not live until ${new Date(last.fromMs).toISOString()})`
      : 'switches for a new row';
  const lines = [
    `TimeScale ${+ts.toFixed(4)} (a sky day every ${+(1440 / ts).toFixed(2)} real minutes); aligned ${what} after ${new Date(after).toISOString()}:`,
  ];
  for (const t of alignedSkySwitches(minutesPerMs, after, { count: 8, segments }))
    lines.push(
      `  ${new Date(t).toISOString()}   Date.UTC(${new Date(t).getUTCFullYear()}, ${new Date(t).getUTCMonth()}, ${new Date(t).getUTCDate()}, ${new Date(t).getUTCHours()}, ${new Date(t).getUTCMinutes()}, ${new Date(t).getUTCSeconds()})`,
    );
  // the sky the instants are laid on - without the last row when it moves or is replaced (AUDIT TIME, second round: the
  // whole law's rate here never matched, the last row's own rate being the moving case)
  if (lines.length === 1)
    lines.push(
      skyLawOf(segments).rateAt(after) === minutesPerMs
        ? '  none: the sky already runs at this rate then - a switch to it changes nothing'
        : '  none within a day - this rate never lines up with the sky as it stands',
    );
  return lines;
}

if (isMain(import.meta.url)) console.log(cutoverLines(process.argv.slice(2)).join('\n'));
