import { isStaff } from '../../src/net/staffCommands.js';
import {
  STAFF_TP_TIMEOUT_MS,
  STAFF_PULL_TIMEOUT_MS,
  quietTeleportAllowed,
  staffPullAllowed,
} from '../../src/net/staffTeleport.js';
import { noteOf } from './staffFollow.js';

const fold = (s) =>
  String(s)
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim();

/** Only the verified target socket may answer a pending ticket. Nothing is
 * persisted or broadcast; an eviction cancels the lookup via the client's timer.
 * STAFF-PANEL5-FOLLOW (design doc "DFO Staff Panel: design", Invisible follow - silent TP; mob, 05:50Z: "always sending
 * party note with no serv affect to alway be bale to tp to them"): an Admin's or a Shadow Fang's ask from a build that
 * reads notes (`nt`) is answered from the hub's copy of the target's where note, and the target's game is sent nothing.
 * Only a note missing (`fb: 'missing'`) or one the asker's game found does not match (`cap`, `fb: 'mismatch'`) falls back
 * to today's capture, which a modded game can see - flagged on the answer. Any other staff ask is today's capture. */
export function routeStaffTeleport(room, ws, a, m, now) {
  const pending = (room._staffTeleports ??= new Map());
  for (const [ticket, p] of pending)
    if (now >= p.expires || !room._all().has(p.from) || !room._all().has(p.target)) pending.delete(ticket);
  const result = (socket, nonce, fields) =>
    room._send(socket, JSON.stringify({ t: 'stp', k: 'result', nonce, ...fields }));
  if (m.k === 'pull') {
    routeStaffPull(room, ws, a, m, now, pending, result);
    return;
  }
  if (m.k === 'landed') {
    pullLanded(room, ws, a, m, pending, result);
    return;
  }
  if (m.k === 'ask') {
    if (!isStaff(a.glyphs)) {
      result(ws, m.nonce, { error: 'denied' });
      return;
    }
    // STAFF-PANEL5-FOLLOW-FIX (the relay review's finding 6): a hidden staff socket (staffHidden.js `hid`) is in no list -
    // matched here, a Dungeon Master's /tp @Staff member went unanswered where a stranger's said `offline`
    const peers = [...room._all()].filter(
      ([other, b]) => b.id && !b.hid && !room._dead.has(other) && !room._gone.has(other),
    );
    let hits;
    if (m.id) hits = peers.filter(([, b]) => b.id === m.id);
    else {
      const name = fold(m.name);
      const exact = peers.filter(([, b]) => fold(b.name) === name);
      hits = exact.length ? exact : peers.filter(([, b]) => fold(b.name).startsWith(name));
    }
    if (hits.length !== 1) {
      result(ws, m.nonce, { error: hits.length ? 'ambiguous' : 'offline' });
      return;
    }
    const [target, b] = hits[0];
    const acct = typeof b.sub === 'string' ? { acct: b.sub } : {};
    const quiet = m.nt === 1 && quietTeleportAllowed(a.glyphs);
    if (quiet && m.cap !== 1) {
      const note = b.sub ? noteOf(room, b.sub, now) : null;
      if (note) {
        result(ws, m.nonce, {
          id: b.id,
          name: b.name,
          ...acct,
          via: 'note',
          note: note.p,
          ag: Math.floor((now - note.at) / 1000),
        });
        return;
      }
    }
    if (a.hid) {
      result(ws, m.nonce, { error: 'unavailable' });
      return;
    } // STAFF-PANEL5-HIDDEN-FIX: a hidden asker is answered from the note alone - a capture would tell a modded game staff came
    const fb = quiet ? (m.cap === 1 ? 'mismatch' : 'missing') : null;
    if (fb) console.info("[stp] the target's game is asked: its where note is", fb);
    for (const [ticket, p] of pending) if (p.from === ws) pending.delete(ticket);
    if (pending.size >= 128) {
      result(ws, m.nonce, { error: 'busy' });
      return;
    }
    const ticket = crypto.randomUUID();
    pending.set(ticket, {
      from: ws,
      target,
      id: b.id,
      nonce: m.nonce,
      expires: now + STAFF_TP_TIMEOUT_MS,
      ...(fb ? { fb } : {}),
    });
    if (!room._send(target, JSON.stringify({ t: 'stp', k: 'capture', ticket }))) {
      pending.delete(ticket);
      result(ws, m.nonce, { error: 'offline' });
    }
    return;
  }
  const p = pending.get(m.ticket);
  if (!p || p.pull || p.target !== ws || p.id !== a.id) return;
  pending.delete(m.ticket);
  const asker = room._all().get(p.from);
  if (!asker?.id || room._dead.has(p.from) || room._gone.has(p.from) || !isStaff(asker.glyphs)) return;
  result(
    p.from,
    p.nonce,
    m.error
      ? { error: m.error }
      : {
          id: a.id,
          name: a.name,
          ...(typeof a.sub === 'string' ? { acct: a.sub } : {}),
          dest: m.dest,
          ...(p.fb ? { fb: p.fb } : {}),
        },
  );
}

/** STAFF-PULL (2026-10-28, as the owner asked): an Admin or the Shadow Fang brings a player to where
 *  they stand. The hub sends that player's game the staff member's place (`pull`) on a ticket of its own, and only that
 *  socket's `landed` answers it. A frozen player stays put (`frozen`): the freeze holds them where they stood. */
function routeStaffPull(room, ws, a, m, now, pending, result) {
  if (!staffPullAllowed(a.glyphs)) {
    result(ws, m.nonce, { error: 'denied' });
    return;
  }
  const peers = [...room._all()].filter(
    ([other, b]) => other !== ws && !b.hid && b.id && !room._dead.has(other) && !room._gone.has(other),
  );
  let hits;
  if (m.id) hits = peers.filter(([, b]) => b.id === m.id);
  else if (m.acct) hits = peers.filter(([, b]) => b.sub === m.acct);
  else {
    const name = fold(m.name);
    const exact = peers.filter(([, b]) => fold(b.name) === name);
    hits = exact.length ? exact : peers.filter(([, b]) => fold(b.name).startsWith(name));
  }
  if (hits.length !== 1) {
    result(ws, m.nonce, { error: hits.length ? 'ambiguous' : 'offline' });
    return;
  }
  const [target, b] = hits[0];
  // staffFreeze.js frozenAt's law, not imported: an import here would reorder the relay's bundle
  if (Number(b.fz) > Math.floor(now / 1000)) {
    result(ws, m.nonce, { error: 'frozen' });
    return;
  }
  for (const [ticket, p] of pending) if (p.from === ws || (p.pull && p.target === target)) pending.delete(ticket);
  if (pending.size >= 128) {
    result(ws, m.nonce, { error: 'busy' });
    return;
  }
  const ticket = crypto.randomUUID();
  pending.set(ticket, { from: ws, target, id: b.id, nonce: m.nonce, expires: now + STAFF_PULL_TIMEOUT_MS, pull: true });
  if (!room._send(target, JSON.stringify({ t: 'stp', k: 'pull', ticket, dest: m.dest }))) {
    pending.delete(ticket);
    result(ws, m.nonce, { error: 'offline' });
  }
}

/** STAFF-PULL: the pulled player's game answers its ticket - landed, or why not. */
function pullLanded(room, ws, a, m, pending, result) {
  const p = pending.get(m.ticket);
  if (!p || !p.pull || p.target !== ws || p.id !== a.id) return;
  pending.delete(m.ticket);
  const asker = room._all().get(p.from);
  if (!asker?.id || room._dead.has(p.from) || room._gone.has(p.from) || !staffPullAllowed(asker.glyphs)) return;
  result(
    p.from,
    p.nonce,
    m.no
      ? { error: m.no }
      : { id: a.id, name: a.name, ...(typeof a.sub === 'string' ? { acct: a.sub } : {}), pulled: 1 },
  );
}
