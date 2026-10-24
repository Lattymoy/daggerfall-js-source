// REL4 (2026-09-29, Mac: "How can we drastically improve the install
// experience? ... I really want to make it AAA grade"): THE RELEASE IS
// PUBLISHED WHOLE, ONCE, WITH NOTES A PLAYER CAN READ.
//
// What the releases looked like before this, read off GitHub:
//
//   - every release's notes stood two or three times over. Each of the
//     three OS legs created-or-updated the SAME release with
//     generate_release_notes on, so each appended its own copy - and
//     where two legs finished within a second of each other, one
//     append was lost to the other's write (app-v0.1.4582's Windows and
//     macOS files landed at 17:46:22 and :23, and the body has two
//     copies, not three). A race, visible in the text.
//   - the release went live the moment the FIRST leg attached its files.
//     app-v0.1.4605 was published at 19:46:32 and its Windows files,
//     latest.yml among them, arrived at 19:47:57: for eighty-five
//     seconds `releases/latest` was a release no Windows copy could
//     update from and no Windows player could download. A leg that died
//     after the gate would have left that state standing until the next
//     merge.
//   - the notes were pull-request titles ("REALM with AUDIT REALM2 and
//     account-wide Renown; main merged, voice chat reverted"), and the
//     player-facing notes written for nearly every merge reached no one.
//
// So the legs only BUILD now, and one publish job, which runs only when
// every leg passed, checks the set is complete (`check`), writes the
// notes once (`notes`), stages the release as a DRAFT with every file,
// and publishes it in one step - `latest` never names a release that is
// half there. The body is the patch notes the release brings, with
// GitHub's list of merged changes below them for the record; the
// desktop app's launcher shows the same body in its news (DA10).
//
// REL6 (2026-10-01, Mac: "Remove patch notes from the codebase and
// somehow refrain from patch notes filling up the codebase"): THE NOTES
// COME OFF THE PULL REQUEST. They were PATCH-NOTES-*.md files committed
// at the repository's root - 147 by #541, each read by one release and
// then kept in the tree for good. A pull request now carries its
// player-facing notes in its own description, under a `## Patch notes`
// heading (.github/pull_request_template.md), and `notes` reads that
// section off every pull request merged since the previous release. The
// published release is the archive; nothing is read from the working
// tree, and test/tooling/rel4_release.test.js fails any patch-notes file
// committed to it (PATCH_NOTES_PATH_RE).
//
// DA13 (2026-10-14, Mac: "B only: per-file channel"): THE GAME RIDES BESIDE THE INSTALLERS, A FILE AT A TIME. The
// installers carried the whole built site in one archive, and an update re-downloaded most of it (~130 MB of a 240 MB
// installer, measured off the published blockmaps). Every release now also carries the game as one pack of files each
// compressed on its own, and a manifest of where each stands (`pack`, app/lib/gameChannel.cjs), and every installer
// carries the index of the copy it bundles (`seed`) - so a copy fetches only the files that changed. Both name the shell
// they were built for (`shell`, a digest of the shell's sources at the commit): a release that changes the shell goes
// out by the installer. And the publish job measures the update a player of the release before takes (`delta`).
//
//   node scripts/desktopRelease.mjs alias <dir>           each download copied under its name from before BR5
//   node scripts/desktopRelease.mjs check <dir>           exit 1 naming any file missing
//   node scripts/desktopRelease.mjs notes <tag>           the release body, markdown, to stdout (gh api: GH_TOKEN)
//   node scripts/desktopRelease.mjs renotes <tag> <body>  a published release's body, its notes read again (REL7)
//   node scripts/desktopRelease.mjs latest <tag> [<cur>]  "true" when <tag> should be marked latest
//   node scripts/desktopRelease.mjs shell                 DA13: the shell's id at HEAD, to stdout
//   node scripts/desktopRelease.mjs seed <dist> <file>    DA13: the bundled copy's index (VERSION, DFO_SHELL)
//   node scripts/desktopRelease.mjs pack <dist> <dir>     DA13: the game's pack and manifest (VERSION, DFO_UPDATE, DFO_SHELL)
//   node scripts/desktopRelease.mjs delta <prev> <next> [<prev-tag>]  DA13: exit 1 on an update that is no longer per file
import { closeSync, copyFileSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { isMain } from '../tools/lib/isMain.mjs';

const require = createRequire(import.meta.url);
const { DOWNLOAD_FILES, LEGACY_DOWNLOAD_FILES, RELEASES_URL } = require('../app/lib/downloads.cjs');
const { parseReleaseTag } = require('../app/lib/updateCheck.cjs');
const { GAME_CHANNEL, GAME_FILES, sha256, encodeFile, readManifest, readSeed, parseManifestFile, deltaOf } = require('../app/lib/gameChannel.cjs');

/** BR5: each download and the name a copy from before the rename asks for
 *  it by (app/lib/downloads.cjs LEGACY_DOWNLOAD_FILES) - [from, to] pairs,
 *  copied in the release's folder before the set is checked. */
export const ALIAS_COPIES = Object.freeze(Object.keys(DOWNLOAD_FILES).map((k) => Object.freeze([DOWNLOAD_FILES[k], LEGACY_DOWNLOAD_FILES[k]])));

/** Every file a published release must carry: the four downloads, the
 *  three manifests electron-updater reads (one per OS), and the two
 *  blockmaps its differential download diffs against. The AppImage's
 *  blockmap is embedded in the AppImage; the portable exe has none. BR5:
 *  and the four downloads again under their names from before the rename
 *  (ALIAS_COPIES), which no manifest names - an updater reads the new. */
export const EXPECTED_RELEASE_FILES = Object.freeze([
  DOWNLOAD_FILES.winSetup, `${DOWNLOAD_FILES.winSetup}.blockmap`,
  DOWNLOAD_FILES.winPortable,
  DOWNLOAD_FILES.mac, `${DOWNLOAD_FILES.mac}.blockmap`,
  DOWNLOAD_FILES.linux,
  'latest.yml', 'latest-mac.yml', 'latest-linux.yml',
  ...ALIAS_COPIES.map(([, to]) => to),
  // DA13: the game a file at a time - the manifest every copy reads first, and the pack it fetches ranges of
  GAME_FILES.manifest, GAME_FILES.pack,
]);

/** The expected files a list of names does not have. */
export const missingReleaseFiles = (names) => {
  const have = new Set(names);
  return EXPECTED_RELEASE_FILES.filter((f) => !have.has(f));
};

/** A path that is a patch-notes file, or sits in a patch-notes folder -
 *  "PATCH-NOTES-X.md", "patch_notes.md", "PatchNotes/x.md" - the words
 *  standing on their own ("dispatch-notes.md", "patchNotesPanel.js" are
 *  not). None belongs in the tree (REL6): notes live on the pull request. */
export const PATCH_NOTES_PATH_RE = /(?:^|\/)(?:[^/]*[^/a-z])?patch(?:[^\w/]|_)*notes(?:[^/a-z][^/]*)?(?:\/|$)/i;

/** The most of one pull request's notes a release body carries. */
export const NOTES_MAX = 64 * 1024;

/** What a release says when no patch notes came with it. On GitHub the
 *  generated list of merged changes follows it; the launcher's news panel
 *  cuts the list (app/lib/launcherState.cjs playerNotes) and lists a
 *  release that says only this when it is marked NEW or UPDATE, or when
 *  no release says more. */
export const NO_NOTES_TEXT = 'Fixes and improvements.';

/** Whose descriptions become notes: the repository's own people. A
 *  description stays editable by its author after the merge, and the
 *  publish job prints it as the release - an outside contributor's
 *  notes are a maintainer's to carry. */
export const NOTES_AUTHORS = Object.freeze(['OWNER', 'MEMBER', 'COLLABORATOR']);

/**
 * The release body: each pull request's notes, whole and in the order
 * given, then nothing else - GitHub appends its generated list of merged
 * changes under whatever this returns. Notes are trimmed and separated by
 * a blank line; a release with none says so plainly.
 *
 * @param {Array<{ text: string }>} notes
 * @returns {string}
 */
export function composeReleaseNotes(notes) {
  const parts = (notes ?? []).map((n) => String(n?.text ?? '').trim()).filter(Boolean);
  return `${parts.length ? parts.join('\n\n') : NO_NOTES_TEXT}\n`;
}

/** GitHub's generated list of merged changes, which it appends under the
 *  notes when the release is staged. The launcher cuts its news at the
 *  same place (app/lib/launcherState.cjs GENERATED_RE): a player reads
 *  the notes, never the list. */
export const GENERATED_LIST_RE = /^(##\s*What['’]s Changed\b|\*\*Full Changelog\*\*|##\s*New Contributors\b)/m;

/**
 * REL7: a published release's body with its notes written again - `notes`
 * (composeReleaseNotes) above GitHub's generated list, which stays as it
 * was. A body with no list is replaced whole.
 *
 * @param {string|null|undefined} current
 * @param {string} notes
 * @returns {string}
 */
export function renotedBody(current, notes) {
  const text = String(current ?? '').replace(/\r\n/g, '\n');
  const cut = text.search(GENERATED_LIST_RE);
  return cut < 0 ? notes : `${notes}\n\n${text.slice(cut)}`;
}

/**
 * Should `tag` become the repository's latest release? Yes when nothing
 * is latest yet, and when it is at least the current latest by REL3's
 * numeric compare. A hand-cut re-release of an OLD build (the tag door,
 * a dispatch) must not take `latest` - every releases/latest/download
 * link on the site, and every updater, follows it. An unparseable tag
 * is never made latest.
 *
 * @param {string} tag
 * @param {string|null|undefined} currentLatest
 */
export function shouldMarkLatest(tag, currentLatest) {
  const mine = parseReleaseTag(tag);
  if (!mine) return false;
  const cur = parseReleaseTag(currentLatest);
  if (!cur) return true;
  for (let i = 0; i < 3; i++) {
    if (mine[i] !== cur[i]) return mine[i] > cur[i];
  }
  return true;
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();

/** The release tag before `tag` in the history of `at` (HEAD, or REL7 the tag itself), or null. */
export function previousReleaseTag(tag, run = git, at = 'HEAD') {
  try {
    return run(['describe', '--tags', '--abbrev=0', '--match', 'app-v*', '--exclude', tag, at]) || null;
  } catch {
    return null;
  }
}

/**
 * The pull requests merged from `from` (the previous release's tag) to
 * `to` (HEAD, or REL7 the release's own tag), newest first, by number:
 * every commit on the first-parent line that is GitHub's "Merge pull
 * request #N" or a squash's "... (#N)", once. A commit pushed straight to
 * the branch names none.
 */
export function pullRequestsSince(from, run = git, to = 'HEAD') {
  if (!from) return [];
  const numbers = new Set();
  for (const subject of run(['log', '--first-parent', '--format=%s', `${from}..${to}`]).split('\n')) {
    const m = /^Merge pull request #(\d+)\b/.exec(subject) ?? /\(#(\d+)\)\s*$/.exec(subject);
    if (m) numbers.add(Number(m[1]));
  }
  return [...numbers];
}

/** An ATX heading: its #s, then its text without any closing #s. */
const HEADING_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
/** A heading's text that opens patch notes: "Patch notes", then any title. */
const NOTES_HEADING_RE = /^patch[ \t-]?notes\b[ \t]*[:\-–—]?[ \t]*(.*)$/i;
/** A code fence's opening run of backticks or tildes. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
/** A thematic break - the rule a description's footer stands under. */
const BREAK_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
/** A section that only says there is nothing to say. */
const NOTHING_RE = /^[*_]*(?:none|n\/a|nothing)[*_.]*(?:[ \t]*[-–—:,;(].*)?$/i;

/**
 * The patch notes a pull request's description carries, as the release
 * prints them: each section under a "Patch notes" heading (`## Patch
 * notes`, or `## Patch notes: <title>`), lifted so its heading is
 * `# Patch Notes: <title>` and its own sub-headings follow one level
 * below it - the shape the launcher's news reads (app/launcher). A
 * section runs to the next heading of its level or above, a thematic
 * break, or the line a description's "🤖 Generated with" footer opens.
 * HTML comments are not notes (the template's guidance is one), a
 * section with nothing in it but headings or a "None" is none, and a
 * heading inside a code fence is text. '' when there are no notes.
 *
 * @param {string|null|undefined} description
 * @returns {string}
 */
export function patchNotesOf(description) {
  const lines = String(description ?? '').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?(?:-->|$)/g, '').split('\n');
  const sections = [];
  let section = null;
  let fence = null;
  const close = () => { if (section) sections.push(section); section = null; };
  for (const line of lines) {
    if (fence) {
      section?.lines.push(line);
      if (fence.test(line)) fence = null;
      continue;
    }
    const opens = FENCE_RE.exec(line);
    if (opens) {
      fence = new RegExp(`^ {0,3}${opens[1][0] === '`' ? '`' : '~'}{${opens[1].length},}[ \\t]*$`);
      section?.lines.push(line);
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length, text = heading[2] ?? '';
      if (section && level <= section.level) close();
      if (section) {
        section.lines.push(`${'#'.repeat(Math.min(6, level - section.level + 1))} ${text}`);
        continue;
      }
      const notes = NOTES_HEADING_RE.exec(text);
      if (notes) section = { level, title: notes[1].trim(), lines: [] };
      continue;
    }
    if (section && (BREAK_RE.test(line) || /^\s*🤖/u.test(line))) { close(); continue; }
    section?.lines.push(line);
  }
  close();
  const blocks = [];
  for (const s of sections) {
    const body = s.lines.join('\n').trim();
    if (!body.split('\n').some((l) => l.trim() && !HEADING_RE.test(l)) || NOTHING_RE.test(body)) continue;
    blocks.push(`# Patch Notes${s.title ? `: ${s.title}` : ''}\n\n${body}`);
  }
  return blocks.join('\n\n');
}

/** At most NOTES_MAX of a text, cut at a line. */
const capped = (text) => {
  if (text.length <= NOTES_MAX) return text;
  return text.slice(0, text.lastIndexOf('\n', NOTES_MAX) + 1 || NOTES_MAX);
};

/**
 * `gh api <path>`, parsed (it reads GH_TOKEN). null for a 404 - no such
 * pull request - and any other failure thrown: notes that could not be
 * read are never published as notes there were none of, because a
 * published release is never re-cut (AUDIT INSTALL L3-2) and a re-run of
 * the publish job reads them again.
 */
export function githubApi(path, exec = execFileSync) {
  try {
    return JSON.parse(exec('gh', ['api', path], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) {
    if (/HTTP 404/.test(String(e?.stderr ?? ''))) return null;
    throw e;
  }
}

/** The repository the pull requests are read from: the workflow's own, or the one the downloads name. */
const repository = () => process.env.GITHUB_REPOSITORY || new URL(RELEASES_URL).pathname.split('/').slice(1, 3).join('/');

/**
 * The notes a release brings: for each pull request merged since `from`,
 * newest first, its patch notes (patchNotesOf), at most NOTES_MAX of them
 * - [{ pr, text }]. A pull request that is not merged, or that was opened
 * by anyone but NOTES_AUTHORS, brings none, and the job's log says why.
 * With no previous release there is nothing to read since, and the body
 * says "fixes and improvements" rather than every note ever written.
 */
export function pullRequestNotesSince(from, { run = git, api = githubApi, repo = repository(), log = console.error, to = 'HEAD' } = {}) {
  const notes = [];
  for (const pr of pullRequestsSince(from, run, to)) {
    const got = api(`repos/${repo}/pulls/${pr}`);
    if (!got?.merged_at) {
      log(`#${pr} is no merged pull request in ${repo} - no notes from it`);
      continue;
    }
    if (!NOTES_AUTHORS.includes(got.author_association)) {
      log(`#${pr} was opened by ${got.user?.login ?? 'someone'} (${got.author_association}) - its notes are a maintainer's to carry`);
      continue;
    }
    const text = capped(patchNotesOf(got.body));
    if (text) notes.push({ pr, text });
  }
  return notes;
}

// ---- DA13: the game a file at a time ----------------------------------------

/**
 * What the shell is made of, as paths from the repository's root: app/ whole, and every file its build takes from
 * outside it (app/package.json's `build.icon`, and each `build.files` set copied in from `../` - its filter's names),
 * the game's own `../dist` excepted: that is what the channel carries. Derived from the build config, so a file the
 * shell starts to pack from elsewhere is part of its id without anyone remembering to say so.
 */
export function shellInputs(pkg = JSON.parse(readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'))) {
  const out = ['app'];
  const fromApp = (p) => join('app', p).split('\\').join('/');
  if (typeof pkg.build?.icon === 'string') out.push(fromApp(pkg.build.icon));
  for (const f of pkg.build?.files ?? []) {
    if (typeof f !== 'object' || !f.from?.startsWith('../') || f.from === '../dist') continue;
    for (const name of f.filter ?? []) out.push(fromApp(join(f.from, name)));
  }
  return out;
}

/**
 * The shell's id at `at`: the sha256 of each input's git object id there - app/'s tree and each outside file's blob.
 * The same commit gives the same id on every runner (git objects, not checked-out bytes: a Windows checkout's line
 * endings are not the commit's), and any change to the shell gives another - which sends that release out by the
 * installer (app/lib/gameChannel.cjs routeFor).
 */
export function shellId(run = git, at = 'HEAD', inputs = shellInputs()) {
  return sha256(Buffer.from(inputs.map((p) => `${p} ${run(['rev-parse', `${at}:${p}`])}\n`).join('')));
}

/** Did any of the shell's inputs change between two commits? (git diff --quiet: exit 1 is a difference.) */
export function shellChangedSince(from, run = execFileSync, to = 'HEAD', inputs = shellInputs()) {
  try {
    run('git', ['diff', '--quiet', from, to, '--', ...inputs], { stdio: 'ignore' });
    return false;
  } catch (e) {
    if (e?.status === 1) return true;
    throw e;
  }
}

/** Every file under `dir`, by its path from it ('/'-separated), in path order. */
export function gameFilesOf(dir) {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(join(dir, rel)).sort()) {
      const p = rel ? `${rel}/${name}` : name;
      if (statSync(join(dir, p)).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk('');
  return out.sort();
}

/** The env a release step hands the game's two writers: its version, update number and shell id, held to their shapes. */
function releaseEnv({ update = false } = {}) {
  const version = process.env.VERSION ?? '';
  const shell = process.env.DFO_SHELL ?? '';
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`VERSION must be <major>.<minor>.<patch> (${version})`);
  if (!/^[0-9a-f]{64}$/.test(shell)) throw new Error('DFO_SHELL must be the shell id (desktopRelease.mjs shell)');
  const u = process.env.DFO_UPDATE ?? '';
  return { version, shell, update: update && /^\d+\.\d+\.\d+$/.test(u) ? u : null };
}

/**
 * The bundled copy's index - every file of `dir`, its size and sha256 - for an installer of `version` built for
 * `shell` (app/game-seed.json, read by app/lib/gameStore.cjs loadSeed).
 */
export function gameSeed(dir, { version, shell }) {
  const files = gameFilesOf(dir).map((p) => {
    const bytes = readFileSync(join(dir, p));
    return { path: p, size: bytes.length, sha256: sha256(bytes) };
  });
  return readSeed({ channel: GAME_CHANNEL, version, shell, files });
}

/**
 * The game's pack and manifest for `dir`, written into `outDir` (GAME_FILES): each file encoded on its own
 * (gameChannel.cjs encodeFile) and laid end to end in path order, its place recorded. Answers the manifest, held to
 * gameChannel.cjs readManifest - the law every copy reads it by.
 */
export function packGame(dir, outDir, { version, update = null, shell }) {
  mkdirSync(outDir, { recursive: true });
  const fd = openSync(join(outDir, GAME_FILES.pack), 'w');
  const files = [];
  let offset = 0;
  try {
    for (const p of gameFilesOf(dir)) {
      const bytes = readFileSync(join(dir, p));
      const { encoding, data } = encodeFile(p, bytes);
      writeSync(fd, data);
      files.push({ path: p, size: bytes.length, sha256: sha256(bytes), offset, length: data.length, encoding });
      offset += data.length;
    }
  } finally { closeSync(fd); }
  const manifest = readManifest({ channel: GAME_CHANNEL, version, update, shell, pack: { file: GAME_FILES.pack, size: offset }, files }, { version });
  writeFileSync(join(outDir, GAME_FILES.manifest), gzipSync(Buffer.from(JSON.stringify(manifest)), { level: 9 }));
  return manifest;
}

/** The most of the game one update the channel carries may re-download: past it, the update is no longer the files
 *  that changed (DA11's regression re-downloaded 53-56% of the installer). A release that truly replaces most of the
 *  game goes out by the installer - raise GAME_CHANNEL, a change to the shell. */
export const MAX_UPDATE_SHARE = 0.5;

/**
 * DA13's publish-step check: the update a player of `prev` takes to `next`, measured, and why it fails if it does -
 * the shell's id moved with no shell file changed (every update would be the installer's again), or the channel would
 * re-download more than MAX_UPDATE_SHARE of the game. A release that changes the shell is the installer's: measured,
 * never failed.
 */
export function judgeDelta(prev, next, { shellChanged = null } = {}) {
  const d = deltaOf(prev, next);
  const sameShell = prev.shell === next.shell;
  const problems = [];
  if (!sameShell && shellChanged === false) problems.push('the shell id moved with no shell file changed - every update would be the installer\'s');
  if (sameShell && d.share > MAX_UPDATE_SHARE) problems.push(`the update re-downloads ${(100 * d.share).toFixed(1)}% of the game (more than ${100 * MAX_UPDATE_SHARE}%) - it is no longer the files that changed`);
  const said = `v${prev.version} -> v${next.version}: ${d.files} files, ${(d.bytes / 1e6).toFixed(2)} MB of ${(d.total / 1e6).toFixed(1)} MB (${(100 * d.share).toFixed(2)}%)${sameShell ? '' : ' - the shell changed: this release goes out by the installer'}`;
  return { ...d, sameShell, problems, said };
}

function main(argv) {
  const [cmd, a, b] = argv;
  if (cmd === 'shell') {
    console.log(shellId());
    return 0;
  }
  if (cmd === 'seed') {
    writeFileSync(b, JSON.stringify(gameSeed(a, releaseEnv())));
    console.log(`the bundled game indexed into ${b}`);
    return 0;
  }
  if (cmd === 'pack') {
    const m = packGame(a, b, releaseEnv({ update: true }));
    console.log(`${m.files.length} files packed: ${(m.pack.size / 1e6).toFixed(1)} MB`);
    return 0;
  }
  if (cmd === 'delta') {
    const prevTag = argv[3] ?? null;
    const prev = parseManifestFile(readFileSync(a));
    const next = parseManifestFile(readFileSync(b));
    const j = judgeDelta(prev, next, { shellChanged: prevTag && prev.shell !== next.shell ? shellChangedSince(prevTag) : null });
    console.log(j.said);
    if (j.problems.length) {
      console.error(`the game's update has regressed - nothing is published: ${j.problems.join('; ')}`);
      return 1;
    }
    return 0;
  }
  if (cmd === 'alias') {
    const have = new Set(readdirSync(a));
    const absent = ALIAS_COPIES.filter(([from]) => !have.has(from)).map(([from]) => from);
    if (absent.length) {
      console.error(`nothing to copy under its old name: ${absent.join(', ')} - nothing is published`);
      return 1;
    }
    for (const [from, to] of ALIAS_COPIES) copyFileSync(join(a, from), join(a, to));
    console.log(`${ALIAS_COPIES.length} downloads copied under their names from before BR5`);
    return 0;
  }
  if (cmd === 'check') {
    const missing = missingReleaseFiles(readdirSync(a));
    if (missing.length) {
      console.error(`the release is missing ${missing.join(', ')} - nothing is published`);
      return 1;
    }
    console.log(`all ${EXPECTED_RELEASE_FILES.length} release files present`);
    return 0;
  }
  if (cmd === 'notes') {
    let notes;
    try {
      notes = pullRequestNotesSince(previousReleaseTag(a));
    } catch (e) {
      console.error(`the notes could not be read - nothing is published: ${String(e?.stderr || e?.message || e).trim()}`);
      return 1;
    }
    process.stdout.write(composeReleaseNotes(notes));
    return 0;
  }
  // REL7: the pull requests between the previous release and <tag> ITSELF,
  // whatever is checked out - release-notes.yml runs this from main, and a
  // release's own commit may predate this command.
  if (cmd === 'renotes') {
    let notes;
    try {
      try { git(['rev-parse', '--verify', '--quiet', `refs/tags/${a}^{commit}`]); } catch { throw new Error(`no tag ${a} in this checkout`); }
      notes = pullRequestNotesSince(previousReleaseTag(a, git, a), { to: a });
    } catch (e) {
      console.error(`the notes could not be read - the release is left as it is: ${String(e?.stderr || e?.message || e).trim()}`);
      return 1;
    }
    process.stdout.write(renotedBody(readFileSync(b, 'utf8'), composeReleaseNotes(notes)));
    return 0;
  }
  if (cmd === 'latest') {
    console.log(String(shouldMarkLatest(a, b)));
    return 0;
  }
  console.error('usage: desktopRelease.mjs alias <dir> | check <dir> | notes <tag> | renotes <tag> <body-file> | latest <tag> [<current>] | shell | seed <dist> <file> | pack <dist> <dir> | delta <prev> <next> [<prev-tag>]');
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
