// REP1 + REP5 (2026-09-29, the reputation overhaul - systems/standing.js holds its law): THE WATCH'S STOP AND THE LAW'S
// NOTICES, for the two street hosts (world.js, exterior.js). One home, so the hosts cannot disagree about when the watch
// stops a known criminal or what a changed standing says.
//
// THE STOP (Mac: "Challenged on sight"). DFU's watch came for a hated name by a 5% roll every game minute - no guard
// needed to be anywhere near. Here a wandering GUARD who can SEE the player (cityGuards.js guardSeesPlayer: the witness
// arm's own eye, the line clear) stops a known criminal - a standing under -10 in the region, or a banishment standing
// (standing.js knownCriminal) - at most once in two game hours per region and never inside the grace an answered law
// gives. The box asks three things:
//   P - pay the fine on the spot (the court's own Conspiracy penalty, in coin; double when banished) - a day's grace;
//   S - come quietly: a Criminal Conspiracy, charged once, and the court - whose sentence gives the charge back (REP2);
//   R - refuse: the Conspiracy held and the watch called as a seen crime calls it (the chase, DFU's own from there).
// The box has no Escape: the watch wants an answer. Only on the street, never under another window, never in a trial,
// never for a transformed lycanthrope (DFU's SuppressCrime: the beast is nobody's face), never on a crime already held
// (the chase is already under way).
import { ChoiceWindow } from '../ui/talkWindow.js';
import { challengeDue, noteChallenge, challengeFine, grantGrace, settleChallenge, isBanished } from '../systems/standing.js';
import { totalGoldAmount, deductGold, CRIMES, CRIME_NAMES, setLegalRepNotifier } from '../systems/court.js';
import { racialSuppressCrime } from '../systems/lycanthropy.js';
import { legalStandingWord } from '../systems/legalBands.js';
import { t } from '../systems/textManager.js';
import { isInvisible } from '../systems/effects.js';

/** How often the street is looked over for a guard who can see a known criminal: once a second, not every frame. */
export const STANDING_LOOK_MS = 1000;

export function createStandingWatch({
  playerEntity, townTalk, arrestFlow, cityGuards,
  guardPool, playerFeet, regionIndex, regionName = () => 'this region',
  ownNow, worldNow = ownNow,
  crimeResponse,                 // the host's seen-crime response (SpawnCityGuards(true))
  onStreet = () => true,         // the exterior mode, the player standing in it
  blocked = () => false,         // another window, the travel view, a raid - anything the stop must wait out
  clock = () => performance.now(),
}) {
  let next = 0;
  let box = null;

  /** Look the street over (the host's exterior frame). Answers whether the watch stopped the player. */
  function frame() {
    const t = clock();
    if (t < next) return false;
    next = t + STANDING_LOOK_MS;
    if (box || !onStreet() || blocked()) return false;
    if (playerEntity.crimeCommitted || playerEntity.arrested || arrestFlow.inCourt()) return false;
    if ((playerEntity.health ?? 0) <= 0 || racialSuppressCrime(playerEntity)) return false;
    // AUDIT REP F7: an invisible criminal is nobody's face either - the witness arm's own gate (town.gate's isInvisible,
    // DFU's S19); guardSeesPlayer measures a line and a cone, not a spell, and the watch stopped a player it cannot see
    if (isInvisible(playerEntity)) return false;
    const region = regionIndex();
    const clocks = { ownNow: ownNow(), worldNow: worldNow() };
    if (!challengeDue(playerEntity, region, clocks)) return false;
    if (!cityGuards.guardSeesPlayer({ playerFeet: playerFeet(), pool: guardPool() })) return false;
    noteChallenge(playerEntity, region, clocks.ownNow);
    open(region, clocks);
    return true;
  }

  function open(region, clocks) {
    const name = regionName(region);
    const banished = isBanished(playerEntity, region, clocks.worldNow);
    const fine = challengeFine(playerEntity, region, clocks);
    const canPay = totalGoldAmount(playerEntity) >= fine;
    const lines = [
      banished ? `Halt! You are banished from ${name}.` : `Halt! The watch of ${name} knows your face.`,
      canPay ? `Pay a fine of ${fine} gold${banished ? ' and be gone' : ''}, or come with me.` : 'You will come with me.',
    ];
    const answer = (fn) => () => { if (box !== win) return; box = null; fn(); };
    const options = [
      ...(canPay ? [{ code: 'KeyP', label: `P - pay ${fine} gold`, action: answer(() => {
        deductGold(playerEntity, fine);
        settleChallenge(playerEntity, region);   // FINE-MENDS: the fine mends the name a penance's step, to the line at most
        grantGrace(playerEntity, region, ownNow());
        townTalk.say?.(`You pay the watch ${fine} gold.`);
      }) }] : []),
      { code: 'KeyS', label: 'S - come quietly', action: answer(() => { arrestFlow.surrenderToChallenge(); }) },
      { code: 'KeyR', label: 'R - refuse', action: answer(() => {
        playerEntity.crimeCommitted = CRIMES.Criminal_Conspiracy;   // the levy's own write (WERE-LEVY: the field)
        crimeResponse();
      }) },
    ];
    const win = new ChoiceWindow({ lines, options });
    // A box thrown away unanswered (another window replaced it) is the stop let go: the two hours' wait is already noted
    win.dispose = () => { if (box === win) box = null; };
    box = win;
    townTalk.showOverlay(win);
  }

  return { frame, get box() { return box; } };
}

/** REP5: THE LAW SAYS WHEN IT THINKS DIFFERENTLY OF YOU. DFU changes a legal standing in silence - a crime's charge, a
 *  sentence's credit, a quest's `legal repute` - and a player learned their name from the watch. Every change a cause
 *  moved (court.js changeLegalRep's `cause`; the drift writes the store directly and stays silent) is said as a line on
 *  the HUD, with the band it leaves the player in. Answers the uninstall. */
export function installLegalNotices({ playerEntity, say, regionName = () => 'this region' }) {
  setLegalRepNotifier(({ player, regionIndex, after, delta, cause }) => {
    if (player !== playerEntity) return;
    say(legalNoticeLine({ name: regionName(regionIndex), after, delta, cause }));
  });
  return () => setLegalRepNotifier(null);
}

/** SENTENCE-MENDS (FIELD BUGS 2026-10-21d): a sentence served mends the name a penance's step - said apart from the
 *  charge it gave back ("Your debt ... is paid"). */
const SERVED_TEXT = 'Time served mends your name in {name} ({by}). You are {word}.';

/** The notice's words. */
export function legalNoticeLine({ name, after, delta, cause }) {
  const word = legalStandingWord(after);
  const by = `${delta > 0 ? '+' : ''}${delta}`;
  switch (cause?.kind) {
    case 'crime': return `${CRIME_NAMES[cause.crime] ?? 'A crime'}: the law of ${name} thinks less of you (${by}). You are ${word}.`;
    case 'sentence': return `Your debt to ${name} is paid (${by}). You are ${word}.`;
    case 'acquittal': return `The court of ${name} clears your name (${by}). You are ${word}.`;
    case 'penance': return `Your penance is accepted in ${name} (${by}). You are ${word}.`;
    case 'served': return t('standing.notice.served', SERVED_TEXT, { name, by, word });
    case 'contract': return `${name} thanks you for your work (${by}). You are ${word}.`;
    case 'raid': return `${name} thanks you for its defense (${by}). You are ${word}.`;   // AUDIT REP F5
    default: return `Your standing with the law of ${name} ${delta < 0 ? 'falls' : 'rises'} (${by}). You are ${word}.`;
  }
}
