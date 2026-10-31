// @ts-check
// VEIL-PARTY (2026-10-27; bible/03-World/Eltheric-Ocean.md VEIL-PARTY) - A PARTY CROSSES THE VEIL TOGETHER. The
// crossing is the captain's (world.js etherCross). Her party aboard never holds it back (`kin`); a stranger still does.
// A member aboard her (`step`) keeps her captain, their side of the Veil and the pixel her deck last carried them in;
// when the captain's party pose stands across it within VEIL_FOLLOW_MS of stepped time, a member still where she left
// them follows by the party's own journey, landing beside the captain, no fare, the crossing's CROSS_DAYS. Nothing new
// rides the wire. Built by the world host. Not a DFU member: DFU has no Veil.
import { memberPresent } from '../../systems/party/partyRestLaw.js';
import { besideTargetOf } from '../../systems/party/partyTravelLaw.js';
import { CROSS_DAYS } from '../../systems/naval/etherCrossing.js';
import { inEther } from '../../world/ethericSea.js';
import { t } from '../../systems/textManager.js';

/** How long after my last frame aboard her a crossing of her captain's is followed (ms): her jump, her landfall built
 *  and her first pose there. AUDIT HORIZONTAL C5: counted in the frames the world steps, so a window open or the game
 *  paused while she crosses spends none of it. */
export const VEIL_FOLLOW_MS = 60_000;
/** AUDIT HORIZONTAL C1: how far from the pixel her deck last carried me I may be and still follow (map pixels) - the
 *  water she left me in, or the next pixel for a swimmer at its edge. A journey of my own, a temple after a death or
 *  another's deck is no longer where she left me. */
export const VEIL_STAY_PX = 1;
/** The words. */
export const VEIL_PARTY_TEXT = Object.freeze({
  follow: (name) => t('veil.party.follow', '{name} sails across the Veil. You cross with the ship.', { name }),
  landed: (name) => t('veil.party.landed', 'You cross the Veil with {name}.', { name }),
  missed: (name) => t('veil.party.missed', 'You could not cross the Veil with {name}.', { name }),
});

/** The journey that follows `name`'s crossing to pixel `to`: a pick the party's journey lands beside them (`row()` their
 *  party row, read when the far end is built), no fare, CROSS_DAYS long. Pure. */
export function veilJourney(to, name, row) {
  return {
    pick: {
      pixel: { x: to.x, y: to.y },
      name,
      veil: true,
      besideAt: () => {
        const r = row();
        return r && memberPresent(r) ? besideTargetOf(r.p, to.x, to.y) : null;
      },
      besideText: VEIL_PARTY_TEXT.landed(name),
    },
    opts: { speedCautious: false, travelShip: true, sleepModeInn: false },
    computed: { minutes: CROSS_DAYS * 1440, totalCost: 0, piecesCost: 0, oceanPixels: 0 },
  };
}

/**
 * deps = { social() -> net/social.js's picture (others(), accountOfPeer, isPartyPeer) | null, aboard() -> CSA-K's aboard
 * ({ owner }) | null, here() -> my travel pixel, across(x, y) -> past the Veil (optional; world/ethericSea.js inEther),
 * ready() -> outdoors, on my feet, nothing moving me, travel(pick, opts, computed) -> Promise<boolean> (the party's
 * journey), say(text) }
 * @param {any} deps
 */
export function createVeilParty(deps) {
  /** @type {{ acct: string, side: boolean, x: number, y: number, off: number, tried: { x: number, y: number } | null } | null} */
  let rode = null;
  const across = deps.across ?? inEther;
  let following = false;
  const rowOf = (acct) =>
    deps
      .social?.()
      ?.others?.()
      .find((m) => m.acct === acct) ?? null;

  /** A rider aboard my ship is my party's: never holds the crossing back. */
  const kin = (id) => !!deps.social?.()?.isPartyPeer?.(id);

  /** One frame the world steps (`dt` seconds): aboard her, the place and the window start again; off her, the window
   *  runs and I am held to where she left me. */
  function step(dt = 0) {
    if (following) return;
    const here = deps.here();
    const owner = deps.aboard?.()?.owner ?? null;
    const acct = owner ? (deps.social?.()?.accountOfPeer?.(owner) ?? null) : null;
    if (acct && rowOf(acct)) rode = { acct, side: !!across(here.x, here.y), x: here.x, y: here.y, off: 0, tried: null };
    else if (rode) {
      rode.off += Math.max(0, Number(dt) || 0) * 1000;
      const moved = Math.max(Math.abs(here.x - rode.x), Math.abs(here.y - rode.y)) > VEIL_STAY_PX;
      if (owner || moved || rode.off > VEIL_FOLLOW_MS || !!across(here.x, here.y) !== rode.side) rode = null;
    }
    if (!rode) return;
    const row = rowOf(rode.acct);
    if (!row || !memberPresent(row) || !!across(row.p.px, row.p.py) === rode.side || !deps.ready()) return;
    if (rode.tried && rode.tried.x === row.p.px && rode.tried.y === row.p.py) return; // the landing that failed, not asked again
    const left = rode,
      name = row.name || t('veil.party.captain', 'your captain');
    const to = { x: row.p.px, y: row.p.py };
    following = true;
    rode = null;
    deps.say(VEIL_PARTY_TEXT.follow(name));
    const j = veilJourney(to, name, () => rowOf(left.acct));
    Promise.resolve(deps.travel(j.pick, j.opts, j.computed))
      .catch(() => false)
      .then((went) => {
        following = false;
        if (went) return;
        deps.say(VEIL_PARTY_TEXT.missed(name));
        // sent back where she left me: she may have sailed on from that pixel, so her next one is followed in the window
        rode = { ...left, tried: to };
      });
  }

  return { step, kin, following: () => following };
}
