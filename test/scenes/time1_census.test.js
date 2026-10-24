// TIME1 (2026-10-01, Mac: "I don't want a band aid, I want a detailed way we can do this" / "Let's do it. This needs to
// be perfect"): THE CENSUS OF THE CLOCKS. Online the world keeps three clocks (bible/06-Systems/Online-Time-Arc.md):
// the SKY (what time of day, what date, which moon - read for "now", never stamped), the EVENT clock (WORLD5's: what
// the world schedules, stocks, prices and meters) and the character's own. A reader on the wrong one fails silently -
// a sky read left on the event clock shows the wrong hour, an event read moved to the sky resets a day's cap four times
// as often - so every line in src/ that reads a shared clock is named in test/fixtures/time1_census.json with the
// clock it means and why, and this file holds src/ to the table BOTH WAYS: a new reader the table does not name fails,
// a row whose line is gone fails, and a row's clock must be the one its line reads. A new reader has to say which
// clock it means.
//
// The table names a line by a snippet of its code (`has`); identical lines in one file share a row and say how many
// (`count`); a line holding a snippet inside a longer one of its own is named by the LONGEST. Comment lines are not
// readers. The table is a table and not a note on each line because the mutant campaigns (tools/mutants/) pin these
// lines' text: an event reader that does not move should not change a byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CENSUS = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/time1_census.json'), 'utf8'));

/** A line that reads a shared clock: the accessors, the laws, and the tickers' carriers. */
const READER_RE = /\b(worldMinutes|skyMinutes|trustedWorldMinutes)\(\)|\b(sharedClassicMinutes|skyClassicMinutes|wallMsForClassicMinutes|wallMsForSkyMinutes)\(|\b(?:playerTicker|interiorTicker)\.classicMinutes\b/;
/** A line that reads the sky. */
const SKY_RE = /\bskyMinutes\(\)|\bskyClassicMinutes\(|\bwallMsForSkyMinutes\(/;
const CLOCKS = new Set(['sky', 'event', 'law']);

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out;
};
/** A line's code: '' for a comment line, the code before a trailing comment otherwise. */
const codeOf = (l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l.replace(/\s\/\/.*$/, '').trim());
const readersOf = (file) => readFileSync(join(ROOT, file), 'utf8').split('\n').map(codeOf).filter((c) => c && READER_RE.test(c));

test('TIME1 census: the table is well formed - every row a file, a snippet, a known clock and a reason', () => {
  assert.ok(Array.isArray(CENSUS.rows) && CENSUS.rows.length > 100, `the census lost its rows: ${CENSUS.rows?.length}`);
  const seen = new Set();
  for (const r of CENSUS.rows) {
    assert.equal(typeof r.file, 'string');
    assert.ok(typeof r.has === 'string' && r.has.length >= 8, `${r.file}: a snippet too short to name a line - "${r.has}"`);
    assert.ok(CLOCKS.has(r.clock), `${r.file}: "${r.has}" names no clock it may mean (${r.clock})`);
    assert.ok(typeof r.why === 'string' && r.why.length >= 6, `${r.file}: "${r.has}" says no reason`);
    assert.ok(r.count === undefined || (Number.isInteger(r.count) && r.count >= 2), `${r.file}: a count is for lines that are twins`);
    const key = `${r.file}\u0000${r.has}`;
    assert.ok(!seen.has(key), `${r.file}: "${r.has}" is two rows`);
    seen.add(key);
  }
});

test('TIME1 census: every line in src/ that reads a shared clock is named, every row names its lines, and no row says a clock its line does not read', () => {
  const unnamed = [];
  const counts = new Map();
  const files = walk(join(ROOT, 'src'));
  for (const file of files) {
    const rows = CENSUS.rows.filter((r) => r.file === file);
    for (const line of readersOf(file)) {
      const best = rows.filter((r) => line.includes(r.has)).sort((a, b) => b.has.length - a.has.length)[0];
      if (!best) { unnamed.push(`${file}: ${line.slice(0, 160)}`); continue; }
      counts.set(best, (counts.get(best) ?? 0) + 1);
      // the clock the row says is the clock the line reads: a sky row reads the sky, an event row does not
      if (best.clock === 'sky') assert.match(line, SKY_RE, `${file}: "${best.has}" is a sky row and its line reads no sky: ${line.slice(0, 160)}`);
      if (best.clock === 'event') assert.doesNotMatch(line, SKY_RE, `${file}: "${best.has}" is an event row and its line reads the sky: ${line.slice(0, 160)}`);
    }
  }
  assert.deepEqual(unnamed, [], `a line reads a shared clock and the census does not say which it means - add a row to test/fixtures/time1_census.json (bible/06-Systems/Online-Time-Arc.md section 5 says which):\n${unnamed.join('\n')}`);
  const wrong = CENSUS.rows.filter((r) => (counts.get(r) ?? 0) !== (r.count ?? 1))
    .map((r) => `${r.file}: "${r.has}" names ${counts.get(r) ?? 0} line(s), the row says ${r.count ?? 1}`);
  assert.deepEqual(wrong, [], `a row names lines that are gone, or more than it says:\n${wrong.join('\n')}`);
  assert.ok(files.includes('src/scenes/world.js') && files.length > 100, 'the walk saw the tree');
});

test('TIME1 census: the laws are only where the laws live - a law row stands in the clock modules and the install alone', () => {
  const homes = new Set(['src/net/skyLaw.js', 'src/systems/skyCalendar.js', 'src/systems/worldTick.js', 'src/scenes/world.js']);
  for (const r of CENSUS.rows.filter((x) => x.clock === 'law')) assert.ok(homes.has(r.file), `${r.file}: "${r.has}" says it is a law outside the clocks' homes`);
  const install = CENSUS.rows.find((r) => r.file === 'src/scenes/world.js' && r.clock === 'law');
  assert.ok(install && /setSharedClock\(/.test(readersOf('src/scenes/world.js').find((l) => l.includes(install.has)) ?? ''), "the world host's law row is its install");
});

test('TIME1 census: the readers the design names are where it says - the frame\'s hour, the seasons, the curses\' sky and the sky feed read the sky; the gates, the raids, the prices, the shelves and the weather keep the event clock', () => {
  // the line itself, found in the source, and the row that names it
  const clockOfLine = (file, re) => {
    const line = readersOf(file).find((l) => re.test(l));
    assert.ok(line, `${file}: no reader line matches ${re}`);
    return CENSUS.rows.filter((r) => r.file === file && line.includes(r.has)).sort((a, b) => b.has.length - a.has.length)[0]?.clock;
  };
  for (const [file, re] of [
    ['src/scenes/world.js', /const minuteNow = /], ['src/scenes/exterior.js', /const minuteNow = /],
    ['src/scenes/world.js', /let season = seasonPin/], ['src/scenes/exterior.js', /let season = seasonPin/],
    ['src/scenes/dungeonContext.js', /runMagicRoundsFor\(/], ['src/scenes/worldModes.js', /setLighting\(/],
    ['src/scenes/world.js', /classicMinutes: playerTicker\.classicMinutes, skyMinutes/], ['src/scenes/exterior.js', /classicMinutes: playerTicker\.classicMinutes, skyMinutes/],
    ['src/net/nodeLaw.js', /dayDate = /], ['src/scenes/worldModes.js', /holidayId: getHolidayId/],
  ]) assert.equal(clockOfLine(file, re), 'sky', `${file} ${re}`);
  for (const [file, re] of [
    ['src/net/gate/gateLaw.js', /gameDayAt = /], ['src/scenes/world.js', /raidMapMarks\(/],
    ['src/scenes/worldModes.js', /const guildShelf = /], ['src/scenes/world.js', /tickWeather\(/],
    ['src/scenes/dungeonContext.js', /_wallNow = /], ['src/systems/save/save.js', /const own = /],
  ]) assert.equal(clockOfLine(file, re), 'event', `${file} ${re}`);
});
