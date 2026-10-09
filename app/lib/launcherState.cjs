// DA8 (2026-09-29, Mac: "How can we drastically improve the install
// experience? Is there anyway to send a notification that a new update is
// available ... A launcher? I really want to make it AAA grade"):
// THE LAUNCHER'S PURE HALF - what the first window is doing, what it says,
// and what happens next.
//
// WHY A LAUNCHER, AND WHY THIS ONE. The shell opened straight into the
// game and updated on QUIT (DA7). With a release on every merge - eleven
// on 2026-09-28 alone - a player launched into the build before the last
// one nearly every time, and online that means a client a protocol behind
// the relay it is talking to (world117 to world125 in three days). They
// were never told an update existed, arrived, or what it changed. And the
// first run was a bare OS folder dialog before any window.
//
// A separate launcher PROGRAM would fix none of that and add a second
// thing to install, sign and update - the updates themselves are already
// small (a Windows update between two releases is ~4.5 MB of a 208 MB
// installer: electron-updater's blockmap delta, measured off the releases'
// own blockmaps). So the launcher is the shell's FIRST WINDOW: it checks,
// updates BEFORE play when it can (the download shown, the install silent,
// the app reopening itself), says what changed, finds the player's
// Daggerfall files, and hands over to the game.
//
// DA10 (2026-09-29, Mac: "So this is an actual launcher now? Like
// warframe?" - and to the offer of one that stays open with a Play
// button, the patch notes and the player's options: "Yes please"):
// THE LAUNCHER STAYS. DA8's window was Discord's - a splash that went
// away by itself whenever it had nothing to ask. Now it is the game's
// front door, the way Warframe's is: it opens on every launch and waits
// for PLAY, with the patch notes as its news (the versions installed since
// the player last played marked NEW, one on its way marked UPDATE), the
// update's progress in its status bar, and the player's own doors beside
// them - the game files, the saves folder, the update check, a reinstall.
// Play is held only while an update is being checked for, fetched or
// installed, or while the game has no files; "Play without updating" is
// the one way past a download. An install never interrupts the player's
// own screens: it waits for the game files to be chosen (and, in the
// shell, for an open dialog), and the launcher reopens on the new version.
//
// Pure, no Electron: the shell (app/main.cjs) feeds events in and renders
// `viewOf` into app/launcher/; test/da8_launcher.test.js and
// test/da10_launcher.test.js drive every screen and transition here.
'use strict';

const { parseReleaseTag, parseVersion } = require('./updateCheck.cjs');

/** How long the launcher waits on a silent network before Play is free.
 *  A launch that hangs on GitHub is worse than one a build behind (DA6's
 *  failure direction: silence) - and a late answer still lands (reduce). */
const CHECK_TIMEOUT_MS = 8000;
/** How often a running copy asks again - a long session, or a launcher
 *  left open, hears of a release within the hour. */
const RECHECK_MS = 60 * 60 * 1000;
/** The most releases the news lists. */
const NEWS_MAX = 8;
/** How long "Installing" stays on screen before the app closes for the
 *  installer - long enough to read that it will reopen by itself. */
const INSTALL_NOTICE_MS = 1500;
/** How long the launcher waits for the installer to close the app before
 *  it decides the install never started, and frees Play. */
const INSTALL_GIVEUP_MS = 15000;
/** How long the first run waits on the search for the player's files
 *  before it offers what it has found. The search goes on past it (AUDIT
 *  INSTALL R2-D4: a Steam library on a drive spinning up, a Mac's privacy
 *  prompt answered late) and a later find is added to the card. */
const DETECT_DEADLINE_MS = 5000;
/** How long a look at ONE folder - the saved one at launch, a found one
 *  taken, the saved one tried again - may take before it is called out of
 *  reach (app/lib/arena2Probe.cjs, a process of its own). */
const JUDGE_DEADLINE_MS = 5000;
/** ...and a folder the player picked, which may be searched under. */
const PICK_DEADLINE_MS = 15000;
/** How long a download may go without a PROGRESS EVENT (they come a
 *  second or more apart) before the launcher calls it failed and frees
 *  Play. electron-updater's own socket timeout never arms under Electron's
 *  net module (it waits on a `socket` event that net.ClientRequest does
 *  not have), so a stalled download has no end but this one - and it is
 *  the launcher's end only: electron-updater 6.8.9 never wires the cancel
 *  to its request, which stays open, idle (AUDIT INSTALL R2-A11). */
const DOWNLOAD_STALL_MS = 45000;

/** Where a found ARENA2 came from, in the player's words. */
const SOURCE_LABEL = Object.freeze({
  dfu: 'from Daggerfall Unity',
  steam: 'Steam',
  gog: 'GOG',
  folder: 'on this computer',
});

/** [a, b, c] against [x, y, z]: negative, zero or positive. */
const cmpV = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

/**
 * update.status
 *   skipped     the update check is off (the launcher's toggle, the File
 *               menu's checkbox, or the probe env) - Play
 *   checking    asked, no answer yet - Play waits
 *   current     this is the newest release - Play
 *   offline     no answer (unreachable, an error, or CHECK_TIMEOUT_MS) - Play
 *   downloading the updater transport found one and is fetching it - Play
 *               waits, "Play without updating" does not
 *   background  the player chose to play first: it downloads on, installs at quit
 *   installing  downloaded: install now, and the app reopens itself
 *   failed      the download stopped (an error, or DOWNLOAD_STALL_MS without a
 *               byte) - Play; the hourly re-check or the next launch tries again
 *   stuck       downloaded, but the installer did not take over - this launch,
 *               or the last one tried and the app is still on this version
 *               (installFailedFor): Play, and the installer to run by hand.
 *               It is never tried before play again, so a failing installer
 *               cannot close the app on every launch.
 *   notice      the notice transport found one: Download it, or Play this one
 * setup.status
 *   checking the folder config.json keeps (setup.dir) is being looked at, in
 *            a process of its own (AUDIT INSTALL R2-D1) - the front door
 *            shows, Play waits; whole it is ready, not whole it is named
 *   ready    a whole ARENA2 is configured (setup.dir)
 *   skipped  the player chose the game's own picker - the website's path
 *            (kept in config.json, so it is asked once)
 *   looking  there is none: detection runs
 *   found    detection found whole folders - OFFERED, never picked silently
 *   none     detection found nothing - yet: `searching` while it goes on past
 *            its deadline, and a later find is added (found-more)
 *   bad      the folder picked is not a whole ARENA2 (missing: which files,
 *            or null when it held no Daggerfall file at all; unreadable when
 *            it could not be read, `late` when it did not answer in time;
 *            `cut` when the search under it ran out of budget)
 *   judging  (beside any of the above) a folder the player named is being
 *            looked at
 *   saved    (beside any of the above) the folder config.json keeps, which is
 *            no longer whole - { dir, missing, unreadable } - named on the
 *            card with a Try again, never met with the first run's "Where is
 *            Daggerfall?" (AUDIT INSTALL L4-5)
 * news.status
 *   loading  the release list is being asked for (the cached one shows meanwhile)
 *   ready    it answered
 *   failed   it did not (the cached one stays)
 *   off      the update check is off, and this request is its own (the cached one shows)
 * launch: null, 'requested' (Play), 'started' (the game's window is coming up)
 */
function initialState({
  current, transport, platform = 'win32', checkEnabled, checkOnLaunch = checkEnabled, arena2Dir = null, savedDir = null,
  inGamePicker = false, savedArena2 = null, news = [], lastPlayed = null, returning = false, installFailedFor = null,
}) {
  const checking = !arena2Dir && typeof savedDir === 'string' && savedDir !== '';
  return {
    current: String(current ?? ''),
    transport,
    platform: String(platform),
    checkOnLaunch: !!checkOnLaunch,
    installFailedFor: parseVersion(installFailedFor) ? String(installFailedFor).trim() : null,
    lastPlayed: parseVersion(lastPlayed) ? String(lastPlayed).trim() : null,
    returning: !!returning,
    update: { status: checkEnabled ? 'checking' : 'skipped', version: null, percent: 0, transferred: 0, total: 0, download: null },
    setup: {
      status: arena2Dir ? 'ready' : checking ? 'checking' : inGamePicker ? 'skipped' : 'looking',
      dir: arena2Dir || (checking ? savedDir : null),
      found: [],
      missing: null,
      unreadable: false,
      late: false,
      cut: false,
      inGamePicker: !!inGamePicker,
      searching: false,
      judging: false,
      saved: !arena2Dir && !checking && typeof savedArena2?.dir === 'string'
        ? { dir: savedArena2.dir, missing: Array.isArray(savedArena2.missing) ? savedArena2.missing : null, unreadable: !!savedArena2.unreadable }
        : null,
    },
    news: { status: checkEnabled ? 'loading' : 'off', items: Array.isArray(news) ? news : [] },
    launch: null,
  };
}

const SETUP_WAITING = new Set(['found', 'none', 'bad']);
const SETUP_DONE = new Set(['ready', 'skipped']);
/** The update statuses Play waits for. */
const UPDATE_HOLDS = new Set(['checking', 'downloading', 'installing']);
/** The statuses a found update may arrive in: the launch check, a late
 *  answer after the timeout, or the hourly re-check while the launcher
 *  sits open (a newer notice replaces an older one). */
const MAY_FIND = new Set(['checking', 'offline', 'current', 'failed', 'notice']);
const clampPercent = (p) => Math.max(0, Math.min(100, Number(p) || 0));

/** Play can be pressed: nothing is being decided for the player, and the
 *  game has files - a configured folder, or the in-page picker. */
const canPlay = (s) => !s.launch && SETUP_DONE.has(s.setup.status) && !UPDATE_HOLDS.has(s.update.status);

/** The launcher's state after one event. Events that do not apply to the
 *  state they arrive in change nothing - an update found after Play, say,
 *  is the running game's to hear, not the launcher's. */
function reduce(state, ev) {
  const s = { ...state, update: { ...state.update }, setup: { ...state.setup }, news: { ...state.news } };
  const u = s.update, st = s.setup;
  switch (ev?.type) {
    case 'check-start':
      // the player turned the check on from the launcher
      if (u.status === 'skipped') u.status = 'checking';
      if (s.news.status === 'off') s.news.status = 'loading';
      break;
    case 'check-none':
      if (u.status === 'checking' || u.status === 'offline') u.status = 'current';
      break;
    case 'check-failed':
    case 'check-timeout':
      if (u.status === 'checking') u.status = 'offline';
      break;
    case 'check-available':
      if (s.launch || !MAY_FIND.has(u.status)) break;
      u.version = ev.version ?? null;
      if (s.transport === 'updater') {
        u.status = 'downloading';
        u.percent = 0; u.transferred = 0; u.total = Number(ev.total) || 0;
      } else {
        u.status = 'notice';
        u.download = ev.download ?? null;
      }
      break;
    case 'progress':
      if (u.status === 'downloading') {
        u.percent = clampPercent(ev.percent);
        u.transferred = Number(ev.transferred) || 0;
        u.total = Number(ev.total) || u.total;
      }
      break;
    case 'downloaded':
      if (u.status === 'downloading') {
        u.percent = 100;
        // a version whose install already failed is not tried before play again - the player is not locked out
        const failed = parseVersion(s.installFailedFor), v = parseVersion(u.version);
        u.status = failed && v && cmpV(v, failed) <= 0 ? 'stuck' : 'installing';
      }
      break;
    case 'download-failed':
      if (u.status === 'downloading') u.status = 'failed';
      break;
    case 'play-now':
      // "Play without updating": the download goes on and installs when the game quits (DA7)
      if (u.status === 'downloading') {
        u.status = 'background';
        if (canPlay(s)) s.launch = 'requested';
      }
      break;
    case 'install-failed':
      // the installer never took over (it would have closed the app): Play is free, and the installer is offered
      if (u.status === 'installing') u.status = 'stuck';
      break;
    case 'saved-judged':
      // the saved folder, looked at: whole it is the one; not whole it is NAMED on the card (L4-5), and the search runs
      if (st.status === 'checking') {
        if (typeof ev.dir === 'string' && ev.dir) { st.status = 'ready'; st.dir = ev.dir; break; }
        st.saved = { dir: st.dir, missing: Array.isArray(ev.missing) ? ev.missing : null, unreadable: !!ev.unreadable };
        st.dir = null;
        st.status = st.inGamePicker ? 'skipped' : 'looking';
      }
      break;
    case 'found':
      if (st.status === 'looking') {
        st.found = Array.isArray(ev.found) ? ev.found : [];
        st.status = st.found.length ? 'found' : 'none';
        st.searching = !!ev.searching;
      }
      break;
    case 'found-more':
      // R2-D4: a find after the deadline - offered, while the card still waits on the player
      if (SETUP_WAITING.has(st.status) && typeof ev.found?.dir === 'string' && !st.found.some((f) => f.dir === ev.found.dir)) {
        st.found = [...st.found, ev.found];
        if (st.status === 'none') st.status = 'found';
      }
      break;
    case 'detect-done':
      st.searching = false;
      break;
    case 'judging':
      st.judging = !!ev.on;
      break;
    case 'picked':
      // from the first run's card, or the Game files door at any time
      if (ev.dir && !s.launch) {
        st.status = 'ready'; st.dir = ev.dir; st.found = []; st.missing = null; st.unreadable = false; st.late = false; st.cut = false; st.saved = null;
        st.searching = false;   // the search is moot once the player has chosen (the shell lets its process go)
      }
      break;
    case 'picked-bad':
      if (SETUP_WAITING.has(st.status)) {
        st.status = 'bad';
        st.missing = Array.isArray(ev.missing) ? ev.missing : null;
        st.unreadable = !!ev.unreadable;
        st.late = !!ev.late;
        st.cut = !!ev.cut;
      }
      break;
    case 'saved-bad':
      // "Try again" on the saved folder, and it still is not whole: what it says now
      if (SETUP_WAITING.has(st.status) && st.saved) {
        st.saved = { ...st.saved, missing: Array.isArray(ev.missing) ? ev.missing : null, unreadable: !!ev.unreadable };
      }
      break;
    case 'skip-setup':
      if (SETUP_WAITING.has(st.status)) { st.status = 'skipped'; st.searching = false; }
      break;
    case 'play':
      if (canPlay(s)) s.launch = 'requested';
      break;
    case 'launching':
      s.launch = 'started';
      break;
    case 'news':
      if (Array.isArray(ev.items)) { s.news.items = ev.items; s.news.status = 'ready'; }
      break;
    case 'news-failed':
      if (s.news.status === 'loading') s.news.status = 'failed';
      break;
    case 'check-on-launch':
      s.checkOnLaunch = !!ev.on;
      break;
    default:
      break;
  }
  return s;
}

/**
 * What the shell does next: 'detect' (look for ARENA2), 'install' (quit
 * and install, reopening), 'launch' (open the game), or 'wait' (for an
 * answer, a download, or the player). Detection runs at once - it is
 * local, and the player can choose while an update downloads. The install
 * waits while the player is choosing their files: the folder picked
 * survives the restart, a screen cut off halfway does not.
 */
function nextStep(s) {
  if (s.launch === 'started') return 'wait';
  if (s.setup.status === 'looking') return 'detect';
  // AUDIT INSTALL R2-A8: until the game's files are SET - the saved folder still being looked at included
  if (s.update.status === 'installing') return SETUP_DONE.has(s.setup.status) ? 'install' : 'wait';
  if (s.launch === 'requested') return 'launch';
  return 'wait';
}

const mb = (bytes) => (Math.max(0, Number(bytes) || 0) / 1e6).toFixed(1);

/** Has this copy updated since the player last pressed Play? A copy with
 *  no lastPlayed that is RETURNING (config.json predates DA10) has: the
 *  build it runs now is the first to keep one. */
function justUpdated(s) {
  const cur = parseVersion(s.current), last = parseVersion(s.lastPlayed);
  if (!cur) return false;
  return last ? cmpV(cur, last) > 0 : s.returning;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-09-29T14:03:11Z' -> '29 Sep 2026' (UTC, the day GitHub stamped). */
function dateLabel(iso) {
  const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** GitHub's generated list of merged changes, which the release body carries
 *  under the patch notes (scripts/desktopRelease.mjs). A player reads the
 *  notes; the list of pull requests is the repository's record. */
const GENERATED_RE = /^(##\s*What['’]s Changed\b|\*\*Full Changelog\*\*|##\s*New Contributors\b)/m;

/** A release body as a player reads it: the patch notes, without the list. */
function playerNotes(body) {
  const text = String(body ?? '').replace(/\r\n/g, '\n');
  const cut = text.search(GENERATED_RE);
  return (cut < 0 ? text : text.slice(0, cut)).trim();
}

/** A release body that says nothing more than "fixes and improvements". */
const isPlaceholder = (t) => /^fixes and improvements\.?$/i.test(String(t).trim());

/**
 * The news, from the releases API's list: every published app-v release,
 * newest first, as { version, date, text } - the text its patch notes.
 * What the shell keeps in news.json and shows while the next list is
 * asked for. REL8: and `update`, the player's update number, where the
 * release's name says one (`Update 0.0.1` - release-desktop.yml names it
 * so); the installer's version stays what is compared.
 *
 * @param {Array<{ tag_name?: string, name?: string, body?: string, published_at?: string, draft?: boolean, prerelease?: boolean }>} releases
 * @returns {Array<{ version: string, date: string, text: string, update?: string }>}
 */
function newsFrom(releases) {
  if (!Array.isArray(releases)) return [];
  return releases
    .filter((r) => r && !r.draft && !r.prerelease)
    .map((r) => ({ v: parseReleaseTag(r.tag_name), date: typeof r.published_at === 'string' ? r.published_at : '', text: playerNotes(r.body), update: updateOfName(r.name) }))
    .filter((r) => r.v)
    .sort((a, b) => cmpV(b.v, a.v))
    .map((r) => ({ version: r.v.join('.'), date: r.date, text: r.text, ...(r.update ? { update: r.update } : {}) }));
}

/** REL8: a release's name that is a player's update - `Update 0.0.1` - and its number; anything else names none. */
const UPDATE_NAME_RE = /^Update (\d+\.\d+\.\d+)$/;
/** REL8: an update number as news.json keeps one. */
const UPDATE_NUMBER_RE = /^\d+\.\d+\.\d+$/;
function updateOfName(name) {
  return UPDATE_NAME_RE.exec(String(name ?? '').trim())?.[1] ?? null;
}

/** news.json as it was written - or as a hand, a crash or an older build
 *  left it: only well-formed items, newest first. */
function cachedNews(json) {
  const items = Array.isArray(json?.items) ? json.items : [];
  return items
    .filter((n) => n && parseVersion(n.version) && typeof n.text === 'string')
    .map((n) => ({ version: String(n.version).trim(), date: typeof n.date === 'string' ? n.date : '', text: n.text, ...(UPDATE_NUMBER_RE.test(n.update) ? { update: n.update } : {}) }))
    .sort((a, b) => cmpV(parseVersion(b.version), parseVersion(a.version)));
}

const NEWS_NOTE = Object.freeze({
  loading: 'Loading the patch notes',
  failed: 'The patch notes could not be loaded - GitHub did not answer.',
  off: 'The patch notes come with the update check, which is off.',
  ready: 'No patch notes yet.',
});

/**
 * The news panel: the releases that say something, newest first, at most
 * NEWS_MAX, each marked UPDATE (newer than this copy), NEW (installed
 * since the player last played) or neither. A bare "Fixes and
 * improvements." release is listed only when it is marked - the player is
 * told the version they got, or are getting, whatever its notes say - or
 * when no release says more.
 */
function newsView(s) {
  const cur = parseVersion(s.current), last = parseVersion(s.lastPlayed);
  const badge = (v) => {
    if (!cur) return null;
    const c = cmpV(v, cur);
    if (c > 0) return 'update';
    if (last ? cmpV(v, last) > 0 : s.returning && c === 0) return 'new';
    return null;
  };
  const items = s.news.items
    .map((n) => ({ n, v: parseVersion(n?.version) }))
    .filter((x) => x.v)
    .map(({ n, v }) => ({ version: v.join('.'), date: dateLabel(n.date), text: String(n.text ?? ''), badge: badge(v), ...(UPDATE_NUMBER_RE.test(n.update) ? { update: n.update } : {}) }));
  const said = items.filter((n) => n.badge || (n.text && !isPlaceholder(n.text)));
  const list = (said.length ? said : items.slice(0, 1)).slice(0, NEWS_MAX);
  return { items: list, note: list.length ? '' : NEWS_NOTE[s.news.status] ?? '' };
}

/**
 * The install the last launch tried (config.json installAttempt, written just
 * before the installer is handed the app): if this copy is still OLDER than
 * it, the installer did not take - `failed` is that version, and the marker
 * is kept until a version at least as new runs. Otherwise it is done with.
 */
function installAttemptFor(saved, current) {
  const a = parseVersion(saved?.version), c = parseVersion(current);
  if (!a || !c) return { failed: null, keep: false };
  return cmpV(a, c) > 0 ? { failed: String(saved.version).trim(), keep: true } : { failed: null, keep: false };
}

/** What a folder that is not a whole ARENA2 lacks, and where the whole one
 *  is - the launcher's card, its Game files door and File > Locate ARENA2
 *  say it in the same words. `missing` is judgeArena2's: the files it
 *  lacks, or null when it held no Daggerfall file at all. A folder that did
 *  not answer in time (`late`) or whose search ran out of budget (`cut`) is
 *  never told it "holds no Daggerfall files" (AUDIT INSTALL R2-D3). On a
 *  Mac the whole one is in DaggerfallGameFiles.zip - Steam and GOG sell
 *  Daggerfall for Windows only (L5-3, R2-E5). */
function notArena2Detail(missing, { unreadable = false, late = false, cut = false, platform = 'win32' } = {}) {
  // Steam's is DF/DAGGER/ARENA2; GOG's sits in the game's own folder, beside FALL.EXE (AUDIT INSTALL L4-6)
  const where = platform === 'darwin'
    ? 'Choose the arena2 folder inside the unpacked DaggerfallGameFiles.zip.'
    : 'Choose the ARENA2 folder inside your Daggerfall install - on Steam it is under DF/DAGGER/ARENA2, on GOG it is in the game\'s own folder.';
  if (late) return `It did not answer in time - is its drive asleep, or disconnected? ${where}`;
  if (unreadable) return `It could not be read - is its drive connected? ${where}`;
  if (Array.isArray(missing) && missing.length) return `It has no ${missing.join(', ')}. ${where}`;
  if (cut) return `It holds too many folders to look through them all. ${where}`;
  return `It holds no Daggerfall files. ${where}`;
}

/** The first run's card: what was found, or where to get it, or what the
 *  folder picked lacks. A found folder's "Use these files" is the card's
 *  answer only while it is the one thing found and nothing has been
 *  refused since (after a refusal Enter must not press the same folder
 *  again). On a Mac there is no Steam or GOG copy to get - both sell
 *  Daggerfall for Windows only - so the way in is DaggerfallGameFiles.zip
 *  (AUDIT INSTALL L5-3). */
function setupView(st, platform) {
  if (st.status === 'looking') return { title: 'Looking for your Daggerfall files', detail: '', found: [], actions: [] };
  const lead = st.found.length === 1 && st.status === 'found';
  const found = st.found.map((f, index) => ({ index, dir: f.dir, from: SOURCE_LABEL[f.source] ?? '', primary: lead }));
  const choose = { id: 'choose-folder', label: st.found.length ? 'Choose a different folder' : 'Choose the ARENA2 folder', primary: !st.found.length };
  const skip = { id: 'skip-setup', label: 'Choose in the game instead' };
  if (st.saved && st.status !== 'bad') {
    const sv = st.saved;
    return {
      title: sv.unreadable ? 'Your Daggerfall folder cannot be reached' : 'Your Daggerfall folder is not whole',
      detail: `Daggerfall Online plays from ${sv.dir}, which ${sv.unreadable ? 'cannot be read right now - is its drive connected?'
        : sv.missing ? `has no ${sv.missing.join(', ')}.` : 'holds no Daggerfall files any more.'}${st.found.length ? ' Daggerfall is also here:' : ''}`,
      found,
      actions: [{ id: 'retry-saved', label: 'Try again', primary: !st.found.length }, { ...choose, primary: false }, skip],
    };
  }
  if (st.status === 'found') {
    return {
      title: st.found.length === 1 ? 'Found your Daggerfall files' : 'Found Daggerfall on this computer',
      detail: 'Daggerfall Online plays from the original game\'s ARENA2 folder. Nothing is copied or uploaded - it is read where it is.',
      found,
      actions: [choose, skip],
    };
  }
  const zip = { id: 'open', arg: 'zip', label: 'Get DaggerfallGameFiles.zip' };
  if (st.status === 'none') {
    // R2-D4: a search still going on past its deadline says so - it has not concluded the files are not here
    const still = st.searching ? 'Still looking on slower drives - they are added here if they turn up. ' : '';
    if (platform === 'darwin') {
      return {
        title: 'Where is Daggerfall?',
        detail: `${still}Daggerfall Online plays from the original game's ARENA2 folder. The Elder Scrolls II: Daggerfall has been free since 2009 - on a Mac, get DaggerfallGameFiles.zip, unpack it, and choose the arena2 folder inside.`,
        found,
        actions: [choose, zip, skip],
      };
    }
    return {
      title: 'Where is Daggerfall?',
      detail: `${still}Daggerfall Online plays from the original game's ARENA2 folder. The Elder Scrolls II: Daggerfall has been free since 2009 - get it from Steam or GOG, then choose its ARENA2 folder.`,
      found,
      actions: [choose, { id: 'open', arg: 'steam', label: 'Get it on Steam' }, { id: 'open', arg: 'gog', label: 'Get it on GOG' }, skip],
    };
  }
  return {
    title: st.unreadable ? 'That folder cannot be read' : 'That folder is not a whole ARENA2',
    detail: notArena2Detail(st.missing, { ...st, platform }),
    found,
    // R2-E5: a Mac's refusal keeps the one door to the files a Mac can get
    actions: platform === 'darwin' ? [{ ...choose, primary: true }, zip, skip] : [{ ...choose, primary: true }, skip],
  };
}

/** The launcher window's whole content, from the state. */
function viewOf(s) {
  const u = s.update, st = s.setup;
  const v = {
    version: s.current ? `v${s.current}` : '',
    busy: false,
    status: '',
    detail: '',
    progress: null,
    statusActions: [],
    play: { enabled: canPlay(s), label: 'Play' },
    // the saved folder being looked at shows the front door - on a healthy disk the answer is back before the first paint
    panel: SETUP_DONE.has(st.status) || st.status === 'checking' ? 'news' : 'setup',
    setup: null,
    news: newsView(s),
    options: {
      files: st.status === 'ready' || st.status === 'checking' ? { path: st.dir, note: '', label: 'Change folder' }
        : st.status === 'skipped' ? { path: '', note: 'Chosen in the game', label: 'Choose folder' }
          : { path: '', note: 'Not set yet', label: 'Choose folder' },
      checkOnLaunch: s.checkOnLaunch,
    },
  };
  if (v.panel === 'setup') v.setup = setupView(st, s.platform);
  if (s.launch) {
    v.status = 'Starting Daggerfall Online';
    v.busy = true;
  } else if (u.status === 'installing') {
    v.progress = { percent: 100, label: 'Downloaded' };
    if (!SETUP_DONE.has(st.status)) {
      v.status = `v${u.version} is ready to install`;
      v.detail = 'It installs once your game files are set - then Daggerfall Online reopens by itself.';
    } else {
      v.status = `Installing v${u.version}`;
      v.detail = 'Daggerfall Online closes and reopens by itself in a few seconds. Your saves, settings and game files stay where they are.';
      v.busy = true;
    }
  } else if (u.status === 'downloading') {
    v.status = `Downloading v${u.version}`;
    v.detail = 'It installs before you play, so you are on the same version as everyone online.';
    v.progress = { percent: u.percent, label: u.total ? `${mb(u.transferred)} of ${mb(u.total)} MB` : 'Starting the download' };
    v.busy = true;
    if (SETUP_DONE.has(st.status)) v.statusActions = [{ id: 'play-now', label: 'Play without updating' }];
  } else if (u.status === 'checking') {
    v.status = 'Checking for updates';
    v.busy = true;
  } else if (u.status === 'notice') {
    v.status = `Version ${u.version} is out`;
    v.detail = `You have v${s.current}. Download it, quit, and put it in place of this copy - your saves, settings and game files stay where they are.`;
    v.statusActions = [{ id: 'download', label: 'Download', primary: true }];
  } else if (u.status === 'background') {
    v.status = `v${u.version} installs when you quit`;
    v.detail = 'It finishes downloading while you play.';
  } else if (u.status === 'failed') {
    v.status = `Could not download v${u.version}`;
    v.detail = 'The download stopped. This version plays as it is, and the update is tried again.';
  } else if (u.status === 'stuck') {
    v.status = `v${u.version} did not install`;
    v.detail = 'Play this version - it tries again when you quit. Or run the installer yourself: your saves, settings and game files stay where they are.';
    v.statusActions = [{ id: 'reinstall', label: 'Get the installer' }];
  } else if (u.status === 'offline') {
    v.status = 'Could not check for updates';
    v.detail = 'GitHub did not answer. This version plays as it is, and the next launch asks again.';
  } else if (u.status === 'skipped') {
    v.status = 'Update checks are off';
    v.detail = 'Turn them on under Updates to hear of new versions.';
  } else if (justUpdated(s)) {
    v.status = `Updated to v${s.current}`;
    v.detail = 'What changed is in the patch notes.';
  } else {
    v.status = 'Up to date';
  }
  // the gem breathes while anything is being looked for or at
  if (st.status === 'looking' || st.status === 'checking' || st.searching || st.judging) v.busy = true;
  return v;
}

/** DA12 (2026-10-08, Mac: "some game managers, like PlayNite, don't reconigze the launcher as a game and also I
 *  can't control the Launcher with a controller"): THE SWITCH PAST THE FRONT DOOR. A copy started with `--play`
 *  goes straight into the game - for a game manager or a couch (Playnite, Steam's Big Picture), which start a
 *  game and watch its process, and read an install-and-reopen before play as the game having quit. Updates are
 *  the game's then, as they always were after Play: checked at launch and hourly, told on the HUD, installed at
 *  quit or from File > Restart to Update. What the launcher must still ASK is still asked: with no game files
 *  chosen (the first run) the launcher opens as it would, and a saved folder is judged first (null: the
 *  launcher, whose card says what is wrong with it). Answers the folder to judge, '' for the game's own
 *  picker (chosen once, kept), or null for the launcher. */
const PLAY_SWITCH = '--play';
function directPlay(argv, cfg) {
  if (!Array.isArray(argv) || !argv.includes(PLAY_SWITCH)) return null;
  if (typeof cfg?.arena2Path === 'string' && cfg.arena2Path) return cfg.arena2Path;
  if (cfg?.arena2InGame === true) return '';
  return null;
}

module.exports = {
  CHECK_TIMEOUT_MS, RECHECK_MS, NEWS_MAX, INSTALL_NOTICE_MS, INSTALL_GIVEUP_MS, DOWNLOAD_STALL_MS, DETECT_DEADLINE_MS, JUDGE_DEADLINE_MS,
  PICK_DEADLINE_MS, SOURCE_LABEL, PLAY_SWITCH, installAttemptFor, directPlay,
  initialState, reduce, nextStep, viewOf, canPlay, justUpdated, dateLabel, playerNotes, newsFrom, cachedNews, notArena2Detail,
  UPDATE_NAME_RE, updateOfName,
};
