// FOES-HOLD (2026-10-21, bible/11-Multiplayer/Scale-Arc.md FOES-HOLD): A ROOM'S FIRST FRAMES WAIT THEIR TURN.
//
// FOES-FIRST put the full frames first on a room's foes budget, and where they alone are more than the budget (a
// Starfall's crowd: 40 owners of 80 sockets ask 2.4 times it in full frames) it left them first-come and blind to
// size: a refused frame was dropped, and the next one to arrive took whatever the bucket had refilled. A small frame
// always fits sooner than a large one, so ONE LARGE OWNER among smaller ones - a star's stander, its waves, its master
// and its circle on one owner, 48 records to 79 listeners - heard none of its full frames (tools/foesFirstBench.mjs
// `stander`: 0%), and the owners the draw happened to pass over waited 37 s between theirs (`star80`'s p99).
//
// So a frame that goes first is HELD when the budget cannot take it, and every held frame goes in its turn: the room's
// first frames are served first come, first served, ONE A SENDER A TURN - each sender in the place its first unserved
// frame took, a newer full frame of its replacing the older one IN that place (the readers want the newest list; the
// place is the sender's), and a sender with more held behind (a handover's batches) taking a new place at the back for
// each, so no sender's frames, however many or however large, keep another's from their turn. A held frame goes the
// moment the bucket holds its fan, and while any is held no other frame of the room spends the bucket: a delta waits
// behind the full frames as FOES-FIRST meant it to. And nothing of a sender overtakes its own held frame - the readers
// drop a frame whose `n` is not past the owner's last (scenes/exteriorFoes.js applyFoes, dungeonContext.js
// applyFoesFrame), so a delta that passed would turn the held full frame into one they refuse: it is dropped instead,
// and the held frame, which says everything it said, goes in its turn.
//
// No frame jumps the line: FOES-FIRST's handover went first once a second whatever waited, and a page that marks every
// record with an heir (the word is the sender's own) would take that turn every second at any size - with a line to
// jump, the whole budget. A handover waits its turn as any first frame does, and is never replaced and never ages out
// (the owner has let those foes go); its sender's leave gives what it still holds a last try (`_foesLeft`).
//
// What the hold keeps is bounded twice: four frames a sender, and FOES_HELD_BYTES_MAX of their TEXT a lane - the text,
// parsed again at its turn, because a parsed frame padded with empty objects weighs twenty times its length (AUDIT
// FOES-HOLD 2). Past the bytes, room is made from the sender holding the most (`roomFor`), so a few sockets holding
// the largest frames the wire takes cannot shut the room's honest owners out of the line.
//
// This module is the hold's own law - pure; the Room's methods wire it (server/src/index.js `_foesFan`, `_foesDrain`).
import { FOES_FRAME_MAX, FOES_FULL_RESERVE } from '../../src/net/wire.js';

/** FOES-HOLD: the most frames one sender holds on a lane - its newest full frame and the handovers behind it (world/
 *  foeHandover.js splits an owner's handed foes into frames of FOES_FRAME_MAX, so an owner of a few dozen foes with their
 *  loot hands them on in two or three); more is refused, counted as a drop. */
export const FOES_HELD_PER_SENDER = 4;
/** FOES-HOLD: the most bytes a lane holds, the frames' own lengths - 64 of the largest frame a lane takes, or 256
 *  sockets' 16 KiB full frames. A fan is the frame times its listeners, so this is the memory, not the budget - and the
 *  memory it is: a held frame is kept as the TEXT it came as and parsed again at its turn (AUDIT FOES-HOLD 2: kept
 *  parsed, a frame padded with empty objects held twenty-one times its length in the heap - 85 MiB for these 4 MiB, in
 *  an isolate of 128). Past it, room is made from the senders holding more than the frame's would (`holdFrame`), else
 *  the frame is refused, counted as a drop. */
export const FOES_HELD_BYTES_MAX = 64 * FOES_FRAME_MAX;
/** FOES-HOLD: a sender's turn in the line - its held frames' own lengths, the first whatever its size. 16 KiB: a full
 *  frame of a few dozen foes and a handover's batches beside it go in one turn; a page whose every frame is a 16 KiB
 *  "handover" sends one a turn, as any sender does. */
export const FOES_TURN_BYTES = 16 * 1024;
/** FOES-HOLD: how often a lane's held senders are asked whether their readers are owed a beat (`_foesBeats`) - a
 *  quarter of a second: a beat is owed at FOES_UNHEARD_MS of silence, and the readers let go at FOES_STALE_MS. */
export const FOES_BEAT_SCAN_MS = 250;
/** FOES-HOLD: how far a leaving sender's held handovers may put its lane's budget in debt (`_foesLeft`) - twice the
 *  reserve, one reserve past any first frame's floor. AUDIT FOES-HOLD 3: an owner going through a door or teleporting
 *  hands its foes on and closes its socket a few milliseconds after (net/online.js join -> leave), and in a crowded room
 *  its handover is held at the back of the line; tried at its leave on the first frames' own floor, against a bucket
 *  the line keeps near that floor, a star owner's was heard 22.5% of the time (65% before the hold). The floor is the
 *  ROOM's, not a leave's: all the leaves together put it no deeper, and the debt is repaid in half a second. */
export const FOES_LEFT_FLOOR = -2 * FOES_FULL_RESERVE;

/** A lane's hold: its frames in the order they took their places, the next place's number, the bytes held, and the
 *  turn under way (its sender and the bytes it has sent in it). */
export const createFoesHold = () => ({ entries: [], seq: 0, bytes: 0, turn: null });

/** The frames one sender holds, in their order. */
export const heldOf = (hold, ws) => hold.entries.filter((e) => e.ws === ws);

/** The frame whose turn it is - the one that took its place first. */
export function heldHead(hold) {
  let best = null;
  for (const e of hold.entries) if (!best || e.seq < best.seq) best = e;
  return best;
}

/** A frame out of the hold unsent - gone stale, or its sender gone. Answers whether it was held. */
export function unhold(hold, e) {
  const i = hold.entries.indexOf(e);
  if (i < 0) return false;
  hold.entries.splice(i, 1);
  hold.bytes -= e.length;
  if (hold.turn?.ws === e.ws) hold.turn = null;
  return true;
}

/** A held frame SENT, in its turn: out of the hold, and its sender's next held frame, if any, goes in the same turn
 *  while the turn's frames come to FOES_TURN_BYTES (a handover's small batches together, with the full frame they
 *  followed) - else it, and every frame of that sender behind it, takes a new place at the back: a turn is a sender's,
 *  and no sender's frames, however many or however large, keep another's from theirs. */
export function served(hold, e) {
  const turn = (hold.turn?.ws === e.ws ? hold.turn.bytes : 0) + e.length;
  unhold(hold, e);
  const mine = heldOf(hold, e.ws);
  if (mine.length && turn + mine[0].length <= FOES_TURN_BYTES) { mine[0].seq = e.seq; hold.turn = { ws: e.ws, bytes: turn }; return; }
  for (const next of mine) next.seq = hold.seq++;
}

/** AUDIT FOES-HOLD 2: ROOM IN THE HOLD, made fair. `over` bytes past FOES_HELD_BYTES_MAX are made by taking frames from
 *  the sender holding the most - each time the one that holds the most now, and only while it holds MORE than the
 *  frame's own sender will (`mine`, its bytes with the frame): its newest frame that is no handover first (a full frame
 *  its sender says again within the second), a handover only when it holds nothing else. So a sender holding little
 *  always finds a place while another holds much - a few sockets holding the largest frames they may cannot shut the
 *  room's honest owners out of the line (first come, first served, they did) - and a sender is never cut below what
 *  the frame's own will hold. Answers the frames taken, out of the hold (none when nothing was over), or null when no
 *  such room can be made - then nothing is taken. The frame's own sender is never the one: it holds more now than it
 *  will only when the frame replaces a larger one of its, and then nothing is over. */
function roomFor(hold, mine, over) {
  if (over <= 0) return [];
  const bytes = new Map();
  for (const e of hold.entries) bytes.set(e.ws, (bytes.get(e.ws) ?? 0) + e.length);
  const taken = [];
  while (over > 0) {
    let top = null, most = mine;
    for (const [s, b] of bytes) if (b > most) { top = s; most = b; }
    if (top === null) return null;
    const theirs = hold.entries.filter((e) => e.ws === top && !taken.includes(e));
    const e = theirs.findLast((x) => !x.hands) ?? /** @type {any} */ (theirs.at(-1));
    taken.push(e);
    bytes.set(top, most - e.length);
    over -= e.length;
  }
  for (const e of taken) unhold(hold, e);
  return taken;
}

/**
 * A first frame into the hold - `frame` is `{ ws, length, full, hands, at }` and whatever its Room keeps with it (the
 * frame's text, its listeners' range, its key), copied as it is. Answers `{ fate, gone }` - what became of it:
 *   'held'        it took a place of its own - a sender's first held frame its place in the line; one behind the
 *                 sender's own (a handover's next batch) a place after it
 *   'replaced'    a full frame, in the place of its sender's newest held frame when that is no handover (a full frame,
 *                 or an unheard sender's delta - a full frame says all either said)
 *   'refused'     past FOES_HELD_PER_SENDER, or past FOES_HELD_BYTES_MAX with no room to be made fairly (`roomFor`), or
 *                 a frame that is neither full nor a handover from a sender already holding one (that frame says
 *                 everything this one could, and goes in its turn)
 * - and the frames that left the hold unsent for it (`gone`): the one it replaced, as it was, and any taken to make it
 * room. Nothing changes on a refusal.
 */
export function holdFrame(hold, frame) {
  const mine = heldOf(hold, frame.ws);
  const last = mine.at(-1);
  const replace = frame.full && !frame.hands && last && !last.hands ? last : null;
  if (!replace && mine.length && !frame.full && !frame.hands) return { fate: 'refused', gone: [] };
  if (!replace && mine.length >= FOES_HELD_PER_SENDER) return { fate: 'refused', gone: [] };
  const out = replace ? replace.length : 0;
  const held = mine.reduce((sum, e) => sum + e.length, 0) - out + frame.length;
  const gone = roomFor(hold, held, hold.bytes - out + frame.length - FOES_HELD_BYTES_MAX);
  if (!gone) return { fate: 'refused', gone: [] };
  if (replace) {
    gone.unshift({ ...replace });
    hold.bytes += frame.length - replace.length;
    Object.assign(replace, frame);
    return { fate: 'replaced', gone };
  }
  hold.entries.push({ ...frame, seq: hold.seq++, since: frame.at });
  hold.bytes += frame.length;
  return { fate: 'held', gone };
}
