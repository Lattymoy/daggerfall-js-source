// @ts-check
// SAFE7 (2026-10-17, the chat safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md section 8): THE CODE OF CONDUCT -
// the rules every player agrees to before their first line, and the rules the reviewer (server-account/src/modAi.js)
// reads every line against. ONE TEXT FOR BOTH: the reviewer's prompt is built from these same lines in English, so a
// player is never held to a rule they were not shown, and a rule changed here changes for both at once.
//
// THE VERSION IS A DATE, as the Terms' are (net/legalLaw.js). A player's agreement records the version they read
// (players.conduct_v); a new version asks every player again at their next line. Move it when a rule changes in
// substance - never for a typo. The service says whether the code as it stands is agreed on every token's mint
// (`conduct`) - AUDIT SAFE CLIENT-1: carried by the page's minter (net/accountClient.js accountTokenMinter, which had
// dropped it, so the card never stood) to the gate (scenes/chatSafetyHost.js adopt); a page that agreed keeps its yes
// until it reloads, so a mint already in flight cannot ask again, and a version moved while a page is open is asked
// at its next load.
//
// WHY THE EDGY JOKE IS NAMED. The rule against hate says "not even as a joke" because the joke is the form it takes in a
// game's chat: "jokes" about pride flags, asexual players called attention-seekers. A rule that left it unsaid would be
// argued around in the first hour.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { t } from '../../systems/textManager.js';

/** The code's version - its date. A player who agreed to an older one is asked again. */
export const CONDUCT_VERSION = '2026-10-17';
/** What a version looks like. */
export const CONDUCT_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The code's title. */
export const conductTitle = () => t('net.conduct.title', 'Code of Conduct');
/** The rules, in the player's language - each a line of its own. */
export const conductRules = () => [
  t('net.conduct.respect', 'Treat everyone with respect. No harassment, bullying or threats, whether in chat, in names, in notes or anywhere else.'),
  t('net.conduct.hate', 'No hate. Never attack anyone for their race, ethnicity, nationality, religion, sex, gender identity, sexual orientation (asexuality included), disability or age, not even as a joke.'),
  t('net.conduct.sexual', 'No sexual remarks aimed at other players, and nothing sexual involving minors, ever.'),
  t('net.conduct.private', "Never share anyone's personal information, or ask for it."),
  t('net.conduct.spam', 'No spam, no scams, and no pretending to be staff.'),
  t('net.conduct.banter', 'Trash talk about the game is fine. Attacking people is not.'),
];
/** What follows a broken rule, and who reads a report. */
export const conductConsequence = () => t('net.conduct.consequence', 'Breaking these rules leads to a mute, then longer mutes, then a ban. Moderators read every report, and an automated reviewer helps them sort what comes in. /block hides a player from you; /report sends their lines to the moderators.');
/** The button that agrees. */
export const conductAgreeLabel = () => t('net.conduct.agree', 'I agree');
/** The button that puts it off - the line stays unsent. */
export const conductLaterLabel = () => t('net.conduct.later', 'Not now');
