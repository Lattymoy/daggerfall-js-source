import { isStaff } from '../../src/net/staffCommands.js';
import { STAFF_TP_TIMEOUT_MS, quietTeleportAllowed } from '../../src/net/staffTeleport.js';
import { noteOf } from './staffFollow.js';

const fold = (s) => String(s).toLowerCase().replace(/['\u2019]/g, '').replace(/[\s-]+/g, ' ').trim();

/** Only the verified target socket may answer a pending ticket. Nothing is
 * persisted or broadcast; an eviction cancels the lookup via the client's timer.
 * STAFF-PANEL5-FOLLOW (design doc "DFO Staff Panel: design", Invisible follow - silent TP; mob, 05:50Z: "always sending
 * party note with no serv affect to alway be bale to tp to them"): an Admin's or a Shadow Fang's ask from a build that
 * reads notes (`nt`) is answered from the hub's copy of the target's where note, and the target's game is sent nothing.
 * Only a note missing (`fb: 'missing'`) or one the asker's game found does not match (`cap`, `fb: 'mismatch'`) falls back
 * to today's capture, which a modded game can see - flagged on the answer. Any other staff ask is today's capture. */
export function routeStaffTeleport(room, ws, a, m, now) {
  const pending = room._staffTeleports ??= new Map();
  for (const [ticket, p] of pending) if (now >= p.expires || !room._all().has(p.from) || !room._all().has(p.target)) pending.delete(ticket);
  const result = (socket, nonce, fields) => room._send(socket, JSON.stringify({ t: 'stp', k: 'result', nonce, ...fields }));
  if (m.k === 'ask') {
    if (!isStaff(a.glyphs)) { result(ws, m.nonce, { error: 'denied' }); return; }
    // STAFF-PANEL5-FOLLOW-FIX (the relay review's finding 6): a hidden staff socket (staffHidden.js `hid`) is in no list -
    // matched here, a Dungeon Master's /tp @Staff member went unanswered where a stranger's said `offline`
    const peers = [...room._all()].filter(([other, b]) => b.id && !b.hid && !room._dead.has(other) && !room._gone.has(other));
    let hits;
    if (m.id) hits = peers.filter(([, b]) => b.id === m.id);
    else {
      const name = fold(m.name);
      const exact = peers.filter(([, b]) => fold(b.name) === name);
      hits = exact.length ? exact : peers.filter(([, b]) => fold(b.name).startsWith(name));
    }
    if (hits.length !== 1) { result(ws, m.nonce, { error: hits.length ? 'ambiguous' : 'offline' }); return; }
    const [target, b] = hits[0];
    const acct = typeof b.sub === 'string' ? { acct: b.sub } : {};
    const quiet = m.nt === 1 && quietTeleportAllowed(a.glyphs);
    if (quiet && m.cap !== 1) {
      const note = b.sub ? noteOf(room, b.sub, now) : null;
      if (note) { result(ws, m.nonce, { id: b.id, name: b.name, ...acct, via: 'note', note: note.p, ag: Math.floor((now - note.at) / 1000) }); return; }
    }
    if (a.hid) { result(ws, m.nonce, { error: 'unavailable' }); return; }   // STAFF-PANEL5-HIDDEN-FIX: a hidden asker is answered from the note alone - a capture would tell a modded game staff came
    const fb = quiet ? (m.cap === 1 ? 'mismatch' : 'missing') : null;
    if (fb) console.info('[stp] the target\'s game is asked: its where note is', fb);
    for (const [ticket, p] of pending) if (p.from === ws) pending.delete(ticket);
    if (pending.size >= 128) { result(ws, m.nonce, { error: 'busy' }); return; }
    const ticket = crypto.randomUUID();
    pending.set(ticket, { from: ws, target, id: b.id, nonce: m.nonce, expires: now + STAFF_TP_TIMEOUT_MS, ...(fb ? { fb } : {}) });
    if (!room._send(target, JSON.stringify({ t: 'stp', k: 'capture', ticket }))) {
      pending.delete(ticket); result(ws, m.nonce, { error: 'offline' });
    }
    return;
  }
  const p = pending.get(m.ticket);
  if (!p || p.target !== ws || p.id !== a.id) return;
  pending.delete(m.ticket);
  const asker = room._all().get(p.from);
  if (!asker?.id || room._dead.has(p.from) || room._gone.has(p.from) || !isStaff(asker.glyphs)) return;
  result(p.from, p.nonce, m.error ? { error: m.error } : { id: a.id, name: a.name, ...(typeof a.sub === 'string' ? { acct: a.sub } : {}), dest: m.dest, ...(p.fb ? { fb: p.fb } : {}) });
}
