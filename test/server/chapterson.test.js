// CHAPTERS-ON (2026-10-12, a player on Discord: "The stuff described in the 'The Chapters' update never seems to appear
// on any noticeboards"; Mac: "Turn them on"; bible/01-Overview/bugs/Field-Bugs-2026-10-12.md). #734's notes told everyone,
// and production's CHAPTERS_OPEN still read "dev": an ordinary player's witness answered 403 chapters-closed and the
// board listed no chapter. This stands the service under the toml's OWN vars, so the line itself is what is pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { readRoll } from '../../server-account/src/npcRoll.js';
import { forgetChapters } from '../../server-account/src/npcHalls.js';
import { herbPatches, nodeKey } from '../../src/net/nodeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

const toml = readFileSync(new URL('../../server-account/wrangler.toml', import.meta.url), 'utf8');
const v = (k) => toml.match(new RegExp(`^${k} = "([^"]*)"`, 'm'))[1];

test('CHAPTERS-ON: under production\'s own vars a non-developer\'s board carries its region\'s chapters, a hall writ and a member\'s own writ', async () => {
  const DAY = 86400, R = 21;
  let now = utcDay(T0) * DAY + 43200;
  const real = Date.now;
  Date.now = () => now * 1000;
  try {
    forgetChapters();
    const s = await standService(Object.fromEntries(['CHAPTERS_OPEN', 'PROFESSIONS_OPEN', 'MARKS_OPEN', 'DEVELOPER_HANDLES'].map((k) => [k, v(k)])));
    const raw = s.env.DB._raw;
    const age = (w) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(now - 8 * DAY, w.id);
    for (const h of ['Alice', 'Bob', 'Cara']) {
      const w = await s.seated(h);
      age(w);
      now++;
      const r = await s.call('/v1/chapters/witness', { hall: { key: 77, region: R, factions: [40, 41] } }, w.secret);
      assert.equal(r.status, 200, `${h}'s witness is taken (at "dev" it answered 403 chapters-closed)`);
    }
    // a harvest in the region, so its board has a Court writ's ground to stand beside
    const g = await s.seated('Ground');
    age(g);
    const p = herbPatches({ x: 300, y: 200, day: utcDay(now), climate: 231, confirmed: false })[0];
    await s.call('/v1/prof/harvest', { character: g.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(now), slot: p.slot }), kind: 'herbs', climate: 231, region: R, act: { clean: false, bruised: false }, at: now - 2, rid: 'chapon-000001' }, g.secret);
    const who = await s.seated('Player');
    const C = await seatRealm(s.env, who.secret, 'Player');
    await readRoll({ db: s.env.DB, nowS: now }, { id: who.id }, { character: C.id, lease: C.lease, seed: { factions: { 41: 10 }, members: [{ f: 41, rank: 0 }] } });
    const l = (await s.call('/v1/writs/list', { character: C.id, region: R }, who.secret)).body;
    assert.deepEqual(l.chapters.map((c) => c.faction), [40, 41], 'both halls\' chapters on the board');
    assert.ok(l.writs.some((w) => w.kind === 'hall'), 'a hall writ posted');
    assert.ok(l.writs.some((w) => w.kind === 'member'), 'the member\'s own writ posted');
  } finally {
    Date.now = real;
  }
});
