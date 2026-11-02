// PERK-TRIAL (2026-10-24, the Discord's feature-feedback, "The time limit of a profession's perks changing" - marbletoff:
// "1k silver + week wait is too punishing ... the effects of some of the perks can be properly understood only after
// trying"; the owner's pick: a day's free trial after a choice, and a paid change at once with the week as the lock after
// it) - the law's reads (src/net/professionLaw.js), the track as the service says it (server-account/src/professions.js
// trackView) and migration 0173, which lands every change still waiting its week. The service's walk through a choice,
// its trial, a paid change and its lock is test/net/prof1_service.test.js; the page's, test/net/fb1016b_firstpick.test.js.
// Recorded in bible/06-Systems/Professions-Arc.md PERK-TRIAL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { RESPEC, SPEC_TRIAL_S, specTrialUntil, respecLockUntil, specTrialShown, specsAt } from '../../src/net/professionLaw.js';
import { trackView } from '../../server-account/src/professions.js';

const DAY = 86_400;
const NOW = 2_000_000_000;

test('PERK-TRIAL the law: a choice is on trial SPEC_TRIAL_S (a day) from when it was made, its rank\'s own; the lock is the track\'s, open from respec_at; the week and the fee stand (mutants: the trial a week; the trial\'s end inside it; the ranks crossed; the lock read at its end)', () => {
  assert.equal(SPEC_TRIAL_S, DAY);
  assert.deepEqual(RESPEC, { marks: 1000, days: 7 });
  const row = { spec50_at: NOW - 100, spec100_at: NOW - DAY, respec_at: NOW + 5 };
  assert.equal(specTrialUntil(row, 50, NOW), NOW - 100 + DAY, 'its day from its choice');
  assert.equal(specTrialUntil(row, 100, NOW), null, 'a day out at its end');
  assert.equal(specTrialUntil(row, 100, NOW - 1), NOW, 'and open a second before');
  assert.equal(specTrialUntil({ spec50_at: null }, 50, NOW), null, 'a choice made before PERK-TRIAL: no trial');
  assert.equal(specTrialUntil(row, 75, NOW), null);
  assert.equal(respecLockUntil(row, NOW), NOW + 5);
  assert.equal(respecLockUntil(row, NOW + 5), null, 'open at its end');
  assert.equal(respecLockUntil({}, NOW), null);
  assert.equal(specTrialShown({ trial: { 50: NOW + 1 } }, 50, NOW), true, 'the client\'s read of the service\'s word');
  assert.equal(specTrialShown({ trial: { 50: NOW } }, 50, NOW), false, 'run out on an open page');
  assert.equal(specTrialShown({ trial: { 50: NOW + 1 } }, 100, NOW), false);
});

test('PERK-TRIAL the track as said: `trial` its ranks on trial and until when, `lock` the next paid change\'s second - each said only where there is one; a change still written as waiting stands at once, its week the lock (mutants: the trial unsaid; the lock unsaid; a waiting change kept waiting)', () => {
  const v = trackView({ xp: 0, spec50: 'gardener', spec50_at: NOW - 10, spec100_at: NOW - 2 * DAY, respec_rank: 50, respec_at: NOW + DAY }, 'herbalism', NOW);
  assert.deepEqual([v.trial, v.lock, v.respec], [{ 50: NOW - 10 + DAY }, NOW + DAY, null]);
  const bare = trackView({ xp: 0, spec50: 'gardener' }, 'herbalism', NOW);
  assert.equal('trial' in bare || 'lock' in bare, false, 'nothing said where there is nothing');
  // AUDIT PERK-TRIAL P8 (PIN MOVED: it was said waiting, with no lock): a change still written as waiting - the older
  // service's, across the deploy - stands at once, its week the lock
  const old = trackView({ xp: 0, spec50: 'gardener', respec_rank: 50, respec_to: 'botanist', respec_at: NOW + DAY }, 'herbalism', NOW);
  assert.deepEqual([old.specs[50], old.respec, old.lock], ['botanist', null, NOW + DAY]);
  assert.deepEqual(specsAt({ spec50: 'gardener', respec_rank: 50, respec_to: 'botanist', respec_at: NOW + 6 * DAY }, NOW), { 50: 'botanist', 100: null }, 'whatever its time');
});

test('PERK-TRIAL migration 0173: a change still waiting its week lands at once, its trial from the migration and its week kept as the lock; one already in effect is folded with neither; a track with no change is untouched (mutants: the waiting change kept waiting; no trial for it; the lock dropped; the choices\' times unread)', () => {
  const db = new DatabaseSync(':memory:');
  const files = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  const at = files.indexOf('0173_perk_trial.sql');
  assert.ok(at > 0, 'the migration stands');
  for (const f of files.slice(0, at)) db.exec(readFileSync(new URL(`../../server-account/migrations/${f}`, import.meta.url), 'utf8'));
  db.exec('PRAGMA foreign_keys = OFF');
  const now = Math.floor(Date.now() / 1000);
  const put = db.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, respec_rank, respec_to, respec_at, updated_at) VALUES (?, ?, ?, 20000, ?, ?, ?, ?, ?, 1)');
  put.run('p', 'c', 'mining', 'prospector', null, 50, 'deep-delver', now + 3 * DAY);   // waiting: three days of the week left
  put.run('p', 'c', 'fishing', 'angler', 'deep-sea', 100, 'pearl-diver', now - DAY);   // in effect a day ago, never folded
  put.run('p', 'c', 'logging', 'lumberjack', null, null, null, null);                   // nothing
  put.run('p', 'c', 'hunting', 'tracker', null, null, null, null);                      // AUDIT PERK-TRIAL P7: chosen an hour ago
  const choice = db.prepare('INSERT INTO prof_choices (player, rid, char_id, profession, rank, spec, at, n) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  choice.run('p', 'r1', 'c', 'hunting', 50, 'tracker', now - 3600, 'n1');
  choice.run('p', 'r0', 'c', 'logging', 50, 'lumberjack', now - 30 * DAY, 'n0');
  db.exec(readFileSync(new URL('../../server-account/migrations/0173_perk_trial.sql', import.meta.url), 'utf8'));
  const row = (p) => db.prepare('SELECT * FROM prof_tracks WHERE profession = ?').get(p);
  const m = row('mining');
  assert.deepEqual([m.spec50, m.respec_to, m.respec_rank, m.respec_at], ['deep-delver', null, 50, now + 3 * DAY], 'landed now, the week kept as the lock');
  assert.ok(Math.abs(m.spec50_at - now) <= 5, `its trial from now (${m.spec50_at - now} s)`);
  assert.equal(specsAt(m, now)[50], 'deep-delver', 'and stands so');
  const f = row('fishing');
  assert.deepEqual([f.spec100, f.spec100_at, f.respec_to, f.respec_rank, f.respec_at], ['pearl-diver', null, null, null, null], 'folded, no trial, no lock');
  const l = row('logging');
  assert.deepEqual([l.spec50, l.spec50_at, l.respec_at], ['lumberjack', now - 30 * DAY, null], 'its time from its row - its day long out');
  assert.equal(row('hunting').spec50_at, now - 3600, 'AUDIT PERK-TRIAL P7: chosen an hour before, the rest of its day');
  assert.equal(specTrialUntil(row('hunting'), 50, now), now - 3600 + DAY);
});
