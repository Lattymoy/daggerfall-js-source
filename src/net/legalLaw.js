// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TERMS1 — THE TERMS OF SERVICE AND THE PRIVACY POLICY, AS BOTH ENDS
// SEE THEM.
//
// 2026-09-28: "Here is our terms of service and privacy policy. I wanna
// make sure these need to be reviewed and checked off by players before
// creating an account".
//
// ONE HOME BOTH ENDS, the move handleShape.js made for the name shapes:
// the Create account form sends the versions a player ticked, and the
// account service refuses to make an account unless they are the
// versions it holds (server-account/src/accounts.js `legalRefusal`).
// Neither end may keep its own copy. A form and a service that disagree
// about which text is current would record an agreement to words nobody
// showed the player.
//
// A VERSION IS ITS DOCUMENT'S "LAST UPDATED" DATE, because that is how
// the Terms say a revision is marked (section 15). The pages carry it as
// `<time datetime>`, and test/ui/enhanced/terms1.test.js holds each page's date to
// its version here and each page's words to a hash - so the text cannot
// change without somebody deciding whether that is a new version.
//
// A NEW VERSION IS A DEPLOY OF BOTH ENDS. The site and the account
// Worker ship separately, so for the minutes between them a player on
// the other side is told the documents changed and to reload. That is
// the price of never recording a version the service does not hold.
//
// THE URLS ARE ABSOLUTE ON PURPOSE. The desktop app loads the game from
// its own dagger:// scheme, and a relative link would open the copy
// bundled with that build, in a window of the app (app/main.cjs allows
// dagger:// window-opens) - the text as it stood when the app was built.
// An http(s) link goes to the system browser, which shows the live text:
// the one the service holds. (AUDIT PRE-MERGE 0929 T4: this said a
// relative link "would open nothing there".)
// ═══════════════════════════════════════════════════════════════════

/** The Terms of Service a new account agrees to - its Last Updated date. SAFE7 (2026-10-17,
 *  bible/11-Multiplayer/Chat-Safety-Arc.md): a new version - the conduct section names hate by what it attacks and the
 *  in-game Code of Conduct as part of the Terms, a change in substance, so a new date.
 *  BR5 (2026-10-11): the operator's name became DFO Online in both
 *  documents and nothing else did - the same project and the same terms
 *  under its new name, so the same version, the words re-hashed
 *  (test/ui/enhanced/terms1.test.js). A new version would refuse every account an
 *  older build tries to make (`terms-stale`), which a rename does not
 *  earn (AUDIT BR5). */
export const TERMS_VERSION = '2026-10-17';

/** The Privacy Policy a new account agrees to - its Last Updated date (BR5,
 *  as the Terms). SAFE5 (2026-10-17): a new version - stamped messages and reports, the automated review of public chat
 *  by a third-party AI provider, the block list and the moderation record, and how long each is kept. */
export const PRIVACY_VERSION = '2026-10-17';

/** What a version looks like. A dated answer that is not the current one
 *  is a player who ticked text the service no longer holds (an old tab, a
 *  cached build) - told to reload, not to tick a box they already ticked. */
export const LEGAL_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Where each document is read. The site serves terms/index.html and
 *  privacy/index.html (vite.config.js) at these paths. */
export const TERMS_URL = 'https://daggerfalljs.dev/terms/';
export const PRIVACY_URL = 'https://daggerfalljs.dev/privacy/';

/** What a request that makes an account carries: the versions ticked. */
export const ACCEPTED = Object.freeze({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION });
