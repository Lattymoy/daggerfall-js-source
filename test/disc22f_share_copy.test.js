// DISC22-F (2026-09-24, Skibbster on Discord: "Unable to share quests with players if you've previously completed the
// same quest" - the receiver read "... but you already has this quest").
//
// THE BUG: AUDIT DROPS A2 remembers a quest finished under a share so a partner who is behind cannot re-send it and pay
// its rewards twice - and it remembered the quest's NAME. A repeatable quest (every guild and faction quest) finished
// once with the party refused every later share of that name as "done", for the rest of the session, and the memory
// outlived even a load. The guard is about ONE COPY, so the copy now carries an identity (Quest.shareId, stamped the
// first time it is shared, carried in its envelope and its save) and the finished memory is keyed on it. The refusal
// fragments follow "... but you" (scenes/world.js), so they are second person.
//
// Driven through the real machine and the real share path (prepareQuestShare -> receiveSharedQuest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { receiveSharedQuest, prepareQuestShare, SHARE_REFUSAL_TEXT } from '../src/systems/questShare.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}
const SRC = { __SH: ['Quest: __SH', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:', 'Item _reward_ gold', '', '_t_ task:', ' give pc _reward_', '', 'variable _pad_'] };
const machine = () => new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: (name) => SRC[name] ?? null });
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
/** A player takes __SH and marks it shared, as the Share button leaves it. */
const takeAndShare = (m) => { const q = m.scheduleQuest(SRC.__SH, 0, { rolls: () => 0 }); m.tick(); m.markQuestShared('__SH'); return q; };
const envelope = (m, q) => prepareQuestShare(m, q.uid).data;

test('DISC22-F: a repeatable quest finished under a share takes the NEXT share of it - only the finished copy is refused', () => {
  const A = machine(), R = machine();
  const first = takeAndShare(A);
  const firstEnv = envelope(A, first);
  assert.equal(typeof firstEnv.shareId, 'string', 'the copy carries its identity in the envelope');
  const got = receiveSharedQuest(R, lists, '__SH', firstEnv);
  assert.ok(got.ok && !got.resync);
  assert.equal(got.quest.shareId, firstEnv.shareId, 'the received copy is the same copy');
  // R finishes it (the quest ends and is tombstoned), and so does A
  R.tombstoneQuest(got.quest);
  A.tombstoneQuest(first);
  // A2 stands: the partner re-sending THAT copy is refused as done - no second reward
  assert.equal(receiveSharedQuest(R, lists, '__SH', firstEnv).reason, 'done');
  // Skibbster's case: A takes the quest again and shares it - a new copy, received
  const second = takeAndShare(A);
  const secondEnv = envelope(A, second);
  assert.notEqual(secondEnv.shareId, firstEnv.shareId, 'a new copy has a new identity');
  const again = receiveSharedQuest(R, lists, '__SH', secondEnv);
  assert.ok(again.ok, `refused as ${again.reason} - the old name-keyed memory`);
  // and a third player's own copy, shared to R, is a copy too
  const C = machine();
  R.tombstoneQuest(again.quest);
  assert.ok(receiveSharedQuest(R, lists, '__SH', envelope(C, takeAndShare(C))).ok);
});

test('DISC22-F: the identity is stamped once and survives a save; an envelope with none falls back to A2\'s name', () => {
  const A = machine();
  const q = takeAndShare(A);
  const id = envelope(A, q).shareId;
  assert.equal(envelope(A, q).shareId, id, 'the same copy keeps its identity across resyncs');
  assert.equal(q.getSaveData().shareId, id, 'written to the save');
  const R = machine();
  const got = receiveSharedQuest(R, lists, '__SH', envelope(A, q));
  R.tombstoneQuest(got.quest);
  const old = { ...envelope(A, q) };
  delete old.shareId;
  assert.equal(receiveSharedQuest(R, lists, '__SH', old).reason, 'done', 'an older client\'s envelope: the name decides, as before');
});

test('DISC22-F: a load forgets the share memory with the game it belonged to', () => {
  const A = machine(), R = machine();
  const q = takeAndShare(A);
  const env = envelope(A, q);
  const got = receiveSharedQuest(R, lists, '__SH', env);
  R.tombstoneQuest(got.quest);
  assert.equal(receiveSharedQuest(R, lists, '__SH', env).reason, 'done');
  R.clearState();
  assert.deepEqual([R.sharedQuestNames.size, R.finishedSharedQuestNames.size, R.finishedShareIds.size, R._rearmed.size], [0, 0, 0, 0]);
});

test('DISC22-F: the refusal reads as said to the receiver - "... but you already have this quest."', () => {
  const say = (reason) => `Tony tried to share "X", but you ${SHARE_REFUSAL_TEXT[reason]}`;
  assert.equal(say('active'), 'Tony tried to share "X", but you already have this quest.');
  assert.equal(say('done'), 'Tony tried to share "X", but you have already done this quest.');
  for (const k of ['active', 'done', 'mismatch', 'unknown', 'guild']) assert.doesNotMatch(SHARE_REFUSAL_TEXT[k], /^(has|is|does)\b|\bits own\b/, `${k} reads in the second person`);
  assert.match(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/scenes/world.js'), 'utf8'), /but you \$\{why\}/, 'the frame the fragments complete');
});
