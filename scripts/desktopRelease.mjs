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
// at the repository's root - 113 by #501, each read by one release and
// then kept in the tree for good. A pull request now carries its
// player-facing notes in its own description, under a `## Patch notes`
// heading (.github/pull_request_template.md), and `notes` reads that
// section off every pull request merged since the previous release. The
// published release is the archive; nothing is read from the working
// tree, and test/rel4_release.test.js fails any patch-notes file
// committed to it (PATCH_NOTES_PATH_RE).
//
//   node scripts/desktopRelease.mjs check <dir>           exit 1 naming any file missing
//   node scripts/desktopRelease.mjs notes <tag>           the release body, markdown, to stdout (gh api: GH_TOKEN)
//   node scripts/desktopRelease.mjs latest <tag> [<cur>]  "true" when <tag> should be marked latest
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { isMain } from '../tools/lib/isMain.mjs';

const require = createRequire(import.meta.url);
const { DOWNLOAD_FILES, RELEASES_URL } = require('../app/lib/downloads.cjs');
const { parseReleaseTag } = require('../app/lib/updateCheck.cjs');

/** Every file a published release must carry: the four downloads, the
 *  three manifests electron-updater reads (one per OS), and the two
 *  blockmaps its differential download diffs against. The AppImage's
 *  blockmap is embedded in the AppImage; the portable exe has none. */
export const EXPECTED_RELEASE_FILES = Object.freeze([
  DOWNLOAD_FILES.winSetup, `${DOWNLOAD_FILES.winSetup}.blockmap`,
  DOWNLOAD_FILES.winPortable,
  DOWNLOAD_FILES.mac, `${DOWNLOAD_FILES.mac}.blockmap`,
  DOWNLOAD_FILES.linux,
  'latest.yml', 'latest-mac.yml', 'latest-linux.yml',
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

/** The release tag before `tag` in this checkout's history, or null. */
export function previousReleaseTag(tag, run = git) {
  try {
    return run(['describe', '--tags', '--abbrev=0', '--match', 'app-v*', '--exclude', tag, 'HEAD']) || null;
  } catch {
    return null;
  }
}

/**
 * The pull requests merged from `from` (the previous release's tag) to
 * HEAD, newest first, by number: every commit on the first-parent line
 * that is GitHub's "Merge pull request #N" or a squash's "... (#N)",
 * once. A commit pushed straight to the branch names none.
 */
export function pullRequestsSince(from, run = git) {
  if (!from) return [];
  const numbers = new Set();
  for (const subject of run(['log', '--first-parent', '--format=%s', `${from}..HEAD`]).split('\n')) {
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
export function pullRequestNotesSince(from, { run = git, api = githubApi, repo = repository(), log = console.error } = {}) {
  const notes = [];
  for (const pr of pullRequestsSince(from, run)) {
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

function main(argv) {
  const [cmd, a, b] = argv;
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
  if (cmd === 'latest') {
    console.log(String(shouldMarkLatest(a, b)));
    return 0;
  }
  console.error('usage: desktopRelease.mjs check <dir> | notes <tag> | latest <tag> [<current>]');
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
