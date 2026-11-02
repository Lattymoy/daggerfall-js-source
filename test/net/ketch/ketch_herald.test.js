// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 14): THE SKY-KETCH'S HERALD - the hub's three cards a voyage
// on the clock alone (the sighting pinging the role, the arrival and the weighing anchor quiet), each owed once in its
// window and let go past it, her family's card; the relay's beat over a fake hub. tools/mutants/ketch_herald.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KT_HERALD_MOMENTS, ketchHeraldRole, ketchSightedPost, ketchArrivedPost, ketchDepartingPost, ketchHeraldPost, readKetchHeraldState, ketchHeraldDue } from '../../../src/net/ketch/ketchHerald.js';
import { ketchVoyageOf } from '../../../src/net/ketch/ketchLaw.js';
import { HERALD_FAMILIES, heraldCss } from '../../../src/net/herald/heraldCard.js';
import { KT_RING_CSS } from '../../../src/ui/ketch/ketchMapMark.js';
import { RELAY_CFG_VARS, RELAY_CFG_KEY_MIN } from '../../../src/net/relayCfg.js';

const ROLE = '123456789012345678', GATE = '876543210987654321';

test('KETCH THE CARDS: her family (The Sky-Ketch, the edge her ring\'s blue on the map); the sighting pings the role with when she arrives, the arrival and the weighing anchor ping nobody; each its moment\'s footer and its facts as fields (mutants: the arrival pinging; the family another\'s; her colour not her ring\'s)', () => {
  assert.deepEqual(HERALD_FAMILIES.ketch, { name: 'The Sky-Ketch', colour: 0x7cc4ff, thread: 'ktThread' });
  assert.equal(heraldCss('ketch'), KT_RING_CSS, 'her card\'s edge is her ring on the map');
  const v = ketchVoyageOf(2);
  const s = ketchSightedPost({ n: 2, role: ROLE });
  assert.equal(s.embeds[0].author.name, 'The Sky-Ketch');
  assert.equal(s.embeds[0].footer.text, 'Sighted');
  assert.match(s.content, new RegExp(`<@&${ROLE}>`));
  assert.match(s.content, new RegExp(`<t:${Math.floor(v.at / 1000)}:R>`), 'when she arrives, in each reader\'s clock');
  assert.deepEqual(s.allowed_mentions, { roles: [ROLE] });
  assert.deepEqual(s.embeds[0].fields.map((f) => f.name), ['Arrives', 'Weighs anchor', 'Where']);
  const a = ketchArrivedPost({ n: 2 });
  assert.equal(a.content, undefined, 'a quiet card');
  assert.equal(a.embeds[0].footer.text, 'Arrived');
  assert.match(a.embeds[0].fields[0].value, new RegExp(`<t:${Math.floor(v.departAt / 1000)}:t>`));
  const d = ketchDepartingPost({ n: 2 });
  assert.equal(d.embeds[0].footer.text, 'Weighing anchor');
  assert.match(d.embeds[0].fields[1].value, new RegExp(`<t:${Math.floor(ketchVoyageOf(3).at / 1000)}:F>`), 'and the next voyage');
  assert.deepEqual(KT_HERALD_MOMENTS.map((k) => ketchHeraldPost(2, k, ROLE).embeds[0].footer.text), ['Sighted', 'Arrived', 'Weighing anchor']);
});

test('KETCH THE ROLE AND THE THREAD: her own role when the operator names one, else the gate\'s; her thread a relay setting over KT_DISCORD_THREAD, said only to world255 or later (mutants: the gate\'s role first; the setting\'s floor an older relay\'s)', () => {
  assert.equal(ketchHeraldRole(ROLE, GATE), ROLE);
  assert.equal(ketchHeraldRole('', GATE), GATE);
  assert.equal(ketchHeraldRole('nope', null), null);
  assert.equal(RELAY_CFG_VARS.ktRole, 'KT_DISCORD_ROLE');
  assert.equal(RELAY_CFG_VARS.ktThread, 'KT_DISCORD_THREAD');
  assert.equal(RELAY_CFG_KEY_MIN.ktThread, 255);
  assert.equal(RELAY_CFG_KEY_MIN.ktRole, 255);
  const toml = readFileSync(new URL('../../../server/wrangler.toml', import.meta.url), 'utf8');
  assert.match(toml, /^KT_DISCORD_ROLE = ""$/m);
  assert.match(toml, /^KT_DISCORD_THREAD = ""$/m);
});

test('KETCH WHAT IS OWED: the sighting at its instant, then the arrival, then the weighing anchor, then the next voyage\'s sighting; a moment posted is never owed again, a window passed unposted is let go, never posted late into the next (mutants: the sighting owed before its instant; a passed window posted; a posted moment owed again)', () => {
  const v0 = ketchVoyageOf(0), v1 = ketchVoyageOf(1);
  let st = readKetchHeraldState(null);
  assert.deepEqual(st, { n: -1, k: -1 });
  const step = (t) => { const d = ketchHeraldDue(t, st); if (d && d.at <= t) st = { n: d.n, k: d.i }; return d && { n: d.n, k: d.k, at: d.at }; };
  assert.deepEqual(step(v0.sightAt - 1000), { n: 0, k: 'sighted', at: v0.sightAt }, 'waited for');
  assert.deepEqual(step(v0.sightAt + 5), { n: 0, k: 'sighted', at: v0.sightAt + 5 });
  assert.deepEqual(step(v0.sightAt + 10), { n: 0, k: 'arrived', at: v0.at }, 'posted: the next moment waited for');
  assert.deepEqual(step(v0.at + 1), { n: 0, k: 'arrived', at: v0.at + 1 });
  assert.deepEqual(step(v0.departAt + 1), { n: 0, k: 'departing', at: v0.departAt + 1 });
  assert.deepEqual(step(v0.departAt + 2), { n: 1, k: 'sighted', at: v1.sightAt });
  // a hub asleep through the whole of voyage 1: its moments let go, voyage 2's sighting owed
  const late = ketchHeraldDue(ketchVoyageOf(2).sightAt - 10, { n: 0, k: 2 });
  assert.deepEqual([late.n, late.k], [2, 'sighted']);
  // asleep through the arrival's window: let go, the departure owed
  const skip = ketchHeraldDue(v1.departAt + 60_000, { n: 1, k: 0 });
  assert.deepEqual([skip.n, skip.k, skip.at], [1, 'departing', v1.departAt + 60_000]);
  assert.deepEqual(readKetchHeraldState({ n: 3, k: 9 }), { n: -1, k: -1 }, 'a moment no voyage has is none');
});
