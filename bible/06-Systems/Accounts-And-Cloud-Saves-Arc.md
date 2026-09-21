# Accounts and cloud saves (ACC)

ACC0 — the design record, 2026-09-21. **Nothing below has shipped.** This
page is the shape agreed with Mac before any code, and it says what is
decided, what is lifted from another repo, what is genuinely new, and
what is still open.

Mac (2026-09-21):

> I now want to talk about cloud storage and account creation needed for
> accessing online mode. We have a solid architecture built within my
> other repo, Fight Life, and I wondered if any of that is reusable

---

## THE FIRST THING THE ARC HAD TO LEARN: WE ALREADY HAVE ACCOUNTS

The question read like "add accounts", and the honest answer after
reading the tree is that **SOC1 built them five days ago** and nobody
called them that on this page.

`net/social.js` keeps `dagger.online.account` and
`dagger.online.accountSecret` in `appStorage` — a durable id the player
holds, deliberately durable (AUDIT SOC B10: "an account is a DURABLE
thing… every load would be a new permanent account" was a defect, and it
was fixed). The hub — the world channel's Durable Object, inside the
relay Worker — keeps `acct:<id>` (its last name, last-seen, friends,
requests, party) and `asecret:<id>`, minted by the first hello and
matched by every later one. Friends, requests and the four-seat party
all hang off that id.

So this arc is **not** "make accounts exist". It is two much smaller
sentences:

1. Give the account that already exists a way to be **PROVEN** — a
   provider link, so it survives a cleared browser and reaches a second
   device.
2. Give it somewhere to **KEEP THINGS** — the saves.

That reframing matters, because the version of this arc that does not
know about SOC1 stands a second account system up beside the first. Two
stores that both answer "who is this player" is the byte-groups bug of
EM7 at system scale, and it would be far harder to unpick.

---

## THE WALL, as Mac drew it

Mac, across three messages, and the third corrected the first two:

> let guest have access to chat also, but definitely a random name. I
> feel like accounts should only get cloud storage though

> the account name would be used for online.

| | guest | linked |
|---|---|---|
| connect, be seen, walk | yes | yes |
| chat | yes | yes |
| name | **generated, unchosen** | **the account's own name** |
| cloud saves | no | yes |

**THE WALL IS AT CLOUD SAVES AND NOWHERE ELSE.** Nothing a player can do
today is taken away, there is no sign-in dialog between anyone and the
game, and the account is a feature people want rather than a toll.

**AND THE NAME IS THE SECOND REASON TO LINK**, which is what makes the
moderation story work rather than a gate would. A guest may talk but may
not be anyone; a linked player may be someone but has a real provider
identity on the line. **The only people who can take a name are the
people who can be banned** — the impersonation vector and the
accountability arrive together, and neither exists without the other.

This was argued the other way first (this session, twice) and both
earlier positions were worse. Recorded because the reasoning is the
load-bearing part:

- "Accounts required for online" buys moderation and costs the thing
  that makes online worth opening. The population is small; an empty
  world is a worse problem than an occasional bad line.
- "Random names for everyone" removes impersonation permanently and
  leaves linking with nothing to offer but a backup.
- Mac's cut keeps the door open AND gives the name teeth. It is better
  than both.

The residue, stated plainly: a guest's bad behaviour is answerable only
by the word filter (NAME-F1/F2) and the rate gates (CHAT-G, per socket
and per room). A ban on a guest is one storage clear from undone. At
this scale that is accepted. One mitigation is free and does not touch
the wall: because a guest is a real account row, a mute can be a flag on
that row — it survives a refresh, not a storage clear.

---

## WHERE AN ACCOUNT LIVES, and the one thing that has to move

Today an account lives in the hub's Durable Object storage. That works
for friends, parties and presence: small, keyed, hot, and all within one
object. It cannot work for what this arc adds, for one reason that is
not a matter of taste:

**A PROVIDER LINK IS A LOOKUP BY SOMEBODY ELSE'S ID.** "Which account
belongs to this Google subject?" is an index over all players. A Durable
Object cannot answer it without becoming a single global object every
sign-in queues behind, which is a bottleneck deliberately avoided
everywhere else in `server/`.

So: **D1 owns identity. The hub keeps what it already keeps.**

| lives in | what |
|---|---|
| **D1** (new) | accounts, provider links, sessions, the save slot cards |
| **R2** (new) | the save blobs and their screenshots |
| **hub DO** (today) | friends, requests, parties, presence, last-seen |
| **room DO** (today) | poses, chat, the world's memory |

The hub stops MINTING accounts and stops holding `asecret:<id>`. It is
handed a verified identity instead. That is the one migration this arc
forces, and section *Carrying the existing players over* says how.

---

## THE TOKEN, which is the real new seam

Today the hello is `{ t: 'hello', id, secret, name, look, pose }` and
**the client asserts its own name**; the relay sanitises it and has no
idea whether it is yours. That is fine while a name means nothing. The
moment a name means "this is a linked account", a forged name is worth
forging — and every name on the roster becomes a claim nobody checked.

So the account service issues a **short-lived signed token**, the hello
carries it, and the relay verifies the signature and reads the name
**out of the token** rather than off the frame.

- The relay never touches D1 or R2. It checks a signature. That is all.
- **One mechanism covers both kinds of player**: a guest is issued a
  token too, carrying its generated name. The relay cannot tell them
  apart and does not need to.
- It closes a hole that exists today regardless of accounts.

The token is the reason the answer to "one Worker or two" is **two**.
Section *Two Workers* has the rest of that argument.

---

## TWO WORKERS, and the argument that settles it

The account service is its own Worker, not a route on the relay.

**A relay deploy restarts every Durable Object and drops every connected
player.** That is an acceptable price for changing the relay's own law.
It is not an acceptable price for fixing the wording on a sign-in
button.

And it is not hypothetical here. SLAM8 hashes the **raw bytes** of every
file the Worker bundles, comments included and deliberately so —
`/health` answers "is the Worker running the bundle I built?", and a
bundle whose comments differ is a different bundle. On 2026-09-21 a
one-comment correction to `src/net/wire.js` was abandoned for exactly
this reason (DEPLOY-PROSE; the stale sentence is still in the file and
the gate records why). Put accounts in that bundle and **every auth
tweak drops everyone mid-dungeon.**

The costs of two, stated so nobody re-litigates it cheaply: two URLs,
two CORS origins, two version stamps, and a token seam between them.
They are small, and the token seam has to exist anyway.

**THE HUB IS THE AWKWARD PART, and it is not resolved here.** The hub
lives *inside* the relay Worker today (the world channel's object). A
social change therefore already costs a player-dropping deploy, which is
a pre-existing cost this arc does not create and does not fix. Whether
the hub eventually moves is left open — see *Open*.

---

## WHAT COMES FROM FIGHT LIFE

`Lattymoy/fight-life-source`, read at `49f4ff4`. It is a Cloudflare
Worker over D1 **on the same Cloudflare account**, so this is a second
tenant rather than a port.

**Lifts close to as-is:**

- **`fight-life-source/server/src/auth.js`** — provider identity verification for Google,
  Apple and Play Games. Deliberately provider-agnostic: everything
  upstream operates on an opaque `{ providerId, email }`, so adding a
  provider is one branch and nothing else moves. Google and Apple verify
  RS256 signatures against published JWKS inside the Worker; Play Games
  exchanges a server auth code. **No client-asserted identity is ever
  trusted — only a token the provider signed.**
- **The three migrations** `account_links`, `sessions`, `player_state`.
- **`sessions` is the one to read first.** Fight Life originally had one
  secret per player and rotated it on sign-in, so signing in on a
  desktop silently 401'd the phone on every write — Mac hit it himself.
  A session is the credential now, one per device, and sign-out revokes
  only that device. Daggerfall would hit the identical bug on day one.
- **`fight-life-source/src/online/playerState.js`'s hydrated mirror** — synchronous reads
  off an in-memory mirror, writes update the mirror synchronously and
  push in the background, failed pushes retried. This matters more here
  than there: the port's save and load callers are synchronous and some
  sit in frame-timed paths, and making them async is how a game acquires
  stutter.
- **`fight-life-source/src/online/nameGen.js`** — generated names, which is exactly what a
  guest needs.

**Does not come across:** the ladder, Elo, the economy, the pass, the
challenge and fight-verification stack. None of it has a subject here.

### Two places Fight Life's schema is not enough

1. **`handle` is a bare `TEXT` column with no uniqueness constraint.**
   Defensible there — it is a display name beside a rating. Here the
   name *is* the identity, and two players called "Nystul" is the same
   defect as forging one, only slower. This arc wants a `handle_lc`
   column with a unique index, so casing cannot smuggle a duplicate
   past it. The port's own NAME-F1/F2 filter moves onto the handle
   endpoint — refuse at entry, which is what NAME-F2 was written to do.
2. **`player_state` is for small JSON blobs**, and its body cap is
   96 KB (`MAX_BODY_BYTES`). A Daggerfall save is a world state plus a
   screenshot. See below.

---

## THE SAVES: R2 for the blob, D1 for the card

A Daggerfall save already hits `QuotaExceededError` in `localStorage`
(`systems/save.js` handles it by name), which places its size class
above both D1's practical per-row ceiling and a Worker's body cap. R2
also has no egress fee, which matters for a game nobody pays for.

**The screenshot is its own object.** The slot list needs thumbnails,
and fetching a whole save to draw a slot card would be absurd.

    saves/{playerId}/{characterId}/{slot}/data
    saves/{playerId}/{characterId}/{slot}/shot

with D1 holding the card — `characterId`, save name, game time,
`updatedAt`, and the two keys.

**THE CLOUD IS A BACKUP AND A TRANSFER. THE LOCAL SAVE STAYS
AUTHORITATIVE.** This is the most important sentence on the page and it
is a deliberate limit rather than a first cut.

This repo has CHARID1 and SP1 *because players lost games* — one
overwrote a character by reusing a name, another installed the app and
found empty slots. A design where the cloud is the truth is one where a
sync bug is catastrophic; a design where the cloud is a copy is one
where the same bug is an inconvenience. The carrier already exists:
SP1's `systems/saveTransfer.js` defines a canonical portable layout
(`Saves/SAVE<n>/SaveData.txt`, `SaveInfo.txt`, `Screenshot.jpg`) and
moves slots between the browser's store and the desktop's files. **The
cloud is a third destination for a carrier that already works**, not a
new kind of save.

Two things already in the tree fit this seam exactly, and both landed
this week for unrelated reasons:

- **`systems/characterId.js`** (CHARID1) — a character is a stable id
  rather than a name. That is the key a cloud save is filed under, and
  it exists because a Discord player lost a character to a name clash.
- **`systems/appStorage.js`** — already the one door between the
  browser's storage and the desktop's files. A cloud backend belongs
  **behind that same door**, not beside it.

---

## CARRYING THE EXISTING PLAYERS OVER

Players already hold `dagger.online.account` ids, and the hub already
holds their friend lists against those ids. Nothing may orphan them.

**ACC0 SAID THE ACCOUNT SERVICE WOULD ADOPT THE EXISTING ID, AND THAT
WAS WRONG.** It is recorded here rather than quietly rewritten, because
the error is instructive and it was found by trying to build it (ACC1b).

The adoption story assumed the account service could verify an existing
`(id, secret)` pair. It cannot: **the hub minted that secret and the hub
is the only thing that holds it.** `asecret:<id>` lives in a Durable
Object's storage inside the relay Worker, and the account service is
deliberately unable to reach it. Every way of closing that gap is worse
than the gap:

- Adopt an id on sight, without checking the secret. Whoever presents it
  first owns it — a land-grab on every account that has not reconnected.
- Have the hub sign a voucher. Then the relay holds a signing key, and
  the one property that lets the relay be the bigger attack surface —
  **a public key cannot mint** — is gone.
- Let both hold the truth and reconcile. Two answers to "who is this".

**THE MERGE BELONGS AT THE HUB**, which is the one place that holds both
credentials at once. A socket that presents a verified identity token
AND the old `(id, secret)` the hub itself minted is a socket the hub can
see is the same person, so the hub moves the friend list across. The
account service never needs to know SOC1 existed.

That is a later slice and it is not built. ACC1b mints its own ids and
knows nothing about the social arc. What survives from ACC0 is the
smaller and still-true half: the ids are the **same shape** at both
ends, which is what makes that merge possible at all, and a pin reads
`net/social.js` to keep it that way.

A player who never plays online never has any of this happen to them.

---

## THE ORDER TO BUILD IT

1. **Identity alone.** Guest rows, sessions, the token, and the adoption
   of existing SOC ids. No storage at all. Prove an account exists,
   survives a reinstall, and that two devices can hold sessions at once.
2. **The token at the relay.** The hello carries a token, the name comes
   out of it, the client stops asserting one. Guests get generated
   names. This is where the forged-name hole closes.
3. **Provider linking.** Google first — Apple needs a paid developer
   account and Play Games only earns its keep if an Android build
   exists.
4. **The card and the blob, backup only.** Upload on save, list on
   demand, download on request. Local unchanged, and a failure is a
   message rather than a lost game.
5. **Chosen names**, once linking exists to hang them on: the handle
   endpoint, `handle_lc` unique, NAME-F1/F2 at entry, a rename limit.

Cloud saves as the source of truth are **not** on this list. That would
be its own arc, after a long boring stretch of the backup path working.

**THIS ORDER CHANGED AT STEP 3, AND THE REASON IS MAC'S.** The list
above hung chosen names off provider linking (step 5, "once linking
exists to hang them on") because a provider was assumed to be how a
player proves who they are on the next device. Mac's *"Username and
Password will be the main thing for the account"* makes the handle the
identity itself and the password the proof, so ACC1c shipped both
straight after ACC1b and a provider is now an optional convenience
rather than the foundation. Steps 3 and 5 collapse into that; step 4
is unchanged and next.

---

## ACC1b — SHIPPED 2026-09-21: the account service

`server-account/` — a second Cloudflare Worker over D1. Identity alone:
guests, sessions and the token. No password yet (ACC1c), no provider
links, no saves (ACC2). ~~It is written and tested and it is not
deployed, because creating a D1 database and putting a secret on the
account are things only Mac's Cloudflare login can do.~~ **ACC1-CI
corrected that** — the same token that deploys the relay does both, so
the deploy stands the service up itself and the D1 binding is live. See
*ACC1-CI* below.

**A GUEST IS A REAL ROW FROM FIRST CONTACT.** Not a lesser kind of
account — an account with no provider attached yet, which is the whole
of ACC0's wall and is why linking will migrate nothing.

**A SESSION IS THE CREDENTIAL, one per device.** Fight Life had one
secret per player and rotated it on sign-in, which made two devices
mutually exclusive: a desktop sign-in silently 401'd the phone on every
write, and Mac found it by playing rather than by reading. That bug is
not being ported, and the pin that holds it opens two sessions and uses
both.

**THE GUEST NAMES COME FROM DAGGERFALL'S OWN BANKS** — the same
`nameGen.json` the chargen wizard and every townsperson draw from — so a
visitor is an inhabitant rather than an Ochre Fox. Mithriil Stormaire,
Erebain Avalul, Karodell Bluethorn.

**AND A GUEST NAME CANNOT COLLIDE WITH A HANDLE, STRUCTURALLY.** A
generated name carries exactly one space; a chosen handle carries none.
No lookup, so nothing can race a rename — the alternative, checking each
generated name against the handle table, answers "not taken YET".

That law was nearly written the wrong way, and the way it failed is the
point: **the first cut spelled the guest shape as `[A-Za-z]+ [A-Za-z]+`
and its own pin caught `Akh'ar Arabi` on the eighteenth draw.** DFU's
banks carry apostrophes and hyphens. Enumerating an alphabet is how a
rule comes to disagree with the data it is about, so the law rests on
the space alone now, and a pin derives the bank's whole alphabet and
asks the one question that would actually break it — does any part carry
whitespace?

**THE SQL IS THE REAL SQL.** D1 is SQLite, so the pins apply the real
migration to a real SQLite through a D1-shaped adapter. The schema, the
UNIQUE index and the foreign key under test are the ones that will be
live; a hand-rolled fake would have proved only that the fake agreed
with itself, and would have been green over a typo'd index. What it
does not prove is written into the file: no network, no Cloudflare, no
D1 limit.

`handle_lc` is UNIQUE, which is the gap in the schema this was lifted
from. Fight Life's `handle` has no constraint at all — defensible for a
name beside a ladder rating, and not where the name *is* the identity.

15 mutants, 13 dead, 2 recorded equivalent. **Both survivors were real
holes.** The modulo-bias pin could not see plain `% n` at all: over
exactly 255 accepted draws, the biased and unbiased spellings both come
out 85/85/85, so the rejection is now asked the one way that cannot be
faked — a generator offering only the value above the last whole
multiple must never answer. And nothing had ever *sent* a name in a
token request, so a client-asserted name could have come back signed,
which is worse than an unsigned one because the relay would believe it.

## ACC1c — SHIPPED 2026-09-21: the username, the password, and the one way back in

Mac: *"Also want to mention I want email completely optional. Username
and Password will be the main thing for the account"* — and, asked what
a player does who forgets one: *"Yes"* to a recovery code.

**EMAIL OPTIONAL MEANS PASSWORD RESET IS IMPOSSIBLE.** There is no
address to send a link to and no second fact about the player the
service holds, so a forgotten password would be a lost account — and
with it the cloud saves, which are the only reason the account exists.
A design whose failure mode is "your forty-hour character is gone" is
not one to ship quietly, so the recovery code is not a nicety here; it
is the whole of what email would otherwise have been.

The code is minted at registration, shown **once**, and stored exactly
as the password is: hashed, salted, unreadable on this side. Spending it
sets a new password **and mints a new one**, because a player left with
no way back in has simply had the same cliff moved one step away.

**REGISTERING IS AN UPGRADE IN PLACE.** The guest row *is* the account —
ACC0's wall again — so a handle and a password are two columns filling
in on a row that already exists, and the id, the sessions and (later)
the saves come along untouched. Nothing migrates.

**PBKDF2-SHA256 AT 210,000 ITERATIONS**, because it is what WebCrypto
gives a Worker. scrypt and argon2 are better and neither is available
without shipping WASM into a hot path; that trade is written in
`server-account/src/password.js` rather than pretended away. **The
stored form is self-describing** — `pbkdf2-sha256$<iters>$<salt>$<hash>`
— so the count can be raised in a year and every existing row still
verifies under the count it was written with, then gets rewritten at the
new one on its owner's next correct login. A bare hash column cannot be
upgraded without logging everybody out.

**THE RECOVERY CODE ROUND-TRIPS, AND THE PIN FOUND THE BUG THAT SAYS
WHY THAT IS WORTH PINNING.** The first cut folded Crockford's ambiguous
letters as `O→0`, `I/L→1`, **and `Q→0`, `U→V`**. But **Q is in the
alphabet** — so the very first code the generator printed,
`7GEPQ-47BS9-AYK70-QMWYW`, could never have been typed back in. A
generator and a reader that disagree about their own alphabet lock out
exactly the people who need the code, and nothing but a round trip
catches it. The folding is now the three letters Crockford actually
folds, and 2000 minted codes go back through the canonicaliser
lowercased, spaced and mis-typed.

**LOGGING IN COSTS THE SAME FOR A HANDLE NOBODY HOLDS.** A miss derives
against a dummy stored hash instead of returning early, because a fast
401 is a free enumeration of the whole player table. The pin measures
it rather than reading the code, which is the only way that claim means
anything.

**GUESSING IS THROTTLED PER HANDLE AND PER ADDRESS**, ten in fifteen
minutes, in a `rate_limits` row rather than in memory — a Worker isolate
is not a place to keep a counter, and one that lives there is reset by
the platform whenever it feels like it. The correct password is refused
too while the window holds (a throttle a right answer walks through is
not a throttle), and a successful login forgives the key, so somebody
who mistyped twice is not still on a countdown.

**A PASSWORD IS CHANGED WITH THE OLD ONE**, even from inside a live
session: a stolen phone should not be able to lock its owner out. That
act signs every *other* device out and keeps the one that proved the old
password. Recovery signs out *every* device including the one standing
there, because the reason somebody is recovering may be that another
person has their password.

**AND EMAIL IS COMPLETELY OPTIONAL AND MEANS IT.** The account
registers, logs in, recovers and changes its password with no address
ever set; an address a player never gave is not in the account view at
all; one that is given can be taken off again; and nothing anywhere is
gated behind having one.

`0002_passwords.sql` is a **separate migration and it is not
idempotent**, which 0001's note nearly got wrong for it: `ALTER TABLE
ADD COLUMN` has no `IF NOT EXISTS`, so applying 0002 twice errors with
`duplicate column`. That is a refusal rather than damage — nothing is
half-applied — and the migrations are applied once each, in order.

18 mutants, 16 dead, 2 recorded equivalent: the compare's short-circuit,
which is not measurable through a PBKDF2 derivation that dwarfs it, and
a refusal-naming mutation that moves both spellings together, so the
equality the pin actually asserts still holds.

## ~~WHAT MAC HAS TO DO BEFORE ANY OF THIS IS LIVE~~ — ACC1-CI, and there is nothing

~~None of it can come from CI; it creates resources rather than
deploying code.~~ **That was wrong, and it was wrong on the same day
DEPLOY-PROSE finished paying for the identical mistake on the relay.**

Mac, reading the four-step list:

> The token provided allows you to take this on yourself. I am not
> needed at all.

He was right. The reasoning behind the list — *CI can deploy code to
resources but cannot create them* — is simply false of the Cloudflare
API token that has been deploying the relay since SRV-N/CI. The same
token creates a D1 database and sets a Worker secret. Every one of the
four steps had an idempotent spelling, and nobody had looked for one.

`.github/workflows/account-deploy.yml` now does all four on every push
to main that touches the service, and `server-account/wrangler.toml`
says so instead of carrying the list.

**A LIST OF MANUAL STEPS IS A DEPENDENCY ON SOMEBODY'S ATTENTION**, and
this arc had written four of them into the one place a person looks
last. The failure mode is not that a step is hard; it is that the
service sits finished and undeployed for as long as nobody has an
afternoon.

### What changed to make each step automatic

| step | was | is |
|---|---|---|
| the database | `d1 create`, then paste the id into the toml | created if absent; the id is **resolved from Cloudflare** and written into the runner's copy, never committed |
| the migrations | two `d1 execute --file` lines, "in order and once each" | `d1 migrations apply`, which keeps a `d1_migrations` ledger **in the database** |
| the signing pair | mint, then `secret put`, then copy the public half into the relay | minted **only if absent**, both halves piped straight in, public half served at `/v1/pubkey` |
| the deploy | `npx wrangler deploy` | on push, then verified by content against `/v1/health` |

**THE MIGRATION CHANGE IS THE ONE THAT WAS ACTUALLY LOAD-BEARING.**
ACC1c had to write a warning that 0002 is not idempotent — `ALTER TABLE
ADD COLUMN` has no `IF NOT EXISTS` — and then trust a reader to apply
each file exactly once. Wrangler's ledger makes that a property of the
tool. *"Apply each one once, in order"* was never a law; it was a hope
addressed to whoever read the comment.

**AND THE PUBLIC KEY HAD TO STOP BEING A THING SOMEBODY CARRIES.** The
old step 3 ended "…and the PUBLIC half into the relay's config", which
is a copy-paste between two systems performed by a human once, at a
moment nobody records. Now the pair is minted by a job no person
watches — so the service **publishes its own public half** at
`/v1/pubkey`, openly and before any credential, because a public key
can verify and cannot mint. ACC1d reads it from there.

That also closes the hazard the automation introduced: a pair minted
where nobody can see it, in a service that could not hand the public
half back, would be a verifying key nobody can ever read — and the only
way to get one would be to re-mint, which invalidates every token
already issued. The deploy's last step asks `/v1/pubkey` for a key and
fails if it does not get one.

### What the gate's own mutants found

`test/accountdeploy.test.js`, 6 pins; `tools/mutants/acc1ci.json`, 18
mutants, 17 dead and 1 recorded equivalent. **Four survived the first
run and every one was a hole in the pins rather than a mutant worth
keeping:**

- The sentinel check asked whether the workflow *contained* the string.
  The workflow's own header comment quotes it while explaining what it
  is for, so the prose answered for the code and a drifted shell
  variable sailed through. It reads the **assignment** now.
- The re-mint guard was checked as "`exit 0` comes before `secret
  put`". A mutant that moved the whole guard *down past the minting
  call* satisfied that and still re-minted on every deploy. The pin
  reads four landmarks in order now — look, bail, mint, put.
- The derived-host check asked whether the workflow contained one
  `grep '^name'` **anywhere**. There are two steps that build a URL; a
  mutant that hardcoded the host in one survived on the other one's
  line. It is asked per step now, of every step that builds a URL.
- The comment-exemption controls carried **copies** of the assertion's
  regex, so blanking the assertion left the controls proving only that
  two throwaway literals still matched each other. One regex, used
  three times.

**AND THE CAMPAIGN'S FIRST RESULT WAS ITSELF A LIE.** A duplicate
`const mint` made the test file fail to *parse*, so every mutant came
back dead — 17 of 18 green with nothing being asked at all. A mutation
campaign is evidence only if the unmutated suite is known to run, and
that is now the order it is done in.

### The one thing that is still a person's

The **Cloudflare API token itself**, in `secrets.CLOUDFLARE_API_TOKEN`.
It was already there for the relay; nothing about this arc adds a
credential anywhere. If that secret is ever missing or under-scoped,
the workflow's first step says so in one line rather than letting
wrangler fail four steps later with an authentication error that reads
like a wrangler bug.

## OPEN

- **Whether the hub moves out of the relay Worker.** It is in the
  bundle today, so a social change already drops every connected
  player. This arc does not create that and does not fix it.
- **Rename cost.** Fight Life gives one free rename and counts the rest.
  Whether a name is ever released back into the pool when an account
  goes quiet is undecided, and the answer decides whether `handle_lc`
  needs a tombstone.
- **What a guest's generated name looks like**, and whether it persists
  on the row across sessions. It should — "who was that?" is
  unanswerable otherwise, even inside one session.
- **Where the token is minted for the desktop app**, which has no
  browser origin to lean on.

## THE CREDENTIAL, and Mac's decision on it

The Cloudflare API token for this account was pasted into a chat and has
been live since. It was raised before this arc opened and raised again
when the arc did.

Mac, 2026-09-21: **"Im not rotating. Lets do this"**.

Recorded, and not re-argued. What it means in practice, so that a later
reader is not surprised by it: the same credential that can reach the
relay will be able to reach the account D1 and the save R2, and the
blast radius of this arc is therefore the whole of it rather than the
relay alone. The mitigations that do not need the token rotated are
still worth taking and are the ordinary ones — the token stays in the
repo's secrets and never in a file or on a command line (pinned by
`test/relaydeploy.test.js`), and the save blobs are a BACKUP, so the
worst case takes a copy rather than the original.

---

## ACC1a — SHIPPED 2026-09-21: the token

`src/net/identityToken.js` and `test/identitytoken.test.js`. The pure
law only: no Worker, no D1, nothing wired. Nothing imports it yet, so
the relay's bundle is unchanged and no deploy was forced.

**Ed25519, and no algorithm field.** A JWT names its own algorithm in a
header the verifier reads, which is the root of the whole `alg: none`
family — the attacker chooses how their signature is checked. The format
here is `v1.<payload>.<signature>` and **the version prefix IS the
algorithm**: the verifier knows exactly one version and refuses anything
else before parsing a byte. A pin holds the absence of `alg`, `typ`,
`kid`, `crv` and `jwk` from the payload, and holds at the source that
only one algorithm is named in the file at all.

**Every arm is a refusal, never a repair.** A token is the only evidence
there is, so a token that is not exactly right is not evidence. The
sharpest case is the name: `wire.js`'s `sanitizeName` falls back to a
safe string, which is right for a chat frame and wrong here — a fallback
would silently rename a player to something the account service never
issued. So the wire's law is asked as a QUESTION (`nameIsIssuable` is
"is this a fixed point of `sanitizeName`?"), and a signed token carrying
a name that is not is refused. **A key of ours signing a claim set we
would not have minted is a bug, and a bug is not an authorisation.**

**The lifetime is bounded by the VERIFIER**, not merely by the minter.
`exp` says when this token dies; `MAX_TTL_S` says no token may ever have
been issued for longer, which is what a token stolen off a client is
worth. A future slice that quietly raises the minter's own constant is
refused at the far end. Five minutes, because a token is spent ONCE on a
hello and the socket is the session from then on — it covers the walk
from "press Online" to "socket open" and does not need to cover a play
session.

**The relay holds a public key and a public key cannot mint**, which is
the whole reason the relay is allowed to be the bigger attack surface.
Driven rather than asserted: the pin imports the key the relay would
carry and proves `subtle.sign` rejects with it.

**The account id is SOC1's own shape**, and a pin reads
`net/social.js` to prove the two have not drifted — ACC0's adoption
depends on an id minted by the social arc being an id this token can
carry, so the day they part, this reddens.

16 mutants, 14 dead, 2 recorded equivalent. One survivor was a real
hole and is worth the sentence: removing the `try` around `JSON.parse`
survived the first pass, because the signature is checked FIRST and
every malformed body in the junk fixture died at `signature` without
ever reaching the parser. The only way there is a body that is
**correctly signed and is not JSON** — which means our own minter
shipped garbage — and the verifier must still refuse rather than throw,
because a throw out of a hello is ONCRASH1's lesson: it does not end
that socket, it ends the reader.
