#!/usr/bin/env node
// RECOVER-OP (2026-09-27) - A NEW RECOVERY CODE, ISSUED BY THE OPERATOR. Twoddle, to Mac: "i did a stupid and have
// lost my password plus the code thing it gave ... is there anyway this can be fixed without starting a new account as
// i would like to keep the founders badge? I am still signed in atm".
//
// ACC1c's design has no way back for a player who lost both, and on purpose: email is optional, so there is no second
// fact about the player to reset against, and a signed-in device may not change the password without the old one (a
// stolen device must not lock its owner out). So the way back is the operator's, and it is the player's OWN recovery
// with a fresh code:
//   1. the operator mints a code here and sets ONLY its hash on the account (.github/workflows/account-recovery.yml);
//   2. the player spends the code in the game's "Forgot password" form and picks their own password;
//   3. that spend mints the player a new code and signs every device out (accounts.js `recover`), so the code the
//      operator saw is dead the moment it is used.
// Nothing else on the row is touched: the id, the saves, the Founder (FOUNDER3 reads `created_at`) all stay.
//
//   node tools/reissueRecoveryCode.mjs <handle>                mint a code: print it (for the player) and its hash
//   node tools/reissueRecoveryCode.mjs --sql <handle> <hash>   the one statement, as account-recovery.yml runs it
//
// The code never goes into the workflow or a log. The hash does, and the hash of 100 random bits is no secret.

import { isMain } from './lib/isMain.mjs';
import { mintRecoveryCode, codeForHashing, hashPassword, parseStored } from '../server-account/src/password.js';
import { isHandleShaped } from '../src/net/handleShape.js';

/** The stored form `hashPassword` writes: standard base64 (btoa), so no character in it can end an SQL string. */
export const HASH_RE = /^pbkdf2-sha256\$\d+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/;

/** A fresh code and the hash `recover` will check it against - hashed as registration hashes one (`codeForHashing`). */
export async function mintReissue({ subtle, rand }) {
  const code = mintRecoveryCode(rand);
  return { code, hash: await hashPassword(codeForHashing(code), { subtle, rand }) };
}

/**
 * THE ONE STATEMENT: the new hash on that registered account alone, and nothing else on the row. Found by `handle_lc`,
 * folded as the service folds it (a handle typed in another case is still the account), with `'` doubled (a handle
 * may carry one). RETURNING names the row it changed, so the workflow can refuse a run that changed none.
 * @param {string} handle
 * @param {string} hash
 */
export function reissueSql(handle, hash) {
  if (!isHandleShaped(handle)) throw new Error(`not a username: ${JSON.stringify(handle)}`);
  if (typeof hash !== 'string' || !HASH_RE.test(hash) || !parseStored(hash)) throw new Error('not a recovery-code hash from this tool');
  const lc = handle.toLowerCase().replaceAll("'", "''");
  return `UPDATE players SET recovery_hash = '${hash}' WHERE handle_lc = '${lc}' AND handle IS NOT NULL RETURNING handle;`;
}

async function main(argv) {
  const rand = (b) => globalThis.crypto.getRandomValues(b);
  if (argv[0] === '--sql') {
    process.stdout.write(`${reissueSql(argv[1], argv[2])}\n`);
    return;
  }
  const handle = argv[0];
  if (!isHandleShaped(handle)) throw new Error('usage: node tools/reissueRecoveryCode.mjs <handle>');
  const { code, hash } = await mintReissue({ subtle: globalThis.crypto.subtle, rand });
  reissueSql(handle, hash);   // the statement the workflow will write, checked here first
  console.log(`Recovery code for ${handle} - give it to the player privately; it works once:\n\n  ${code}\n`);
  console.log(`Its hash - the workflow's \`hash\` input (not a secret):\n\n  ${hash}\n`);
  console.log(`Then: Actions > "Account recovery" > Run workflow, with handle ${handle} and that hash. The player uses`);
  console.log('"Forgot password" in the game with the code, picks a new password, and is shown a new code to keep.');
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
