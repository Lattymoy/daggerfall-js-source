// RPT1026-EVENTS KETCH-OWED (a private report: in the Tonal Warden's resonator phase a crew took more than a whole health bar
// at once, spending every death-saving piece they wore): A WHOLE BRIDGE'S BLOW LANDS ONCE. The Discord, the
// Keel-Song and the turn west are owed to every screen in the fight (net/ketch/ketchLink.js `owed` - no place to misjudge,
// so a hidden tab still pays them), and the page pays each as it lands (scenes/ketch/ketchFight.js). A blow stays in the
// fight's list a breath past its landing (ktBlowDone), and every word folded in that breath owed it again: the page landed
// one Discord - a quarter of everyone's health, no save - once more for every walk or health word heard after it.
// The real voyage (test/net/ketch/ketchSim.mjs, the director's own frames through the wire) is heard by the real link and
// judged by the real fight, my feet on the bridge. tools/mutants/rpt1026_events.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKetchLink, ktWholeBridge } from '../../../src/net/ketch/ketchLink.js';
import { KT_BRIDGE, deckToDungeon } from '../../../src/net/ketch/ketchDeck.js';
import { KW_BLOWS } from '../../../src/net/ketch/ketchWarden.js';
import { createKetchFight } from '../../../src/scenes/ketch/ketchFight.js';
import { validKetchOut } from '../../../src/net/wire.js';
import { sailWhole, T0 } from './ketchSim.mjs';
import { installEnemyExpansion } from '../../../src/systems/enemyExpansion/dexInstall.js';

installEnemyExpansion({ log: () => {} });   // the boot's own rows (scenes/shared.js) - a construct's stand-in reads them

const ME = 'mem0';
const quiet = (f) => { const w = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = w; } };

/** The page of `me` on the bridge through the whole voyage: the link folding every frame it hears, the fight's frame every
 *  `step` ms between them; every blow that landed on me, by name. */
function heardOnTheBridge(frames, step = 50) {
  let clock = T0;
  const link = createKetchLink({ now: () => clock, me: () => ME });
  const me = { health: 1000, maxHealth: 1000 };
  const landed = [];
  const fight = createKetchFight({
    link, now: () => clock, feet: () => deckToDungeon(KT_BRIDGE.x, KT_BRIDGE.y, KT_BRIDGE.z), player: () => me,
    strike: (dmg, how) => { landed.push({ name: how?.name ?? '', dmg, at: clock }); me.health = me.maxHealth; },   // stood up again: every landing counted
  });
  for (const f of frames) {
    if (f.to != null && f.to !== ME) continue;
    const { now, to: _to, ...x } = f;
    for (let t = clock; t < now; t += step) { clock = t; quiet(() => fight.frame()); }
    clock = now;
    link.word(validKetchOut(x));
  }
  for (let k = 0; k < 80; k++) { clock += step; quiet(() => fight.frame()); }
  return { landed, link };
}

test('RPT1026-EVENTS KETCH-OWED: through a whole voyage heard on the bridge, every whole bridge\'s blow the room struck lands on me ONCE - the Discord a quarter of my health a time, never again for each word heard in the breath it stays listed (mutant: a paid blow owed again)', () => {
  const whole = sailWhole(4);
  const struck = whole.frames.filter((f) => f.k === 'bl' && ktWholeBridge(f.b) && (f.to == null || f.to === ME));
  assert.ok(struck.length >= 2, 'the voyage strikes the whole bridge');
  // the room's words keep coming in each blow's breath past its landing - the defect's own condition
  const after = struck.map((s) => whole.frames.filter((f) => f.now > s.b.at && f.now < s.b.at + 1500).length);
  assert.ok(after.some((n) => n >= 2), `words heard after a landing, while it is still listed: ${after}`);
  const { landed } = heardOnTheBridge(whole.frames);
  const discordsStruck = struck.filter((f) => f.b.a === KW_BLOWS.discord.a).length;
  const discords = landed.filter((l) => l.name === KW_BLOWS.discord.name);
  assert.ok(discordsStruck >= 1, 'the voyage\'s Discord');
  assert.equal(discords.length, discordsStruck, `each Discord once: ${JSON.stringify(discords.map((l) => l.at - T0))}`);
  for (const d of discords) assert.equal(d.dmg, Math.round(KW_BLOWS.discord.p * 1000), 'a quarter of the pool, no more');
  // the Keel-Songs: each one landed (its forks left standing) once, however many words came after it
  const songs = landed.filter((l) => l.name === KW_BLOWS.song.name);
  assert.ok(songs.length <= struck.filter((f) => f.b.a === KW_BLOWS.song.a).length, 'never a song more than were sung');
});

test('RPT1026-EVENTS KETCH-OWED: the link forgets what it paid only with its fight - a new fight\'s blow of the same number is owed, and the ship left lets every one go (mutants: a paid blow owed again; the payment never kept)', () => {
  const whole = sailWhole(4);
  const first = whole.frames.find((f) => f.k === 'bl' && ktWholeBridge(f.b) && (f.to == null || f.to === ME));
  let clock = T0;
  const link = createKetchLink({ now: () => clock, me: () => ME });
  for (const f of whole.frames) {
    if (f.now > first.now) break;
    if (f.to != null && f.to !== ME) continue;
    const { now, to: _to, ...x } = f;
    clock = now;
    link.word(validKetchOut(x));
  }
  const owed = link.owed().find((b) => b.i === first.b.i);
  assert.ok(owed, 'owed when struck');
  link.paid(owed.i);
  link.word(validKetchOut({ k: 'whp', h: 10, m: 100 }));
  assert.ok(!link.owed().some((b) => b.i === owed.i), 'a word folded after the payment owes it no more');
  link.leave();
  assert.deepEqual(link.owed(), [], 'off the ship, nothing owed');
});
