// @ts-check
// LEGACY7 part three (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9; Mac: "online integration with permadeath
// (Bloodline) or non-permadeath (Enduring)" - the design's "two players' characters may wed: both in the same temple,
// both asking the priest, the service records the union (each family names the other's member as spouse)"): THE
// WEDDING'S HANDSHAKE, AS A STATE MACHINE. Pure - no DOM, no game import: the socket, the account service and the house
// are handed in, so test/legacy7_wed.test.js drives two of these against each other over a fake wire and a real Worker.
//
// THE HANDSHAKE (net/wire.js's LEGACY7 header names the frames):
//   1. A PROPOSES (the Inspect card's Propose): `ask`. Each must stand in a temple, a realm character of a house, wed to
//      nobody (`can` - the house's law, scenes/legacyHost.js wedRefusal); the other's row must wear a house (`peerCan`).
//   2. B's PROMPT answers. No: `no declined`. Yes: B's HALF goes to the account service first (`half` - the handshake
//      and A's account and realm character as the relay stamped them), then `yes` - so a yes is a word the service
//      already holds.
//   3. A, ON THE YES: A's half (B's account and character as stamped). Both halves there, the service makes the union
//      and answers it - A records it (`onWed`) and says `done`.
//   4. B, ON THE DONE: asks the service (the union it made), and records it. A done lost on the way: B asks the service
//      itself WED_DONE_WAIT_MS after its yes - and every online boot reads the account's unions.
// Nothing a frame says makes a union: only the two halves at the service do, each naming the other's VERIFIED account
// and character (AUDIT LEGACY III O1: the character the player saw - the account alone let the other side post with
// whichever of its characters it leased after the yes). A crafted `yes` with no half behind it makes nothing; a crafted
// `done` makes B ask the service, which says no.
// AUDIT LEGACY III O3: A HALF IS TAKEN BACK whenever its player is told the wedding did not happen - B's ask after its
// yes, a `no` while B waits, A's half answered with no half of B's (`withdraw`, takeBack): a yes outlived what its
// player was told by five minutes, and a late half of the other's made the union after "the wedding did not happen".
// The withdraw's answer is the service's word - a union that stood first is recorded, never lost; a withdraw that never
// landed leaves the wedding `lapsed`, and a late `done` for it asks the service once more.
//
// Not a DFU member: Daggerfall Unity has no other players (Ledger A, ONLINE).

/** A proposal stands this long - the prompt's life - then lapses. */
export const WED_ASK_TTL_MS = 60_000;
/** After my yes, the asker's `done` is waited for this long before I ask the account service myself. */
export const WED_DONE_WAIT_MS = 20_000;
/** After I decline a player's proposal, or it lapses on me, their next is answered no, unprompted, for this long - a
 *  proposal is a prompt over my game, and one declined and sent again at once would be a way to fill it. */
export const WED_REASK_MS = 30_000;
/** The most proposals waiting on me at once. */
export const WED_INCOMING_MAX = 4;

/** Why a proposal came to nothing, in words (net/wire.js WED_WHY). `name` the other player. */
export function wedWhyText(why, name = 'They') {
  switch (why) {
    case 'declined': return `${name} declined your proposal.`;
    case 'busy': return `${name} cannot answer a proposal now.`;
    case 'temple': return 'A wedding is made in a temple - both of you must stand inside one.';
    case 'house': return 'Only two characters of houses (Project Legacy) can be wed in the realm.';
    case 'wed': return `${name} is wed already.`;
    case 'timeout': return 'No answer came - the proposal lapsed.';
    case 'cancelled': return `${name} took the proposal back.`;
    case 'refused': return 'The temple\'s book would not take the wedding.';
    default: return 'The wedding did not happen.';
  }
}

/** Why I cannot wed now, in words - my own side of WED_WHY (the Inspect card's reason, and a yes that came too late). */
export function wedMineText(why) {
  switch (why) {
    case 'house': return 'Only a character of a house (Project Legacy) can wed in the realm.';
    case 'wed': return 'You are wed already.';
    case 'temple': return 'A wedding is made in a temple - stand inside one together.';
    case 'busy': return 'Not now.';
    default: return 'The wedding did not happen.';
  }
}

/**
 * @param {object} o
 * @param {(data: any) => boolean} o.send - one wed frame out (net/online.js sendWed); true when it left the socket
 * @param {() => number} [o.now]
 * @param {(line: string) => void} [o.say]
 * @param {(peer: string) => (string|null)} [o.peerName]
 * @param {() => string} [o.selfId]
 * @param {() => (string|null)} [o.can] - why I cannot wed now (a WED_WHY code), or null
 * @param {(peer: string) => boolean} [o.peerCan] - whether the player's row wears a house
 * @param {(s: string, partner: string, partnerChar: string, opts?: { withdraw?: boolean }) => Promise<{ ok: boolean, wed?: boolean, union?: any, error?: string }>} o.half -
 *   my half of the wedding at the account service (realmSaves.js session wed) - the other's account and realm character
 *   as the relay stamped them; `withdraw` takes it back
 * @param {(peer: string) => void} [o.onPrompt] - a proposal at me: ask my player
 * @param {(peer: string) => void} [o.onUnprompt] - a proposal at me is gone (taken back, lapsed): its prompt closes
 * @param {(union: any, peer: string) => void} [o.onWed] - the union the account service made: recorded by the house
 * @param {(error: string) => string} [o.refusalText] - the account service's refusal, in words
 * @param {() => number} [o.rand]
 */
export function createWedManager({
  send, now = () => Date.now(), say = () => {}, peerName = () => null, selfId = () => '', can = () => null,
  peerCan = () => true, half, onPrompt = () => {}, onUnprompt = () => {}, onWed = () => {}, refusalText = () => wedWhyText('refused'),
  rand = Math.random,
}) {
  /** @type {{ peer: string, s: string, at: number } | null} */
  let outgoing = null;                 // my proposal
  /** @type {Map<string, { s: string, at: number, sub: string|null, sc: string|null }>} */
  const incoming = new Map();          // proposals at me, by peer
  /** @type {Map<string, number>} */
  const quiet = new Map();             // peer -> when I last declined them (or their proposal lapsed on me)
  /** @type {{ peer: string, s: string, at: number, sub: string|null, sc: string|null, posting: boolean, asked: boolean } | null} */
  let waiting = null;                  // I said yes (or am saying it): the asker's half, and its `done`, are owed
  /** @type {{ peer: string, s: string } | null} */
  let closing = null;                  // they said yes: my half is on its way to the account service
  /** @type {{ peer: string, s: string, sub: string|null, sc: string|null } | null} */
  let lapsed = null;                   // a wedding I was told did not happen, whose half's withdraw never landed
  const nameOf = (id) => peerName(id) ?? 'Someone';
  const mint = () => { let s = ''; while (s.length < 10) s += rand().toString(36).slice(2); return s.slice(0, 10).replace(/[^a-z0-9]/gi, '0').padEnd(10, '0'); };
  const once = (data) => { try { return send(data) === true; } catch { return false; } };
  /** An answer I owe nobody's wedding goes out at most once a peer each WED_REASK_MS (the duel's AUDIT DUEL1 A3): every
   *  answer spends my own outgoing budget, so a stranger's flood of proposals must not spend it for me. */
  const answered = new Map();
  const answer = (peer, frame) => {
    const t = now();
    if (t - (answered.get(peer) ?? -Infinity) < WED_REASK_MS) return false;
    if (answered.size > 64) for (const [p, at] of answered) if (t - at >= WED_REASK_MS) answered.delete(p);
    answered.set(peer, t);
    return once(frame);
  };
  const changed = () => { mgr.onChange?.(); };
  /** The union, recorded once a sid (the done and my own ask of the service may both land). */
  let recorded = '';
  const wedNow = (union, peer) => {
    if (!union?.sid || union.sid === recorded) return;
    recorded = union.sid;
    onWed(union, peer);
  };
  /** AUDIT LEGACY III O3: my half withdrawn - `{ ok, wed, union }`, the union when it stood first. A withdraw that never
   *  landed keeps the wedding `lapsed`, for a late `done`. */
  const withdrawHalf = async (/** @type {{ peer: string, s: string, sub: string|null, sc: string|null }} */ w) => {
    let r;
    try { r = await half(w.s, w.sub ?? '', w.sc ?? '', { withdraw: true }); } catch { r = { ok: false, error: 'offline' }; }
    if (!r?.ok) lapsed = { peer: w.peer, s: w.s, sub: w.sub, sc: w.sc };
    else if (lapsed?.s === w.s) lapsed = null;
    return r;
  };
  /** My half taken back, out of the player's way: a union that stood first is recorded (and `onWedded`). */
  const takeBack = (w, onWedded = () => {}) => {
    void withdrawHalf(w).then((r) => { if (r?.ok && r.wed) { wedNow(r.union, w.peer); onWedded(); changed(); } });
  };
  /** My yes, asked of the service (the done arrived, or it never did): the union if the service made it - and my half
   *  withdrawn if it did not, so "the wedding did not happen" stays true. */
  const askAgain = async (w) => {
    const r = await withdrawHalf(w);
    if (r?.ok && r.wed) { if (waiting === w) waiting = null; wedNow(r.union, w.peer); changed(); return; }   // recorded whatever came meanwhile
    if (waiting !== w) return;
    waiting = null;
    say(r?.ok ? `No word of ${nameOf(w.peer)}'s came to the temple. The wedding did not happen.` : refusalText(r?.error ?? 'server'));
    changed();
  };

  const mgr = {
    /** @type {(() => void) | null} */
    onChange: null,
    /** What the Inspect card should say about a peer: 'none' | 'incoming' | 'outgoing' | 'waiting' | 'busy'. */
    stateFor(/** @type {string} */ peer) {
      if (waiting || closing) return (waiting ?? closing)?.peer === peer ? 'waiting' : 'busy';
      if (incoming.has(peer)) return 'incoming';
      if (outgoing?.peer === peer) return 'outgoing';
      return outgoing ? 'busy' : 'none';
    },
    /** Propose to `peer` (the Inspect card's button). Their own standing proposal is not proposed over: it is answered
     *  on its prompt (`why: 'incoming'` - the host shows it again). */
    request(/** @type {string} */ peer) {
      const st = mgr.stateFor(peer);
      if (st === 'incoming') return { ok: false, why: 'incoming' };   // answered on its prompt (the host asks it again)
      if (st !== 'none') return { ok: false, why: st === 'outgoing' ? 'sent' : 'busy' };
      const no = can();
      if (no) return { ok: false, why: no };
      if (!peerCan(peer)) return { ok: false, why: 'house' };
      const s = mint();
      if (!once({ k: 'ask', to: peer, s })) return { ok: false, why: 'link' };
      outgoing = { peer, s, at: now() };
      say(`You ask ${nameOf(peer)} for their hand, here before the gods.`);
      changed();
      return { ok: true };
    },
    /** Say yes to `peer`'s proposal (the prompt): my half to the account service, then `yes`. */
    async accept(/** @type {string} */ peer) {
      const a = incoming.get(peer);
      if (!a || waiting || closing) return { ok: false, why: 'gone' };
      const no = can();
      if (no) { incoming.delete(peer); once({ k: 'no', to: peer, s: a.s, why: no }); changed(); return { ok: false, why: no }; }
      // the relay's stamps of who asked - their account and the character they stand as (O1); an older relay stamps neither
      if (!a.sub || !a.sc) { incoming.delete(peer); once({ k: 'no', to: peer, s: a.s, why: 'refused' }); changed(); return { ok: false, why: 'refused' }; }
      incoming.delete(peer);
      for (const [p, x] of incoming) once({ k: 'no', to: p, s: x.s, why: 'busy' });   // a yes answers every other proposal at me
      for (const p of incoming.keys()) onUnprompt(p);
      incoming.clear();
      if (outgoing) { once({ k: 'no', to: outgoing.peer, s: outgoing.s, why: 'cancelled' }); outgoing = null; }
      const w = { peer, s: a.s, at: now(), sub: a.sub, sc: a.sc, posting: true, asked: false };
      waiting = w;
      changed();
      let r;
      try { r = await half(a.s, a.sub, a.sc); } catch { r = { ok: false, error: 'offline' }; }
      // taken back while my half was on its way (their `no`): withdrawn now that it has landed - after it, never racing it
      if (waiting !== w) { if (r?.ok && r.wed) { wedNow(r.union, peer); changed(); } else takeBack(w); return { ok: false, why: 'cancelled' }; }
      if (!r?.ok) {
        waiting = null;
        takeBack(w);   // a refusal wrote nothing - but an answer lost on the way may have written it
        once({ k: 'no', to: peer, s: a.s, why: 'refused' });
        say(refusalText(r?.error ?? 'server'));
        changed();
        return { ok: false, why: 'refused' };
      }
      if (r.wed) { waiting = null; wedNow(r.union, peer); changed(); return { ok: true }; }   // their half was there first (crossed proposals)
      w.posting = false;
      w.at = now();
      if (!once({ k: 'yes', to: peer, s: a.s })) { waiting = null; takeBack(w); say(`${nameOf(peer)} could not be reached.`); changed(); return { ok: false, why: 'link' }; }
      say(`You said yes to ${nameOf(peer)}. The priest waits on their word.`);
      changed();
      return { ok: true };
    },
    /** Turn `peer`'s proposal down. */
    decline(/** @type {string} */ peer) {
      const a = incoming.get(peer);
      if (!a) return { ok: false };
      incoming.delete(peer);
      quiet.set(peer, now());
      once({ k: 'no', to: peer, s: a.s, why: 'declined' });
      changed();
      return { ok: true };
    },
    /** Take my proposal back. */
    withdraw() {
      if (!outgoing) return { ok: false };
      once({ k: 'no', to: outgoing.peer, s: outgoing.s, why: 'cancelled' });
      outgoing = null;
      changed();
      return { ok: true };
    },
    /** A frame from `from`, projected and addressed to me; `sub` the sender's account and `sc` their realm character, as
     *  the relay stamped them. */
    onFrame(/** @type {string} */ from, /** @type {any} */ d, /** @type {string|null} */ sub = null, /** @type {string|null} */ sc = null) {
      if (!d || typeof d.k !== 'string') return;
      switch (d.k) {
        case 'ask': {
          if (waiting || closing) { if ((waiting ?? closing)?.peer !== from) answer(from, { k: 'no', to: from, s: d.s, why: 'busy' }); return; }
          const no = can();
          if (no) { answer(from, { k: 'no', to: from, s: d.s, why: no }); return; }
          if (!peerCan(from)) { answer(from, { k: 'no', to: from, s: d.s, why: 'house' }); return; }
          if (outgoing?.peer === from) {
            // crossed proposals: the smaller id keeps its own, the other takes it up - one wedding, both words given
            if (from < selfId()) { outgoing = null; incoming.set(from, { s: d.s, at: now(), sub, sc }); void mgr.accept(from); }
            return;
          }
          if (incoming.size >= WED_INCOMING_MAX && !incoming.has(from)) return;
          if (!incoming.has(from) && now() - (quiet.get(from) ?? -Infinity) < WED_REASK_MS) { answer(from, { k: 'no', to: from, s: d.s, why: 'declined' }); return; }
          if (quiet.size > 64) for (const [p, at] of quiet) if (now() - at >= WED_REASK_MS) quiet.delete(p);
          const fresh = !incoming.has(from);
          incoming.set(from, { s: d.s, at: now(), sub, sc });
          if (fresh) { say(`${nameOf(from)} asks for your hand - answer on the prompt, or on their Inspect card.`); onPrompt(from); }
          changed();
          return;
        }
        case 'yes': {
          if (!outgoing || outgoing.peer !== from || outgoing.s !== d.s || closing) {
            if (!waiting && !closing) answer(from, { k: 'no', to: from, s: d.s, why: 'timeout' });   // a yes to a proposal no longer mine
            return;
          }
          const s = outgoing.s;
          outgoing = null;
          const no = can();
          if (no || !sub || !sc) { once({ k: 'no', to: from, s, why: no ?? 'refused' }); say(no ? wedMineText(no) : wedWhyText('refused')); changed(); return; }
          const c = { peer: from, s };
          closing = c;
          changed();
          void (async () => {
            let r;
            try { r = await half(s, sub, sc); } catch { r = { ok: false, error: 'offline' }; }
            if (closing !== c) return;
            closing = null;
            if (r?.ok && r.wed) { wedNow(r.union, from); once({ k: 'done', to: from, s }); }
            else {
              // told it did not happen: my half withdrawn (a union that stood first is recorded, and said done)
              takeBack({ peer: from, s, sub, sc }, () => once({ k: 'done', to: from, s }));
              once({ k: 'no', to: from, s, why: 'refused' });
              say(r?.ok ? `No word of ${nameOf(from)}'s came to the temple. The wedding did not happen.` : refusalText(r?.error ?? 'server'));
            }
            changed();
          })();
          return;
        }
        case 'no': {
          if (outgoing && outgoing.peer === from && outgoing.s === d.s) { outgoing = null; say(wedWhyText(d.why ?? 'declined', nameOf(from))); changed(); return; }
          if (waiting && waiting.peer === from && waiting.s === d.s) {
            const w = waiting;
            waiting = null;
            if (!w.posting) takeBack(w);   // my half landed: taken back (one on its way is taken back as it lands - accept)
            say(wedWhyText(d.why ?? 'cancelled', nameOf(from)));
            changed();
            return;
          }
          if (incoming.get(from)?.s === d.s) {
            incoming.delete(from); quiet.set(from, now()); onUnprompt(from);
            say(d.why === 'timeout' ? `${nameOf(from)}'s proposal lapsed.` : wedWhyText('cancelled', nameOf(from)));
            changed();
          }
          return;
        }
        case 'done': {
          // a done after I was told it did not happen, whose withdraw never landed: the service is asked once more
          if (lapsed && lapsed.peer === from && lapsed.s === d.s) { const w = lapsed; lapsed = null; takeBack(w); return; }
          if (!waiting || waiting.peer !== from || waiting.s !== d.s || waiting.posting || waiting.asked) return;
          waiting.asked = true;
          void askAgain(waiting);
          return;
        }
        default:
      }
    },
    /** The clock: a proposal of mine unanswered lapses (and says so to them); one at me lapses (its prompt closes); a yes
     *  of mine with no done in WED_DONE_WAIT_MS asks the account service itself. */
    tick() {
      const t = now();
      if (outgoing && t - outgoing.at > WED_ASK_TTL_MS) {
        once({ k: 'no', to: outgoing.peer, s: outgoing.s, why: 'timeout' });
        outgoing = null;
        say(wedWhyText('timeout'));
        changed();
      }
      for (const [p, a] of incoming) {
        if (t - a.at <= WED_ASK_TTL_MS) continue;
        incoming.delete(p);
        quiet.set(p, t);
        onUnprompt(p);
        changed();
      }
      if (waiting && !waiting.posting && !waiting.asked && t - waiting.at > WED_DONE_WAIT_MS) {
        waiting.asked = true;
        void askAgain(waiting);
      }
    },
    /** The players a proposal stands with - mine, and those at me (the host drops one whose row is gone: `gone`). */
    peers() { return [...(outgoing ? [outgoing.peer] : []), ...incoming.keys()]; },
    /** The player `peer` left (their row gone): what stood between us is dropped - a yes of mine still asks the
     *  service at its time, since their half may have landed. */
    gone(/** @type {string} */ peer) {
      if (outgoing?.peer === peer) { outgoing = null; changed(); }
      if (incoming.delete(peer)) { onUnprompt(peer); changed(); }
    },
  };
  return mgr;
}
