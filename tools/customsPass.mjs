// CUSTOMS-PASS (2026-09-29, the field - Mac, asked what becomes of a character a build from before the realm stranded:
// "Staff customs pass"): A DEVELOPER GRANTS ONE ACCOUNT ONE CHARACTER THROUGH CUSTOMS. The account service's route does
// the work and holds the law (server-account/src/realm.js grantCustomsPass and customsRealm); this names the account and
// says the answer.
//
//   node tools/customsPass.mjs <name>              grant - a handle, or a guest's two-word name (Akh'bil Zakar)
//   node tools/customsPass.mjs --account <id>      grant, by the account's id (two guests wearing one name)
//   node tools/customsPass.mjs <name> --revoke     take back a pass not yet spent
//
// Signed in as YOU - a developer, your handle in the service's DEVELOPER_HANDLES: DAGGER_HANDLE and DAGGER_PASSWORD sign
// in for this one call and sign out after it; DAGGER_SECRET, a session secret you already hold, is used as it is and left
// signed in. DAGGER_ACCOUNT_SERVICE points at another service (a local one); the live one by default.
//
// A pass is one character: the account's next Bring online of a character its census never counted comes in through
// customs as any does (its loans called in, its gold capped at the level's allowance), and the pass is spent on it. It
// never lets in a character already brought in from any account. So: grant it, then tell the player to press Bring
// online on that character.
import { DEFAULT_ACCOUNT_SERVICE, accountRefusalText } from '../src/net/accountClient.js';
import { isMain } from './lib/isMain.mjs';

export const USAGE = [
  'usage: node tools/customsPass.mjs <name> [--revoke]',
  '       node tools/customsPass.mjs --account <id> [--revoke]',
  "  <name> is a handle, or a guest's two-word name as the game shows it.",
  '  Sign in with DAGGER_HANDLE and DAGGER_PASSWORD (or DAGGER_SECRET); DAGGER_ACCOUNT_SERVICE for another service.',
].join('\n');

/**
 * The route's body for these arguments - `{ body }` - or `{ usage }` when they do not name exactly one account: a
 * handle is one word and a guest's name two (net/handleShape.js), so a name of more words is no name the game shows,
 * and a flag this tool does not know is refused rather than read as a name.
 * @param {string[]} argv
 * @returns {{ body: { name?: string, account?: string, revoke?: true } } | { usage: string }}
 */
export function passRequest(argv) {
  let revoke = false;
  /** @type {string | undefined} */
  let account;
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--revoke') {
      revoke = true;
      continue;
    }
    if (a === '--account') {
      if (account !== undefined || i + 1 >= argv.length) return { usage: USAGE };
      account = argv[++i];
      continue;
    }
    if (a.startsWith('--')) return { usage: USAGE };
    words.push(...a.trim().split(/\s+/).filter(Boolean));
  }
  if ((account === undefined) === (words.length === 0) || words.length > 2) return { usage: USAGE };
  const body = account !== undefined ? { account } : { name: words.join(' ') };
  return { body: revoke ? { ...body, revoke: true } : body };
}

/** One POST to the service - `{ ok, status, body }`, never a throw for an answer the service gave. */
async function post(base, path, body, secret = null) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const req = passRequest(process.argv.slice(2));
  if ('usage' in req) {
    console.error(req.usage);
    process.exit(2);
  }
  const base = process.env.DAGGER_ACCOUNT_SERVICE || DEFAULT_ACCOUNT_SERVICE;
  let secret = process.env.DAGGER_SECRET || null;
  let opened = false;
  if (!secret) {
    const handle = process.env.DAGGER_HANDLE,
      password = process.env.DAGGER_PASSWORD;
    if (!handle || !password) {
      console.error('Sign in first: set DAGGER_HANDLE and DAGGER_PASSWORD, or DAGGER_SECRET.');
      process.exit(2);
    }
    const signed = await post(base, '/v1/auth/login', { handle, password, label: 'tools/customsPass.mjs' });
    if (!signed.ok || typeof signed.body?.secret !== 'string') {
      console.error(`Sign-in refused: ${accountRefusalText(signed.body?.error)}`);
      process.exit(1);
    }
    secret = signed.body.secret;
    opened = true;
  }
  try {
    const r = await post(base, '/v1/mod/customs-pass', req.body, secret);
    if (!r.ok) {
      console.error(`Refused (${r.body?.error ?? r.status}): ${accountRefusalText(r.body?.error)}`);
      process.exitCode = 1;
      return;
    }
    const { target, name, open, changed } = r.body;
    const who = `${name} (${target})`;
    if (open)
      console.log(
        changed
          ? `Granted: ${who} holds a customs pass. Their next Bring online of a character the realm never counted comes in, once.`
          : `${who} already holds an open customs pass.`,
      );
    else
      console.log(
        changed
          ? `Taken back: ${who}'s open customs pass.`
          : `${who} holds no open customs pass - nothing to take back.`,
      );
  } finally {
    if (opened) await post(base, '/v1/auth/logout', {}, secret).catch(() => {}); // the session this call opened, and no other
  }
}

if (isMain(import.meta.url)) main();
