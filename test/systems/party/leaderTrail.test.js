import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaderTrailTarget, leaderTrailGoal, validLeaderRoute, clipLeaderRoute, TRAIL_PATTERN } from '../../../src/systems/party/leaderTrail.js';
import { createLeaderTrailHost } from '../../../src/scenes/leaderTrailHost.js';
import { createPartyPingHost } from '../../../src/scenes/partyPingHost.js';
import { partyEntranceMembers } from '../../../src/systems/party/partyEntrances.js';
import { partyVisibilityOptions } from '../../../src/systems/party/partyVisibility.js';
import { pathRibbon } from '../../../src/systems/party/partyPing.js';

test('leader identity, idle position and dungeon entrance override; approximate locations never become routes', () => {
  const member = { acct: 'leader', online: true, p: { in: 0 } };
  const social = { acct: 'me', party: { leader: 'leader' }, others: () => [member] };
  const members = [{ acct: 'leader', id: 'body', at: [40, 0, 0], exact: true }];
  const doors = [{ key: 'crypt', px: 1, py: 2, inside: 1, location: 'Crypt', at: [30, 0, 10] }];
  const args = { social, members, mode: 'exterior', feet: [0, 0, 0], entrances: (acct) => partyEntranceMembers({ others: [member].filter((m) => m.acct === acct), doors }) };
  assert.equal(leaderTrailTarget(args).id, 'body');
  assert.equal(leaderTrailTarget({ ...args, members: [{ ...members[0], exact: false }] }), null);
  member.p = { in: 1, px: 1, py: 2, loc: 'Crypt' };
  assert.deepEqual(leaderTrailTarget(args).at, [30, 0, 10], 'door wins over a stale exterior body');
  assert.equal(leaderTrailTarget(args).entrance, true);
  member.p.loc = 'Another dungeon';
  assert.equal(leaderTrailTarget(args), null, 'never route to an unrelated door');
  assert.equal(leaderTrailTarget({ ...args, mode: 'dungeon' }).id, 'body', 'same-scene body after entering');
  member.online = false; assert.equal(leaderTrailTarget(args), null);
  member.online = true; social.party.leader = 'me'; assert.equal(leaderTrailTarget(args), null);
});

test('local lookahead, entrance stopping, floor validity and bounded dotted geometry', () => {
  assert.deepEqual(leaderTrailGoal([0, 0, 0], { at: [1000, 0, 0] }, true), [120, 0, 0]);
  assert.deepEqual(leaderTrailGoal([0, 0, 0], { at: [10, 0, 0], entrance: true }, true), [8.5, 0, 0]);
  assert.equal(leaderTrailGoal([0, 0, 0], { at: [1, 0, 0] }, false), null);
  assert.equal(validLeaderRoute([[0, 0, 0], [10, 8, 0]], [0, 0, 0], [10, 0, 0], false), false);
  assert.equal(validLeaderRoute([[0, 0, 0], [3, 0, 0]], [0, 0, 0], [10, 0, 0], false), false);
  const clip = clipLeaderRoute([[0, 0, 0], [100, 0, 0], [100, 0, 100]]);
  assert.deepEqual(clip.at(-1), [100, 0, 20]);
  const verts = pathRibbon(clip, TRAIL_PATTERN);
  assert.ok(verts.length > 0 && verts.length < 4000 && verts.every(Number.isFinite));
});

test('trail persists for idle leaders, throttles failed routes, and resets on origin, scene, target or disable', () => {
  let time = 0, queries = 0, draws = 0, succeeds = true;
  const feet = [0, 0, 0], target = { key: 'leader:body', at: [10, 0, 0] };
  const options = partyVisibilityOptions({ leaderTrail: true });
  const renderer = { gl: { isContextLost: () => false } };
  const host = createLeaderTrailHost({ now: () => time, route: (to) => { queries++; return succeeds ? [feet, to] : null; },
    makeDraw: () => ({ draw: (_, __, rows) => { draws++; assert.equal(rows[0].alpha, 0.25); }, dispose() {} }) });
  const frame = (t = target, scene = 'd:one', origin = [0, 0, 0], opt = options) => host.frame(renderer, t, feet, scene, origin, false, opt);
  frame(); for (let i = 0; i < 10; i++) frame();
  assert.equal(queries, 1); assert.equal(draws, 11, 'idle stays drawn');
  time = 500; frame(); assert.equal(queries, 2);
  frame(target, 'd:two'); assert.equal(queries, 3);
  frame(target, 'd:two', [819, 0, 0]); assert.equal(queries, 4);
  succeeds = false; time = 1000; const before = draws; frame(target, 'd:two', [819, 0, 0]);
  for (let i = 0; i < 10; i++) frame(target, 'd:two', [819, 0, 0]);
  assert.equal(queries, 5); assert.equal(draws, before, 'no stale path after failure');
  frame(null); succeeds = true; frame(); assert.equal(queries, 6);
  frame(target, 'd:one', [0, 0, 0], { ...options, leaderTrail: false });
  assert.equal(queries, 6); host.dispose();
});

test('shared route service finds ground detours and dungeon paths without sending a party ping', () => {
  let place = { k: 'w:1.2', space: 'world' }, wall = true;
  const clear = (a, b) => !wall || !((a[0] <= 5 && b[0] >= 5 || a[0] >= 5 && b[0] <= 5) && Math.min(Math.abs(a[2]), Math.abs(b[2])) < 3);
  const mesh = {};
  const host = createPartyPingHost({ now: () => 0, place: () => place, feet: () => [0, 0, 0], ground: () => 0,
    clear, collider: () => null, navMesh: () => mesh, route: (_, from, to) => [[...from], [0, 0, 5], to],
    pressed: () => false, blocked: () => false, mode: () => 'exterior', toWire: () => null, fromWire: () => [], sound: () => {} });
  const detour = host.routeTo([10, 0, 0]);
  assert.ok(detour?.some((p) => Math.abs(p[2]) >= 3));
  assert.ok(detour.every((p, i) => !i || clear(detour[i - 1], p)));
  assert.equal(host.unsent(), false); assert.deepEqual(host.poseField(), {});
  wall = false; place = { k: 'd:one', space: 'dungeon' };
  assert.deepEqual(host.routeTo([10, 0, 0]), [[0, 0, 0], [0, 0, 5], [10, 0, 0]]);
  place = { k: 'i:one', space: 'interior' }; assert.equal(host.routeTo([10, 0, 0]), null);
  host.dispose();
});
