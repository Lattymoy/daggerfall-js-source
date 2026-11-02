// WILD-HUBLESS (bible/01-Overview/bugs/Field-Bugs-2026-10-25h.md WILD-REMAINS-LOSS): a game the social hub has not
// seated still knows its own fall and its own remains - by the signed-in session's account, the subject its room
// names the fallen by.
import test from 'node:test';
import assert from 'node:assert/strict';

import { wildSelf } from '../../src/net/wild/wildSelf.js';
import { remainsMine } from '../../src/net/wild/wildRemains.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';

const storageOf = (session) => {
  const m = new Map(session ? [[SESSION_KEY, JSON.stringify(session)]] : []);
  return { getItem: (k) => m.get(k) ?? null };
};
const SIGNED_IN = storageOf({ secret: 's3cret', id: 'acctRiadne000000000000aa', name: 'Riadne' });

test('WILD-HUBLESS: with no hub snapshot my account in the zone is the signed-in session\'s, and the hub\'s word wins where it has seated me (mutants: the session never read; the session over the hub)', () => {
  assert.equal(wildSelf(null, SIGNED_IN), 'acctRiadne000000000000aa', 'no social picture at all');
  assert.equal(wildSelf({ acct: null }, SIGNED_IN), 'acctRiadne000000000000aa', 'the hub link up, its snapshot not in');
  assert.equal(wildSelf({ acct: 'acctHub0000000000000000bb' }, SIGNED_IN), 'acctHub0000000000000000bb');
  assert.equal(wildSelf({ acct: null }, storageOf(null)), null, 'neither');
  assert.equal(wildSelf(null, storageOf({ id: 'acctRiadne000000000000aa' })), null, 'a stored value with no secret is no session');
});

test('WILD-HUBLESS: a seized remains named for me is mine on a game the hub has not seated (mutant: the session never read)', () => {
  const rec = { r: 'aaaaaaaaaaaa', os: 'acctRiadne000000000000aa', oid: 'peer-killer' };
  assert.equal(remainsMine(rec, wildSelf({ acct: null }, SIGNED_IN), 'peer-mine', null), true);
  assert.equal(remainsMine(rec, wildSelf({ acct: null }, storageOf({ secret: 's', id: 'acctBorin0000000000000cc' })), 'peer-mine', null), false, 'another account\'s game');
});
