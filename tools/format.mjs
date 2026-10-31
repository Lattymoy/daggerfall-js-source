// THE FORMATTER (LEGIBLE 3, bible/01-Overview/Readability-Arc.md): Prettier at one pinned version and one
// configuration (.prettierrc.json), over the folders tools/formatted.json lists. A folder joins in one change that
// formats it with its pins carried: node tools/carryPins.mjs --transform tools/format.mjs src/poi/*.js --write.
//   node tools/format.mjs --check     every listed file formatted (exit 1 names the rest)
//   node tools/format.mjs --ignore    write .prettierignore: all but the listed folders, for an editor's format-on-save

// `transform(source, file)` is the carrier's and must be synchronous; Prettier 3 is not, so it runs on a worker of its
// own and the caller waits on a shared flag for the answer.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, MessageChannel, receiveMessageOnPort, isMainThread, workerData } from 'node:worker_threads';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FORMATTED = 'tools/formatted.json';
export const IGNORE = '.prettierignore';

/** The folders the formatter owns. */
export const formattedFolders = (root = ROOT) => JSON.parse(readFileSync(join(root, FORMATTED), 'utf8'));

/** Every .js/.mjs file directly in a listed folder, repo-relative and sorted - a subfolder is listed on its own. A
 *  listed path that is not there gives none (`missingEntries` names it). */
export function formattedFiles(root = ROOT) {
  return formattedFolders(root)
    .filter((d) => existsSync(join(root, d)))
    .flatMap((d) =>
      isFileEntry(d)
        ? [d]
        : readdirSync(join(root, d), { withFileTypes: true })
            .filter((e) => e.isFile() && /\.m?js$/.test(e.name))
            .map((e) => `${d}/${e.name}`),
    )
    .sort();
}

/** The listed folders and files that are not there. */
export const missingEntries = (root = ROOT) => formattedFolders(root).filter((d) => !existsSync(join(root, d)));

/** An entry that names one file - a folder whose other files are not formatted yet lists its formatted ones. */
export const isFileEntry = (entry) => /\.m?js$/.test(entry);

/** .prettierignore's text: ignore everything, then open each listed folder's own .js and .mjs files (its other files
 *  and its subfolders shut unless listed) and the parents on its way (their own contents shut). */
export function ignoreText(folders) {
  const lines = ['# Written by node tools/format.mjs --ignore from tools/formatted.json - edit that, not this.', '/*'];
  const opened = new Set();
  for (const folder of [...folders].sort()) {
    const parts = folder.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join('/');
      if (opened.has(path)) continue;
      opened.add(path);
      if (i === parts.length && isFileEntry(path)) {
        lines.push(`!/${path}`);
        continue;
      }
      lines.push(`!/${path}/`, `/${path}/*`);
      if (folders.includes(path)) lines.push(`!/${path}/*.js`, `!/${path}/*.mjs`);
    }
  }
  return `${lines.join('\n')}\n`;
}

let worker = null;
let port = null;
let signal = null;
function startWorker() {
  const channel = new MessageChannel();
  signal = new Int32Array(new SharedArrayBuffer(4));
  worker = new Worker(new URL(import.meta.url), {
    workerData: { prettierPort: channel.port2, prettierSignal: signal },
    transferList: [channel.port2],
  });
  worker.unref();
  port = channel.port1;
}

/** The formatted text of `source`, as Prettier formats `file` with the repository's configuration. */
export function transform(source, file = 'file.js') {
  if (!worker) startWorker();
  Atomics.store(signal, 0, 0);
  worker.postMessage({ source, file: join(ROOT, file) });
  Atomics.wait(signal, 0, 0);
  const reply = receiveMessageOnPort(port).message;
  if (reply.error) throw new Error(reply.error);
  return reply.out;
}

if (!isMainThread && workerData?.prettierSignal) {
  const prettier = await import('prettier');
  const { prettierPort, prettierSignal } = workerData;
  const { parentPort } = await import('node:worker_threads');
  parentPort.on('message', async ({ source, file }) => {
    let reply;
    try {
      const options = await prettier.resolveConfig(file);
      reply = { out: await prettier.format(source, { ...options, filepath: file }) };
    } catch (e) {
      reply = { error: `${file}: ${e.message}` };
    }
    prettierPort.postMessage(reply);
    Atomics.store(prettierSignal, 0, 1);
    Atomics.notify(prettierSignal, 0);
  });
}

/** The listed files Prettier would change, repo-relative. */
export async function unformatted(root = ROOT) {
  const prettier = await import('prettier');
  const out = [];
  for (const f of formattedFiles(root)) {
    const path = join(root, f);
    const options = await prettier.resolveConfig(path);
    if (!(await prettier.check(readFileSync(path, 'utf8'), { ...options, filepath: path }))) out.push(f);
  }
  return out;
}

if (isMainThread && isMain(import.meta.url)) {
  if (process.argv.includes('--ignore')) {
    writeFileSync(join(ROOT, IGNORE), ignoreText(formattedFolders()));
    console.log(`${IGNORE} written for ${formattedFolders().length} folder(s)`);
  } else if (process.argv.includes('--check')) {
    const missing = missingEntries();
    const bad = await unformatted();
    for (const d of missing) console.log(`MISSING  ${d}`);
    for (const f of bad) console.log(`UNFORMATTED  ${f}`);
    if (!missing.length && !bad.length)
      console.log(`formatted: ${formattedFiles().length} files in ${formattedFolders().length} folder(s)`);
    process.exitCode = missing.length || bad.length ? 1 : 0;
  } else {
    console.error('usage: node tools/format.mjs --check | --ignore');
    process.exitCode = 2;
  }
}
