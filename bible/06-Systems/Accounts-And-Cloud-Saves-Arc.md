# Accounts and cloud saves (ACC)

ACC0 — the design record, 2026-09-21. ~~Nothing below has shipped.~~
**ACC1a, ACC1b, ACC1c and ACC1-CI have shipped since**, and AUDIT-ACC
has been over all of them; the sections below carry their own dated
headings and this line was left stale for half a day, which is the
exact failure DEPLOY-PROSE was opened for. ~~Nothing is DEPLOYED yet:
the deploy fires on merge to main.~~ **IT MERGED AND IT DEPLOYED**
(6743d3bdb, 2026-09-21): the account service is LIVE at
`https://daggerfall-accounts.mackcothran.workers.dev`, `/v1/health`
serves `acct1`, and `/v1/pubkey` publishes the signing pair's public
half. The first-ever run created the database, applied both migrations
through the ledger and minted the pair, with nobody touching a
Cloudflare dashboard — and the relay deploy on the same commit finished
having deployed nothing, because `RELAY_VERSION` was unchanged, so not
one player was dropped. That is the two-Worker split's central claim,
demonstrated rather than argued.

This page is the shape agreed with Mac before any code, and it says
what is decided, what is lifted from another repo, what is genuinely
new, and what is still open.

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

**A SESSION IS THE CREDENTIAL, one per device** — and **AUDIT-ACC F6
corrected what this paragraph used to claim about it.** It said Fight
Life "had one secret per player" and that "that bug is not being
ported", which reads as though the fault were still live over there and
this arc had stepped around it. Reading
`fight-life-source/server/schema.sql` shows the opposite: they hit it,
Mac found it by playing (farming on one device while playing on the
other), and their Account-First arc replaced it with a sessions table.

**So this is their FIX, carried over, not a bug of theirs avoided.**
The shape is theirs down to the reasoning — a row per device, sign-out
revoking *this* session because every account system a player has used
behaves that way, "everywhere" as a separate explicit act, one indexed
lookup on the hot path, and a device label that is never trusted for
anything but display. Under-crediting a source you lifted from is the
same class of error as any other false claim in a record, and it is
worse here because the source is Mac's own other repo.

What this arc adds is that the property is **driven** rather than
inherited on trust: the pin opens two sessions and uses both.

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

## AUDIT-ACC — 2026-09-21, Mac: "Let's do a proper audit on everything"

Four lenses over ACC0-ACC1c and ACC1-CI. **Six findings, and the two
that mattered were both invisible to a green suite** — they were found
by standing the Worker up in a real workerd, which nothing in this tree
had ever done.

### F2 — THE WORKER DID NOT BOOT. AT ALL.

```
Uncaught TypeError: Incorrect type for map entry 'ACCOUNT_VERSION':
the provided value is not of type 'function or ExportedHandler'.
```

In a module Worker **every named export of the entrypoint is read as an
entrypoint** — a WorkerEntrypoint, a Durable Object, a Workflow. A
plain string is not one, so it is a hard startup failure.
`server-account/src/index.js` exported four constants and a test hook. The first `wrangler deploy`
after merge would have produced a dead service.

**AND THE SUITE WAS GREEN BECAUSE OF THE BUG, NOT DESPITE IT.**
`test/accountworker.test.js` imported `ACCOUNT_VERSION`,
`MAX_BODY_BYTES` and `_resetKeyForTests` — so it proved those exports
existed, which was precisely what the runtime was refusing to start
over. **Importability is not deployability**, and nothing here had ever
asked the second question.

The relay is the control and the reason the rule is stated carefully:
`server/src/index.js` exports `default` and `export class Room`, and has
deployed for months. A class is a legal entrypoint; a constant is not.
So the law is *no named **value** exports*, not *no named exports*.

Fixed by giving the constants and the key cache their own homes
(`service.js`, `signing.js`) and leaving the entrypoint exporting only
a handler. The entrypoint had been doubling as a library.

### F1 — THE RE-MINT GUARD FAILED OPEN, AND READ CORRECTLY

ACC1-CI's proudest guard — *never re-mint, because that invalidates
every token in flight* — never fired. `wrangler secret list` has no
`--json` flag; it takes `--format json`. Given an unknown flag wrangler
printed its **help text** and exited 0, `jq` could not parse that, the
`if` went false, and the step fell straight through to minting.

**Every deploy would have signed out everybody online**, while the
guard sat there looking right.

The flag was only the trigger. **The fallback was the fault:** `|| echo
'[]'` turns *"I could not read the secrets"* into *"there are no
secrets"* — a destructive default reached by ignorance. The listing must
now succeed **and** parse as an array, or the step fails and mints
nothing.

### The other four

- **F3 — not a defect.** A verify failure against the live `/v1/pubkey`
  turned out to be the audit's own harness calling
  `importPublicKeyB64(key, subtle)` instead of `(key, { subtle })`.
  Checked before it was reported.
- **F4 — the player id under two names.** `id` from `/v1/auth/guest`
  and `/v1/auth/login`, `playerId` from `/v1/account`, and `playerId`
  in the comment documenting the *guest* response. ACC1d would have
  read `account.id` and got undefined. Settled on `id` while nothing
  consumes it.
- **F5 — `.wrangler/` was not ignored**, so the local D1 and the
  workerd build of the Worker were staged for commit the moment anybody
  ran the probe. `.dev.vars` is ignored now too: it is exactly the file
  a signing key gets pasted into by accident.
- **F6 — the record under-credited Fight Life.** See the session
  paragraph above: it said *"that bug is not being ported"*, implying
  the fault was still live over there. They hit it, fixed it, and this
  is their fix.

### What the audit MEASURED rather than assumed

`tools/accountProbe.mjs` (`npm run account`) now stands the service up
on every run. 21/21:

- **Ed25519 exists in workerd** at the committed compatibility date —
  48-byte PKCS8, 32-byte raw public, 64-byte signature, verify true.
  The entire token design rests on this and it had never been checked.
- **PBKDF2 at 210,000 costs 36 ms** there, which is the `~35 ms`
  `password.js` claims. The claim was right.
- **Both migrations apply in order** through wrangler's own ledger.
- **A token the Worker signs verifies against the key the Worker
  publishes** — the exact seam ACC1d needs, both ends live, with a
  stranger's key and a bent byte refused as controls.
- **Nothing in this arc is in the relay bundle.** `RELAY_GRAPH` is 5
  files and none of them is `identityToken.js` or anything under
  `server-account/`. The two-Worker split's central promise — *this
  deploy drops nobody* — is now measured rather than argued. **ACC1d
  changes that:** the moment the relay imports the token module, it
  joins the bundle and every edit to it costs a deploy.

### The probe's own two bugs, and one that was mine

Its first run scored 19/21, and both failures were the probe's: it
counted wrangler's repeated summary table as duplicate migrations, and
it read `account.id` (which was F4). Then it began hanging for ten
minutes at a time — because **its fail-fast port check treated a
TIMEOUT as "port is free"**, which is exactly backwards. An orphaned
workerd accepts a connection and never answers, so a timeout is the
strongest evidence the port is *held*. One orphan poisoned every later
run. It now kills the whole process group (`npx` → `wrangler` →
`workerd`; killing the pid `spawn` returns leaves the grandchild
holding the port) and refuses a busy port in seconds with the command
to clear it.

---

## AUDIT-ACC, PART TWO — "Take your time"

The first pass was scoped to the six slices in the PR and stopped at
four lenses. Asked whether that was everything, the honest answer was
no: the token had never been read adversarially, the port had never
been read against Fight Life member by member, the credential paths had
never been read for security, and DEPLOY-PROSE had been audited
*around* but never itself. Four more lenses. **Eight more findings,
five of them live defects.**

### F7 — the bank could spell a name the wire could not carry

`NAME_MAX` is 24. The longest name the generator can produce is **25**:
`Kelkemmelian Larethbinder`, and three siblings sharing that surname.
Four of the 173,330 names in the space — about **one guest in 43,000** —
made `createGuest` throw, which `index.js` turns into a **500**. That
player could not get an account at all until they tried again.

The comment at that throw said *"the bank is the game's own, so this
should never fire"*. **Nobody had multiplied the bank out and compared
it to the bound.** This audit did: the space is a product of four
part-lists, so it is 173,330 strings and entirely enumerable.

It survived ACC1b's own testing for a structural reason worth keeping:
**that pin sampled.** It drew eighteen names and checked their shape —
and four in 173,330 is invisible to eighteen draws, essentially always.
The new pin enumerates the whole space; a second drives the exact byte
sequence that produces the bad name and proves an account comes back.

**Raising `NAME_MAX` was not available.** It lives in `src/net/wire.js`,
which is in the relay bundle — SLAM8 hashes that bundle's raw bytes, so
touching it costs a `RELAY_VERSION` bump and drops every connected
player. A four-in-173,330 cosmetic bound is not worth a dungeon run. So
the generator rejects those draws instead, which is the same rejection
sampling `pick` already uses one function above it.

### F8 — the token is a bearer credential and nothing considers replay

Not the code, not the pins, not this page. `verifyToken` closes
**forgery**: without the private key nobody can invent a name. It does
not close **replay** — there is no nonce, no audience, and no binding to
a connection, so anyone who obtains a token can present it as that
player until it expires.

Bounded by `MAX_TTL_S` and by TLS, and the stakes today are a name on a
roster. But *"the only people who can take a name are the people who
can be banned"* is weaker if a name can be **borrowed** for five
minutes, and that is a decision rather than something to discover after
ACC1d ships.

**MAC SETTLED IT (2026-09-21).** Asked whether to close replay or accept
the five-minute window: *"Yes"*. **A token is spent once.** The relay
keeps the signatures it has verified and refuses a repeat; `e` bounds
how long it must remember, so the set sweeps itself. It is cheap
precisely because of how this token is used — a client mints one per
connection from its session secret, so nothing legitimate ever presents
the same token twice. Rejected alternatives: a nonce claim needs shared
state to check and buys nothing this does not, and binding to the socket
is awkward over a WebSocket upgrade. **And the TTL ceiling belongs in
the relay's config beside the public key**, not passed in at a call
site: the relay hands `maxTtlS` to `verifyToken`, so a generous value
typed at whichever call happens to be in front of somebody silently
grants long-lived tokens — the second-home shape SLAM13 burned the relay
on.

**NOTHING ENFORCES IT YET, AND THE RECORD SAYS SO.** The refusal lives
in the relay, which does not import the token module. What exists today
is the decision, written into `src/net/identityToken.js` while that file
is still outside the relay bundle and editing its comments is free — and
a gate in `test/identitytoken.test.js` that holds it against
`RELAY_GRAPH` and **fails the day ACC1d puts the module in the bundle**.

That gate's second arm is a **tripwire on purpose**, and two wrong cuts
got it there. It first asked whether anything in the bundle matched a
seen/replay pattern, and passed the instant the module joined — because
the module's own note says the relay *"keeps the signatures it has seen
and refuses a repeat"*, so the comment describing the work satisfied the
check for the work. That is ACC1-CI's sentinel survivor verbatim, found
the same way: by simulating the event rather than trusting the pin. With
comments stripped and the module excluded from its own population, it
then **refused a real refusal** — `seenTokens` and `isReplay`, because
`\breplay\b` does not match `isReplay`. A pattern guessing identifier
spellings is an enumeration, and an enumeration disagrees with the code
the day somebody names something reasonably. A static grep cannot tell a
relay that refuses a repeat from one that mentions refusing a repeat,
and inventing the relay's API from a test file would be designing ACC1d
before ACC1d is written. So the arm does not try to be satisfiable: it
fails, says what must be true, and names the pin that must replace it —
one that presents the same token twice and proves the second is
refused.

### F9 — a session never expired

`SESSION_IDLE_S` was declared, documented as the bound *"before a sweep
may take it"*, and **used by nothing**. There was no sweep. An abandoned
credential — a shared machine, an old phone, a leaked backup — worked
forever.

Fight Life enforces it on the auth path rather than in a scheduled job,
and **deletes the row** rather than refusing it, so a dead credential
stops existing instead of being rejected forever. That is what is
carried over; it needs no cron that can silently stop running.

### F10 — a failed cosmetic write failed the whole request

The two `last_seen` touches were unguarded, so a D1 hiccup on a
freshness update turned an **already authorised** request into a 500.
Fight Life wraps its own touch and says why. Driven here by a database
that answers reads and refuses every `UPDATE`.

### F11 — an observation, not a change

`players.last_seen` is **written on every authenticated request and read
nowhere**; `devicesOf` reads the sessions' column. A player's last-seen
is the max of their sessions', so the column is derivable. It is still
written, because a column that silently stops being maintained is worse
than one that costs a write, and dropping it is a migration rather than
an audit's business. Noted for ACC2.

### F12 — only strangers were rate-limited

The open routes were bounded per address, on the door. **Everything
behind a session was unbounded** — one valid secret could mint Ed25519
signatures and spend D1 as fast as the network allowed. A limit that
stops strangers and not members is a limit on the wrong axis. Bounded
per **account** now, at Fight Life's own figure, and the refusal is
**429 rather than 401**: telling a rate-limited player their credentials
are wrong sends them to reset a password that was never the problem.

### F13 — the session secret rode in a URL

`/v1/account` read `?secret=`. The code excused it: *"it is read-only,
and a slice that makes it do more must move it."* **That answers the
wrong risk.** The hazard was never that the route mutates — it is that
a URL is written into Cloudflare's request logs, into any `Referer` the
page emits, and into browser history. Read-only or not, the credential
was in all three.

It is an `Authorization: Bearer` header now. The query-string door is
pinned **shut** rather than merely unused, the header wins when both
are present so two sources cannot disagree, and the CORS preflight is
checked to allow it — a header no browser is told it may send is a
header no browser sends.

### F14 — a claim in the pull request, not in the tree

DEPLOY-PROSE's description said the relay's deploy had been automatic
*"for fifteen weeks"*. `relay-deploy.yml` was added **2026-09-16**;
this is 2026-09-21. **Five days.** The tree itself never carried the
claim — it lived only in the PR body, which is to say in the one place
this project does not gate. Corrected there.

**And DEPLOY-PROSE is otherwise sound**, which is the other half of
auditing it: the two corrected files say true things, the gate holds its
derivation, and the `wire.js` exclusion's premise still stands — that
file still carries its stale sentence, so the gate still has something
to be honest about.

---

## AUDIT-ACC, PART THREE — "Before we merge. This is it?"

Asked a third time, with the merge in front of us. The honest answer
was again no, and the gap was specific: **the workflow that runs at
merge time has never run**, and several of its `jq` expressions were
guesses about wrangler's output. Those are checkable against wrangler's
own bundle rather than on main, and checking them found the worst
finding of the whole audit.

### F15 — the first run could not have succeeded

`wrangler secret list` asks Cloudflare for a Worker's secrets. On a
Worker that does not exist yet it does not answer empty — **it fails**:

```
Worker "daggerfall-accounts" not found.
If this is a new Worker, run `wrangler deploy` first to create it.
```

On the very first deploy that is the *expected* state. The minting step
ran **before** the deploy, so it would have aborted the job at that
listing and **nothing would ever have been deployed**. The first run of
this workflow was guaranteed to fail.

**And F1 is what made it fatal.** Before F1 the step swallowed the
failure with `|| echo '[]'` and blundered on into minting. F1 correctly
made an unreadable listing stop the job — and in doing so turned a
first-run certainty into a hard stop. **Both halves were right on their
own. The order was wrong**, which is why the pin now holds an *order*
rather than a line: migrations before deploy, deploy before mint, mint
before the pubkey check.

Deploying before the key is safe **because the service is built for
it** — a Worker with no signing key still hands out accounts and
answers `no-signing-key` rather than minting something the relay would
refuse. That arm has been pinned since ACC1b and this is the moment it
was for; the order pin names it, so deleting it is not a quiet change
to this order's safety.

### F16 — half the host was derived and half was typed

The verify steps built their URL from the worker **name** (read from
the config) plus a hardcoded account **subdomain** (typed beside it).
That is a second home for a fact, and it is the exact shape SLAM13
burned the relay on: a check pointed at a stale fact keeps passing, or
keeps failing, for reasons that have nothing to do with what it is
checking.

The deploy now publishes the URL wrangler says it landed on, and the
checks reach for that. The pin asserts **no `workers.dev` host appears
in any non-comment line** — which as a side effect makes the whole
workflow portable to any Cloudflare account.

### What was verified rather than assumed

Read out of wrangler's own bundle, because the alternative was finding
out on main:

| assumption | verdict |
|---|---|
| `d1 list --json` prints raw API records, no banner | **true** — `printBanner: (args) => !args.json` |
| the D1 id field is `uuid` | **true** — the raw `/d1/database` records |
| `secret list --format json` prints `[{name,type}]`, no banner | **true** — banner only for `pretty` |
| `secret list` on a missing Worker returns empty | **FALSE — it throws.** F15 |
| `secret put` reads a piped value | **true** — `process.stdin.isTTY ? prompt : readFromStdin()` |
| the host the checks reach | **was typed.** F16 |

---

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


---

## ACC1e — the account creation screen (2026-09-21)

Mac: *"Should we go ahead and build the account creation screen"* — and,
told it was the right thing to do before ACC1d: *"Yes, please be
detailed and match the enhanced aesthetic."*

**IT WENT FIRST BECAUSE IT IS FREE.** The card talks to the account
service over HTTPS and touches nothing in the relay bundle, so no
`RELAY_VERSION` bump and nobody is dropped. ACC1d costs every connected
player their session, and spending that once — after the screen exists —
means one deploy delivers something a player can see.

**IT GATES NOTHING.** It sits at the head of the Online pane, above
ONLINE1's card, and every button below it works with no account at all.
ACC0's wall is at cloud saves and nowhere else.

### The split: the flow thinks, the card draws

`ui/accountFlow.js` holds every stage, every field, every refusal and
every rule about what may be pressed. `ui/enhancedAccount.js` walks what
the flow says and makes DOM. That is `ChargenFlow` / `enhancedChargen.js`
again, and `test/enhancedChargen.test.js` says why: *"node cannot draw
them; what IS testable is the part that does arithmetic."* Everything a
player can get **wrong** about an account is arithmetic.

`net/accountClient.js` is the third piece — one home for where the
service is, what its routes are, and **what its refusals mean**. The
translation table is keyed by exactly the words `server-account/src/`
emits, and a pin walks that source: a word the service can answer with
and this side has no sentence for reddens. That is how `not-found` and
`no-database` were found missing.

### What the card is careful about

- **One press is one account.** Registering is two calls — open a guest
  row, then upgrade it in place — and a press between them opens a
  second guest row with no handle, no password and nothing that will
  ever adopt it. The pin holds the first call open and presses again.
- **A failed upgrade keeps the session.** `handle-taken` leaves a real
  row this device owns; dropping the secret would strand it and make the
  next press open another.
- **A dead credential signs the device out; a blip does not.** `auth`
  means the service has stopped honouring the secret. `offline` says
  nothing about it, and a player signed out by a bad second is a bug.
- **The recovery code is a stage, not a line in a corner.** Email is
  completely optional, so there is no reset link and this code *is* the
  reset. It is never written to storage, the only way off that stage is
  an explicit *"I have written it down"*, and a second way off would be
  a way to lose an account by taking it.
- **A password is sent exactly as typed.** The handle is trimmed; a
  password is not. Trimming here while the service hashes what it was
  sent is a login that works from this client and fails from every other.

### ACC1e F1 — a rule in the skin read a token nothing declares

`.card label.field .fieldlabel` said `color: var(--ash)`, and **nothing
in the tree has ever declared `--ash`** — one use, no declaration. The
property was invalid at computed-value time, so every field label in the
enhanced skin inherited `--bone` instead of a quiet label colour:
ONLINE1's two fields, the save slot's name, and this arc's, since the day
the rule was written.

No source sweep sees that — the rule is present and spelled correctly.
`tools/accountCardProbe.mjs` stands the card up in a real Chromium and
reads the **computed** colour, which comes back as `--bone` exactly. Put
the bug back and the probe fails naming the colour. `--dim` is what it
wanted and what `.card .meta` one line up already uses.

### The probe was photographing the fallbacks

Mac, seeing the first sheet: *"Does this use the enhanced font"*.

It does — a heading takes `var(--display)` and everything else
`var(--data)`, inherited from the skin rather than declared locally, and
that was true from the first commit. **But the sheet was not showing
them.** The probe injected `ENHANCED_CSS` and never loaded a single font
file, so Georgia stood in for Cormorant and system-ui for Barlow Semi
Condensed, and the result was photographed and offered as the design.

Declaring a family and rendering in it are different claims, and no
source sweep can tell them apart — the CSS is correct either way. The
probe now fetches the faces in node from the skin's own
`ENHANCED_FONTS_URL` and inlines them as data URIs, so the page still
makes no network call, and three checks ask the question directly:
`document.fonts.check` for whether the file actually arrived, and the
computed family on a heading and on body copy.

The same class of error as ACC1e F1, one level up: F1 was a rule that
looked right and never applied, this was a *measurement* that looked
right and measured the wrong thing.

### And the shapes moved, because the direction of every import matters

`GUEST_NAME_RE` and `HANDLE_RE` were born in
`server-account/src/guestName.js`. The client now has a field to type a
handle into and has to ask the same question — but every import in this
repo runs one way, `server/` and `server-account/` taking from `src/` and
never the reverse. A client file reaching into `server-account/` would
have been the only edge going backwards, and an architecture with one
exception in it is an architecture nobody can state.

**Both halves moved together**, to `src/net/handleShape.js`, because
ACC1b's own comment says why: *"both halves of it are exported from here
so neither can drift from the other."* Taking `HANDLE_RE` alone would
have broken the property that sentence exists to hold. `guestName.js`
imports and re-exports them, so every existing reader is unchanged.

`test/mutantdrift.test.js` caught the move and demanded the two `acc1b`
mutants be re-aimed by content, which they were.

### What is pinned

`accountflow.test.js` 21, `enhancedaccount.test.js` 12, and
`npm run acctcard` — 9 checks in a real browser at every stage, desktop
and phone. Mutants: `tools/mutants/acc1e.json`, 12, **12 dead and 0
survived**.

One survived the first run and it was a real hole: the "a password is
not trimmed" law was stated in a comment above `pw()` and asked by
nothing, so a mutant that trimmed passwords walked straight through a
green suite. It has its own pin now.

### Still open after this

The card creates an account that changes nothing a player can see until
**ACC1d** reads the name off the token (the relay), or **ACC2** brings
the saves. That is stated plainly in the card's own copy rather than
oversold. And the client now holds two identities — SOC1's hub-minted
`dagger.online.account` and this service's session — which ACC1b already
settled: the merge belongs at the hub, the only thing holding both
credentials at once.


---

## ACC1f — the account moves to the front door (2026-09-22)

Mac: *"In my mind for the online mode panel. I want it reserved for a
detailed tile based design for your saves which will translate to the
load character pane also... The online details itself will live as a
popup on main menu startup and a new profile icon."*

So ACC1e's card leaves the Online pane, which is being reserved for the
character tiles, and becomes two things on the pixel door:

- **A window over the home screen**, offered once per visit to a device
  with nobody signed in. Mac: only when not signed in.
- **A profile mark, top-right** — the corner the foot's About box does
  not use. It reopens the window any time.

**IT IS AN OFFER, NOT A GATE.** ACC0's wall is at cloud saves; every
door on the screen works without an account. It closes on Escape, on
the Close button, and on a tap outside, exactly as the pause window
does.

**ONCE PER VISIT, NOT ONCE PER RENDER.** `renderHome` runs again on
every skin switch, every Escape and every repaint. A window that
reopened each time would be one a player cannot get past, so
`accountOffered` latches on the first offer while the mark can reopen
it freely.

### Three things the screenshot found that no test would have

The card looked right standing alone. In its real host it did not:

1. **No scrim.** The door's own menu — CONTINUE, NEW GAME, ONLINE —
   read straight through the window. A modal you can read the page
   through is not one anybody believes.
2. **The heading was Cormorant in a pixel window.** `.shell .card h3`
   forces the pixel face, and the door is `.px-home`, not `.shell`, so
   the rule never reached it. The card's heading was the one thing on
   the door not drawn in whole pixels. Same for `.shell .act`, which
   left the card's buttons lowercase beside a spaced, uppercase CLOSE.
   Both rules are widened to the door's window rather than copied.
3. The window had no floor of its own.

All three are host-integration faults, invisible to a card rendered on
its own page — which is what ACC1e's probe does, and the reason the
question *"are the screenshots of each popup"* was worth asking.

### And a pin that had become false

`test/outsideTap.test.js` asserted `closeOnOutsideTap` appears in the
menu exactly **once**, with the reason *"the pause face only - the
front door has no scrim"*. True until this slice; the door has a scrim
now, exactly when the account window is open. The pin names **both**
wirings rather than counting loosely, so a third scrim added without
its own outside-tap still reddens — and it checks the account one is
guarded by `accountOpen`, because a front door wired unconditionally
would close on every tap.


---

## ACC1d — the design, before the code (2026-09-22)

Mac: *"Go in order. Take your time."* So: ACC1d, then ACC2, then the
tile picker. This section is the record ACC0 set the precedent for —
what is decided and **why**, written before anything is built, because
this is the slice that costs every connected player their session.

### The seam, as it is today

```
client   net/online.js  _helloFrame()  { t:'hello', id, secret, name, look, pose }
wire     net/wire.js    parseClient()  name = sanitizeName(m.name)
relay    server/src/index.js           m.name -> the attachment, join, chat, roster, the hub's account record
```

**The client asserts its own name and nothing checks it.** That is the
hole ACC1a opened this arc to close.

### What ACC1d adds

The hello carries `tok`. `wire.js` validates its **shape** only — it is
sync and pure and must stay that way. The relay **verifies** it
(`verifyToken`, async, needs the public key) and, on success, takes the
name **out of the token** instead of off the frame.

### D1 — is the token REQUIRED? No, and that is deliberate

Three ways to go, and the two rejected ones are recorded because the
reasoning is the load-bearing part:

- **Required.** Every client without one is refused. It closes the hole
  completely and it makes the relay unusable whenever the account
  service is down — a second Worker's outage taking the game offline is
  exactly the coupling the two-Worker split (ACC0) exists to avoid. It
  also breaks every client that has not reloaded, and a relay deploy
  drops everyone at once, so that window is real.
- **Optional, name from the token when present.** Costs nothing and
  buys nothing: a forger omits the token and asserts whatever they
  like.
- **Optional, and the relay says which names it VOUCHES FOR.** Taken.

A verified hello carries its name from the token and the join and
roster frames mark it. An unverified one is admitted exactly as it is
today. Impersonation stops being invisible: a name nobody signed is a
name the client can show as unsigned.

**AND THE HONEST LIMIT, stated here rather than discovered later:** a
token makes a name TRUSTWORTHY, it does not yet make one MANDATORY.
Until the requirement flips, a client can still assert any name it
likes — it simply cannot get the relay to vouch for it. ACC0's wall
("the only people who can take a name are the people who can be
banned") is not fully standing until that flip, and the flip is its own
slice with its own deploy.

### D2 — where the public key lives: the relay's config

`server/wrangler.toml`, as a var rather than a secret — a public key can
verify and cannot mint, so there is nothing to hide. Fetching
`/v1/pubkey` at runtime instead would put the account service in the
relay's startup path, which is the coupling D1 just refused.

It is a second copy of a fact the service publishes, so the **deploy
checks them against each other**: `account-deploy.yml` already reads
`/v1/pubkey`, and a mismatch means every verify fails silently, which is
the worst possible failure mode and the easiest to catch at deploy.

### D3 — the TTL ceiling lives beside the key

F8's second half. `verifyToken` takes `maxTtlS` from the caller, so a
generous value typed at whichever call site happens to be in front of
somebody silently grants long-lived tokens. It is config, next to the
key, with `MAX_TTL_S` as the hard ceiling the module itself refuses
past.

### D4 — one-shot, and exactly what that does and does not close

F8, settled by Mac: **a token is spent once.** The relay keeps the
signatures it has verified and refuses a repeat; `e` bounds how long it
must remember, so the set sweeps itself.

**IT IS PER-ROOM, because the relay has no global state that a hello
could touch without becoming a bottleneck** — ACC0 refused exactly that
for provider links, and a hello is far hotter than a sign-in. So:

- A token captured and replayed **into the same room** is refused. That
  is where the victim is and where impersonation is worth doing.
- A token replayed into a **different room**, or after that room's
  object has been evicted, is not caught.

Closing the second case needs shared state on the hello path. It is not
worth that, and saying so here is better than a comment claiming the
replay window is shut.

### What this costs

`wire.js` gains a field and `server/src/index.js` gains an import, so
`RELAY_GRAPH` grows and SLAM8's hash changes. **`RELAY_VERSION` bumps
and the deploy drops every connected player.** That is the price this
arc has been saving up for since ACC0 chose two Workers, and it buys
the whole token seam in one drop rather than several.

`test/identitytoken.test.js`'s F8 gate fires the moment the module joins
the bundle and must be replaced by a pin that presents the same token
twice and proves the second is refused. That is the point of it.

### D5 — the mark is CARRIED and it is not DRAWN, and that is on purpose

D1 says impersonation "stops being invisible", and that sentence was
one step ahead of the code when it was written. The relay decides `v`;
the question nobody had answered is what a player SEES.

The answer this slice gives is: the fact travels all the way to the
client, and nothing new is drawn. `v` rides the join, the welcome's
roster, the `who` answer and every chat line; `net/online.js` keeps it
on the peer as a hard boolean, and `net/chat.js` keeps it on the line
the panel draws from. What is missing is exactly one thing — a mark
beside a name — and that is a DESIGN, on a surface Mac reviews.

Two reasons for the split, and the second is the load-bearing one:

- Mac has not seen a mark. This session already shipped a sign-in
  window he sent back twice ("What the hell is this design", "Nothing
  is centered"); inventing a badge at three in the morning and calling
  the arc finished is how that happens a third time.
- **A relay deploy drops every connected player, and a client build
  does not.** If the flag stopped at the relay, the day the mark is
  drawn would cost another drop. Carrying it now makes the UI slice a
  client build and nothing else.

So the honest state, stated here rather than discovered later: after
ACC1d the relay knows which names it vouches for, the client knows,
and the player does not. That last step is a UI slice.

### AND ONE THING THE FIRST CUT GOT WRONG, worth recording

`rosterFor` did not carry `v`. The join frame did, so every peer who
arrived AFTER you would have been marked and every peer already
standing in the room would not — a signal that is true half the time,
which is worse than no signal, and one that could only have been fixed
by a second relay deploy. It was found by asking what the WELCOME
carries rather than by reading the code that was just written, and it
is why the pins walk both doors.

### SHIPPED 2026-09-22

- `src/net/wire.js` — the hello's `tok`, shape only; `rosterFor` carries
  `v`. `RELAY_VERSION` world84 → **world85**.
- `server/src/index.js` — `_named` verifies, spends the signature once
  (`SPENT_MAX`, swept by `e`), and takes the name out of the token; the
  attachment, the join, the roster, the `who` answer, the chat line and
  the hub's record all carry the decided name and `v`.
- `server/wrangler.toml` — `IDENTITY_PUBLIC_KEY` and
  `IDENTITY_MAX_TTL_S`, as vars (D2, D3).
- Both deploy workflows — the relay's copy of the public key is checked
  against what the account service publishes, on the deploy that can
  mint a new pair AND before the relay's own wrangler run. An
  unreachable service warns; a real disagreement stops the deploy.
- `src/net/accountClient.js` — `mintIdentity` and `accountTokenMinter`:
  one fresh token per connection, `null` for every reason a player may
  have none, never a throw.
- `src/net/online.js` — `mintToken`, `TOKEN_WAIT_MS`, an async open that
  is bounded and swallowed and re-checks its socket; `v` kept on the
  peer and on the chat line.
- `src/scenes/world.js` — ONE minter, handed to the presence session and
  to every channel link.
- Pins: `test/acc1dclient.test.js` (15), four new arms in
  `test/identitytoken.test.js`, one each in `test/relaydeploy.test.js`
  and `test/accountdeploy.test.js`. Mutants:
  `tools/mutants/acc1d.json`, 22, **22 dead and 0 survived**.

**NOT DEPLOYED.** The relay deploy fires on merge to main and drops
every connected player when it does.

---

## ACC2 — the design, before the code (2026-09-22)

Mac: *"Go in order. Take your time."* ACC1d is done; this is step 4 of
*THE ORDER TO BUILD IT* — **the card and the blob, backup only**.

The page above already decided the shape (*THE SAVES: R2 for the blob,
D1 for the card*) and the limit (*THE CLOUD IS A BACKUP AND A TRANSFER.
THE LOCAL SAVE STAYS AUTHORITATIVE*). What follows is what that shape
runs into once it meets `systems/saveSlots.js` as it actually exists,
and the decisions nobody had made yet.

### D1 — cloud saves are for LINKED accounts, and a guest is refused

ACC0's table says it and nothing has enforced it, because until now
there was nothing to enforce it on. The service checks it, not the
client, and the reason is sharper than "the table says so":

**A guest account is one storage clear away from gone.** That is stated
plainly in ACC0 as the residue of the wall. A backup filed under a
credential the player can lose by clearing their browser is a backup
that cannot be restored — which is the one promise a backup may not
break. Offering it would be worse than refusing it.

It is also, as ACC0 argued, the second reason to link, and the one a
player actually wants: a name, and their saves on the next device.

The refusal word is `not-registered`, which `accountClient.js` already
translates ("This account has no password yet.").

### D2 — a cloud slot is keyed by (character, SAVE NAME), never by the local index

This is the decision the existing code forces, and it would have been
easy to get wrong.

`systems/saveSlots.js` keys a slot in storage by an INTEGER — SAV4's
`CreateNewSavePath`, *"a new pair takes the FIRST FREE integer key"*.
That integer is a fact about ONE store. Two devices that saved in a
different order hold the same character's "QuickSave" under different
numbers, and a cloud keyed by the number would file them as two saves
and then overwrite the wrong one.

The slot's IDENTITY is already written down and is not the integer:
SAV4 takes it from DFU's `FindSaveFolderByNames` and CHARID1 corrected
its first half — **a save is (characterId, saveName)**. So that is the
key here too:

    PRIMARY KEY (player_id, character_id, save_name)

and the R2 objects hang off the same triple. The local integer never
leaves the device that minted it, which is exactly what CHARID1 shipped
for.

### D3 — R2 keys are player-first, so a deleted account is one sweep

    saves/{playerId}/{characterId}/{saveName}/data
    saves/{playerId}/{characterId}/{saveName}/shot

Player first is not cosmetic: R2 lists by prefix, so "delete everything
this account holds" is a prefix walk rather than a join against D1. A
save name is a player-typed string, so it is encoded into the key
rather than pasted into it, and the service bounds its length.

### D4 — the bounds, and the one that would have been missed

`MAX_BODY_BYTES` in `service.js` is **4 KiB**, and `readBody` enforces
it before parsing. Every route this service has today is a small JSON
body, so that bound is right for all of them and WRONG for a save,
which is hundreds of kilobytes. A save route that went through
`readBody` would refuse every real save; one that quietly bypassed the
cap would have no cap at all. So the blob routes read a RAW body with
their own, named bound:

| | |
|---|---|
| `SAVE_MAX_BYTES` | 4 MiB — a Daggerfall envelope is a few hundred KB; this is headroom for a long game and a hard stop for anything else |
| `SHOT_MAX_BYTES` | 256 KiB — a 320x200 JPEG is ~20 KB |
| `SAVES_MAX` | 60 slots per account |
| `SAVE_NAME_MAX` | 64 characters |

An account at `SAVES_MAX` is refused with `too-many-saves` rather than
having its oldest slot silently taken: this is a BACKUP, and a backup
that deletes things to make room is not one.

### D5 — a download does not get a new merge rule; it reuses SP1's

The obvious thing to write is a sync: compare timestamps, take the
newer. That is the design ACC0 refused — *"a design where the cloud is
the truth is one where a sync bug is catastrophic"* — and it would also
be a SECOND answer to a question this repo has already answered.

`systems/saveTransfer.js` (SP1) defines what happens when a slot
arrives from elsewhere, and it was written because a player thought
they had lost their saves:

> a slot never overwrites another: it takes its own number when that
> number is free, the first free one when it is not, and a slot the
> store already holds (same character, same slot name, same game
> minute) is skipped rather than doubled.

A cloud download is a slot arriving from elsewhere. It goes through
that law, unchanged. **The cloud is a third destination for a carrier
that already works** — the page said so before any of this was built,
and the carrier is where the merge rule stays.

### D6 — NOT automatic, and this is a narrowing of ACC0's step 4 with a reason

Step 4 says *"Upload on save"*. This slice does not do that, and the
departure is recorded rather than quietly taken:

- An upload inside the save path puts a NETWORK CALL in the one
  operation this game must never fail. `systems/save.js` handles
  `QuotaExceededError` by name today; it has no arm for "the account
  service was slow" and should not grow one.
- A backup that happens invisibly is a backup whose failure is also
  invisible. The whole point of ACC0's limit is that a failure here is
  *"a message rather than a lost game"* — and a message needs somewhere
  to appear.

So ACC2 builds the transport and the explicit push and pull. **The
trigger rides with the tile picker**, which is the next thing Mac asked
for and is the surface where a player can see a save go up and see it
fail. That keeps ACC0's promise rather than dropping it.

### D7 — the bucket is created by the deploy, like the database was

ACC1-CI's whole argument (Mac: *"The token provided allows you to take
this on yourself. I am not needed at all"*) applies unchanged: the same
API token that creates a D1 database creates an R2 bucket. So
`account-deploy.yml` creates it if absent, idempotently, before the
deploy — and the binding is in `wrangler.toml` where the D1 binding
already is. Nobody opens a dashboard.

### What this costs

**Nothing in the relay bundle, so NOBODY IS DROPPED.** `RELAY_GRAPH` is
unchanged by every line of ACC2 — which is the two-Worker split earning
its keep for the second time this week, and is why this slice can land
the day after one that dropped the whole room.

### ACC2a — SHIPPED 2026-09-22: the service half

- `server-account/migrations/0003_saves.sql` — the card, keyed
  `(player_id, character_id, save_name)`, with `bytes`/`shot_bytes`
  saying what R2 actually holds.
- `server-account/src/saves.js` — list, put the card, put a blob, get a
  blob, delete. Every statement binds the player the caller proved.
- `server-account/src/service.js` — `savePathOf`, `saveKey`,
  `savePrefix`, and the four bounds. `ACCOUNT_VERSION` acct1 → **acct2**.
- `server-account/src/index.js` — the seven routes and the wall.
- `server-account/wrangler.toml` — the `SAVES` R2 binding.
- `.github/workflows/account-deploy.yml` — creates the bucket if absent,
  before the deploy.
- `src/net/accountClient.js` — a sentence for each of the six new
  refusal words.

**Two pins fired on their own subject the moment this landed, and both
were right to.** `accountflow.test.js`'s refusal walk read three named
files and so missed every word `saves.js` returns — it walks the
service's whole `src/` directory now, because a three-file list is an
enumeration and an enumeration disagrees with the tree the day somebody
adds a file. And `accountworker.test.js`'s schema pin listed the tables;
`saves` arriving as its OWN table rather than as columns on `players` is
exactly what 0001's header promised would happen, so the list moved and
the promise is quoted beside it.

Mutants: `tools/mutants/acc2.json`, 14 at this slice, **14 dead and 0
survived** — ACC2b took the same file to 22, which is what it holds now.

**NOT DEPLOYED**, and when it is, it drops nobody: `RELAY_GRAPH` is
untouched by every line of it.

### ACC2b — SHIPPED 2026-09-22: the client half

`src/systems/cloudSaves.js`, pure over `{fetch, storage}` the way
`net/accountClient.js` is: push a slot, pull one, list, delete. No UI —
**the tile picker draws it**, which is the next thing Mac asked for and
the surface where a player can watch a backup succeed or fail (D6).

Three things it deliberately does NOT do, each because the answer
already exists somewhere:

- **It does not merge.** A download is a slot arriving from elsewhere,
  so it goes through SP1's `importSlots` unchanged. There is no
  timestamp comparison here and no conflict rule, because writing one
  would be a second answer to a question this repo answered when a
  player said "my saves its all gone".
- **It does not restate the size bound.** The service owns it and
  answers `too-large`; a copy of the number on this side is a second
  home for a fact, and the sentence a player needs is the same either
  way.
- **It does not own the service's words.** `CLOUD_REFUSALS` holds only
  the refusals this side can make, and a pin asserts the two tables are
  disjoint — one word, one sentence.

**The mutation campaign found a weak pin, which is what it is for.**
The encoding pin tested a save called `before the lich`, and a space
survives an unencoded path by accident because the URL constructor
escapes it — so the mutant that deleted every `encodeURIComponent`
walked through. It tests `a/b`, `danger#1`, `x?y` and `100%` now. The
hash is the sharp one: it truncates the path at the fragment, so
`danger#1` would have been filed and fetched as `danger`, and a player
would have restored the wrong game.

Mutants: `tools/mutants/acc2.json`, 22, **22 dead and 0 survived**.

### ACC2c — SHIPPED 2026-09-22: the surface, on the tiles

D6's trigger, where it belongs. The save tile (TILE1, recorded in
`bible/10-UI/UI-Arc.md`) carries ONE cloud line and at most one button:
*Not backed up* with **Back up**, *Backed up · 2 hours ago* with **Back
up again**, *Backing up…*, or the service's own refusal in ruby with
**Try again**.

**And nothing at all where there is no registered account.** ACC0's wall
is at cloud saves, and a player who has not asked for one is not told
about it on every tile they own — `off` is the state most players are
in, and it draws no line.

The listing is asked ONCE per visit to the menu and latches, because a
pane repaints on every press, every skin switch and every Escape; a push
clears the latch rather than patching the list, so what the tiles say
the cloud holds always came from the cloud.

**What is still not done, and is deliberately not:** nothing uploads by
itself, and a save that exists ONLY in the cloud is not drawn yet — the
tiles list what is on this device. Pulling a save down onto a second
device is `pullSlot`, it is pinned end to end against the real service,
and what it needs is a surface: a tile for a cloud-only save, with
**Download** where **Load** sits. That is the next slice, and it is
small.

(The DELETE was on that list too, silently — AUDIT-312 F1 found it and
paid it. See below.)

---

## AUDIT-312 — 2026-09-22, Mac: "Let's audit this"

The four slices on PR #312 that AUDIT-ACC had not seen, because they did
not exist when it ran: **ACC1d**, **ACC2a**, **ACC2b** and **TILE1/TILE2**
(the tile half is recorded in `bible/10-UI/UI-Arc.md`; the findings are
numbered once, here).

Five lenses, the arc's usual: does it RUN, is the service safe read
adversarially, what did it break, do the pins derive, and does the record
say true things. **Twelve adversarial mutants were written against laws
these slices claim**, and four survived. Everything below was driven, not
read.

### What held

- **The relay's token seam.** Four mutants at the sharp parts — a relay
  that vouches for names it cannot verify, a config var that loosens the
  module's hard TTL ceiling, a spend-set that sweeps itself empty before
  it is asked, and a client that puts `tok: null` in the hello (which
  `wire.js` refuses, so it would cost every signed-out player the room).
  All four died.
- **The save service's isolation.** A `DELETE` that reaches past its own
  account, a slot bound never counted, a thumbnail bounded by the save's
  4 MiB limit — all dead, and the announced-content-length check turned
  out to be pinned too (it was written off as un-pinnable and is not).
- **The recorded campaigns re-run honestly**: `acc1d.json` 22,
  `acc2.json` 22, `tile.json` 11 — **54 dead, 1 recorded equivalent, 0
  survived**, which is what the PR claims.
- **The Worker still boots** in workerd with ACC2's new R2 binding, and
  the migration ledger applies `0003_saves.sql` in order.

### F1 — THE DELETE HAD NO DOOR, and the refusal table already named it

`DELETE /v1/saves/{char}/{name}` existed. `removeCloudSlot` existed.
**Nothing called either**, and nothing in the record said so — ACC2c's
"what is still not done" listed the download and not this.

It is not a missing nicety. `SAVES_MAX` is 60, at the bound a new slot is
refused, and the sentence the player is handed is *"Your cloud backup is
full. Delete a save there to make room."* — an instruction to do
something **the game gave them no way to do**. An account that filled up
could never back up again.

Paid: the tile's cloud line carries **Delete backup** on a backed-up
slot. It says *backup* because the tile already has a **Delete**, the
pane's own, which removes the save from this device — two buttons reading
`Delete` one row apart, one destroying the game and one destroying the
copy, is the worst label this menu could carry. It **asks twice** (the
armed slot is cleared by the press, by arming another tile, and by the
next visit to the menu), and `removeCloudSlot` never touches the local
store, because the cloud is the copy.

### F2 — `no-character` was a sentence no surface could show

A card written before CHARID1 has no character id. `cloudFor` returned
`off` for it, which draws **no cloud line at all** — so a legacy save sat
in the list with no backup button and no reason, beside tiles that had
one, and the sentence ACC2b wrote for exactly this case could never
appear.

Paid: a sixth cloud state, `wait`, with the sentence and **no button** —
the act it needs is loading the save, which is the tile's own Load. The
table's sentence was **shortened** to suit the surface it now has
("Load this save once, then it can be backed up."), because Mac's rule
for a tile is facts and no prose.

### F3 — the menu's cloud arithmetic was where no pin could reach it

The decision about what a tile says — signed in, legacy, busy, refused,
backed up — lived inside `ui/enhancedMenu.js`, which is DOM and a boot
and which no node test in this tree can drive. Three mutants of it went
through **the whole suite** untouched:

| mutant | what a player would have seen |
|---|---|
| `card.bytes > 0` → `card` | an upload that died between the row and the blob reads as **Backed up** |
| the listing patched, not re-asked | a backup that lands never changes the tile until the menu is closed and reopened |
| the slot key drops the character | every character's QuickSave is one slot: one spinner, one error, one armed Delete on all of them |

Paid at the root: the decision is `ui/saveTile.js`'s `cloudStateOf`
(pure, beside the states it names, returning a refusal **word** and never
a sentence), and the slot key is `systems/cloudSaves.js`'s `slotKeyOf`,
which is the module that owns "a slot is (character, save name)". What
is left in the menu is the handlers, which is all a menu should hold.

### F4 — `tools/accountProbe.mjs` never saw ACC2

The probe exists because **importability is not deployability** — it was
written the day the Worker could not boot while the suite was green. ACC2
added a whole new binding (`SAVES`) and seven routes, and the probe never
touched them.

The gap is worse than it looks: **a binding that is absent does not
crash.** `env.SAVES` missing answers `no-storage`, which reaches a player
as "Cloud saves are unavailable right now" — with a green suite and a
green deploy behind it, for ever.

Paid: the probe drives a whole save round trip in workerd against its own
R2 — the guest wall, a blob refused without a card, the card, the bytes
back **byte for byte** as an octet-stream, the shot bounded apart from
the save, another account refused a read and a delete, and the player's
own delete taking the object as well as the row.

**And the probe was only ever correct once.** `wrangler --local` reuses
its state under `server-account/.wrangler`, so the second run registered
a username the first had taken and logged in with a password the first
run's recovery check had changed — six failures that were about the last
run rather than about the service, and a migration check that read "no
migrations to apply" as "no migrations". It stands on a fresh
`--persist-to` directory now, and two runs back to back are 36/36 twice.

### F5 — the extraction changed the ten heads' contract

TILE1 lifted the face drawing out of `systems/chargenSession.js` into
`ui/facePortrait.js`, which is right. But the new one ends
`.filter(Boolean)` and the old one did not.

`faceIndex` is on the save envelope and it addresses a **record number**.
`bitmapCanvas` returns null for a record with no data, so one bad record
shifted every later face down by one — while `ui/chargenArt.js`'s
`loadFaceSet`, the OTHER reader of the same ten records, pushes for every
index and never compacts. Two homes for the ten heads that disagree about
what index 5 means is precisely the drift the extraction says it exists
to prevent. Both readers already draw something where a face is missing,
so the hole is safe and it is kept.

### F6 — smaller, and recorded rather than paid

- **The cloud latch was per page load, not per visit.** ACC2c's record
  says "asked ONCE per visit to the menu"; the latch was module state and
  nothing cleared it, so a player who backed a save up on their phone and
  reopened this menu saw whatever listing was last fetched. A fresh mount
  clears it now (and the armed Delete with it — an armed destructive
  button must not outlive the screen it was armed on).
- **The spent-set's eviction comment claims more than it holds.** "past
  it the OLDEST goes, so a flood cannot evict the token somebody is about
  to present" — the set holds SPENT tokens, so what an eviction exposes
  is a replay of an already-presented one. The real bound is the 300 s
  TTL plus the mint rate (`ACCOUNT_MAX` 240/min per account), which makes
  4096 live entries in one room inside one token's life a deliberate act
  with several accounts, by somebody who already has the victim's token
  off the wire. Left as it is; the sentence is the thing that was wrong.
- **`encodeURIComponent` on the R2 key's player half is equivalent**, and
  that was DRIVEN rather than assumed: `accounts.js` mints ids base64url,
  so the call is a no-op over every id that can exist. Belt for the day
  that alphabet changes, recorded as equivalent in
  `tools/mutants/audit312.json`.
- **`pullSlot` is still the one live dead seam**, as ACC2c says — the
  cloud-only tile is the next slice.

Mutants: `tools/mutants/audit312.json`, 10, **9 dead and 1 recorded
equivalent**.

---

## AUDIT-PW — 2026-09-22, Mac: "Can you read those"

The two things AUDIT-ACC named as unexamined and never came back to:
`server-account/src/password.js` had never had the adversarial read the
token got, and `tools/accountProbe.mjs` had never been mutated. Both
were named again at the end of AUDIT-312, which is the second time a
record has said so — so they are done here rather than named a third
time.

### P1 — NOTHING MAY HASH AN EMPTY CREDENTIAL, and the hole was live

`codeForHashing` has **two contracts**. At the mint (`register`,
`recover`) a null is impossible; at the check a null is the ordinary
answer to a typo. **Nothing enforced the first.**

`normalise` answers `''` for anything that is not a string, so a minted
code that failed to canonicalise hashed the **empty string** into
`recovery_hash` — and `recover` compares `canon ?? ''` against that row.
Every account registered in such a window is opened by typing any string
that is not a code at all. Driven, before the fix:

```
codeForHashing('NOT-A-VALID-CODE!!')  -> null
hashPassword(null)                    -> pbkdf2-sha256$...   (of '')
verifyPassword(codeForHashing('total garbage') ?? '', that)  -> TRUE
```

**It has happened once.** password.js's own note records the Q fold
doing exactly this to `7GEPQ-47BS9-AYK70-QMWYW` — and the only thing
that caught it was a test over minted codes. Nothing in the code refused
to store the result, so the same shape would come back with the next
alphabet change.

Paid at the chokepoint: `hashPassword` refuses an empty normalised
input, because it is the one door every stored credential in this
service goes through. It **throws** rather than returning a refusal — a
caller that hands it nothing is a programming error, and the router
turns it into a logged 500 that stores nothing, which is the right
failure for this. Nothing legitimate is refused: `passwordRefusal`'s
floor is 8 and it runs first at all three password sites, and a minted
code is twenty characters.

### P2 — the constant-time compare failed OPEN

`timingSafeEqual` **coerced** anything that was not a `Uint8Array` to an
empty one. Two lengths of 0 XOR to 0, the loop never runs, and the one
primitive in this service whose whole job is to say NO said yes:

```
timingSafeEqual(null, null)      -> true
timingSafeEqual(undefined, {})   -> true
```

Unreachable today — `verifyPassword` is its only caller and always hands
it two real derivations — which is exactly why it could sit there. A
defensive default that defends in the wrong direction is worse than no
default, because it reads as care. Anything that is not a pair of byte
arrays is unequal now.

**And the campaign found this pin's own blind spot.** The loop reads
`x[i % x.length]` so that a byte is read on every iteration whichever
array is shorter — which means a short array that **repeats** into a
longer one matches it byte for byte, and the length XOR seeding `diff`
is the only thing that says no. A *prefix* dies without it; a *repeat*
does not, and the pin only tested a prefix. `[1,2]` against `[1,2,1,2]`
is held now.

### P3 — the mint's own guarantee, widened

What was P1's only guard is kept as a pin in its own right: 2,000 minted
codes must survive their own canonicalisation, and every letter the
alphabet **contains** must come back unchanged (the Q fold's shape,
stated as a law rather than as one remembered case).

### What held

PBKDF2-SHA256 at 210,000 with a per-account salt and a self-describing
stored form; NFKC before the KDF; the rehash-on-correct-login upgrade
path; `verifyPassword` deriving before it checks whether the row parsed,
so "no password" and "wrong password" cost the same; `parseStored`
refusing rather than throwing; the code alphabet a power of two with the
mask exact and a throw if it ever stops being one; and `needsRehash`
consulted only after a verified login.

Mutants: `tools/mutants/auditpw.json`, 6, **6 dead and 0 survived** (one
survived the first run — the repeat case above).

### And the probe has been mutated at last

`tools/accountProbe.mjs` was named never-mutated beside password.js. The
question a campaign asks of a PROBE is the inverse of the usual one:
**break the service, and does the probe go red?**

| mutant | the suite sees it |
|---|---|
| a named value export back on the entrypoint | **no** — workerd refuses to start over a constant while the suite stays green BECAUSE it imports those very names |
| the R2 binding renamed in `wrangler.toml` | **no** — the suite hands the Worker its own env and never reads that file |
| the hash cost raised out of a Worker's CPU budget | no — the suite gets slower and stays green |
| a migration that stops applying through wrangler's ledger | yes, but not through the ledger the deploy runs |

Mutants: `tools/mutants/acctprobe.json`, 4, **4 dead and 0 survived.**

---

## ACC1d-MARK — the mark over the head (2026-09-22)

Mac, asked where the relay's verdict should be drawn: *"Should be over
the head in online how it currently works."*

ACC1d ended by naming exactly one thing it had deliberately not done.
Its **D5** says it plainly: *"after ACC1d the relay knows which names it
vouches for, the client knows, and the player does not. That last step
is a UI slice."* This is that slice, and it is a **client build** —
which is the whole reason D5 carried `v` to the peer rather than
stopping it at the relay. No `RELAY_VERSION` bump, nobody dropped.

### THE POLARITY IS MAC'S, AND THE FIRST CUT HAD IT BACKWARDS

The first cut put a `?` on the names the relay could **not** vouch for,
reasoning that the useful signal is the missing one. Mac asked the
question that takes that apart:

> Why a question mark since even guests get a name?

He is right, and the answer is that **the verdict does not divide guest
from account.** A guest with a session mints a token like anybody else
and the relay vouches for the name inside it. What it actually divides
is **a name the player TYPED from a name the service ISSUED**:

- **No session.** The hello carries whatever stands in `onlineName` —
  the *"Name over your head"* field in `ui/enhancedMenu.js` — and the
  relay only sanitises it for length and for the word filter. It can be
  anybody's, which is the impersonation hole ACC1a opened this arc to
  close.
- **A session, guest or linked alike.** The account service signs a
  token and the relay takes the name **out of it**.

So the badge goes on the name that was **checked**. Three reasons, and
the third is the one that settles it:

1. It can only ever appear where the service issued the name, so it
   **never becomes wallpaper** — which the `?` would be today, with the
   account window an offer rather than a gate.
2. It is the shape every reader already knows: a mark you look *for*,
   not an accusation you have to learn to ignore.
3. **It fails safe.** A relay whose public key will not import vouches
   for nobody — so it badges nobody, where the old polarity would have
   accused every head in the room at once.

### Beside the name, never inside it

The name is centred on the skull. Prefixing a glyph into the string
moves the label off the head it belongs to — and only for the badged
peers, so it reads as *those* names drifting. So the badge is its own
draw in the classic face (`NAME_MARK_GAP_PX` to the left of the label's
left edge, measured off the name's own width) and its own `<span>` in
the DOM face, which also means `setText` on the name cannot wipe it
every frame.

### And the colour stays where it was

SOC4's party green says **who somebody is to you**. The badge says
**whether the service issued the name**. Two systems, one pixel, and the
colour belongs to the first — so the badge keeps the sheet's own ink and
the tint stays on the name element. Moving the colour up to the wrapper
to cover both is what the first cut did, and it broke two NAME1 pins,
which were right.

### ABSENT IS UNVOUCHED, and it is the relay's encoding that says so

The wire has **no `v: false`.** `server/src/index.js` sends
`v: who.verified || undefined` and omits the field otherwise, on the
join, the roster, the `who` answer and the chat line alike — a byte
saved on the frame every player sends. So the shape a real unvouched
peer arrives in is a peer with **no `v` at all**, and the client's read
is `e.peer.v === true` because that is the only reading that agrees with
the sender. `net/online.js` has normalised it to a hard boolean on the
peer since ACC1d, so the point sees one or the other and never the gap.

**The campaign found this one, not the reading.** MARK-7 flips the read
to `!== false`, and it *survived* the first run: every pin said `v:
false` out loud, which is a frame the relay never sends. Under this
polarity it is the worse bug of the two, because the badge is the thing
a player is asked to *trust* — so a mutant that badges the unchecked is
a lie rather than a missing warning. The pin holds the relay's own line
now, and a peer with the field missing entirely.

### ONE ASCII GLYPH, and ASCII is necessary rather than sufficient

The classic face draws through a Daggerfall bitmap font and can only put
on screen what that font has a record for — `drawText` draws **nothing
at all** for a glyph of zero width, so a badge the font lacks is one the
classic skin silently never shows while the DOM face shows it. A tick is
the obvious badge and is not in that font; `NAME_MARK` is `*`, the pin
holds it inside the font's own glyph range, and the mutant that swaps it
for `\u2713` is dead. **The limit, stated rather than left to be found:
this container has no ARENA2, so the real FONT0003 is not read here.**

### SHIPPED 2026-09-22

- `src/net/remotePlayers.js` — `NAME_MARK`, `NAME_MARK_GAP_PX`;
  `namePoints` carries `vouched` on the point (a fact about the PEER,
  unlike `colorOf`, which is the social system's knowledge asked for by
  id); `drawNamePoints` draws the badge beside the label.
- `src/ui/nameLayer.js` — the tag is a wrapper over a `.dfname-mark`
  span and a `.dfname-who` span; an empty badge takes no room
  (`:empty` drops its margin), so an unbadged label is exactly the
  element it was before this existed.
- Pins: `test/name1_bubbles.test.js` 20 → **21**. The fixture sets `v`
  EXPLICITLY and its default is **not vouched** — the plain label, which
  is what those pins are about and what an ordinary peer is today.
- Two neighbouring pins were re-aimed rather than worked around, and
  both got stronger for it. `test/soc4_partyhud.test.js` read the white
  fallback off the draw call; it reads it off the `tint` both draws take,
  so SOC4's law now covers the badge as well as the name — *SOC4 owns
  that colour and ACC1d-MARK does not get a second opinion on it.*
  `test/perfon_text_run.test.js` measured one draw per peer; it measures
  both cases, and a badged room is **2n draws and still nothing that
  scales with how long anybody's name is**, which is the whole of what
  PERF-ON was ever about.
- Mutants: acc1dmark.json, 8, **8 dead and 0 survived** (the file is
  gone with the slice - ACC1g retired it hours later, below).
  Two survived a first run. MARK-3: prefixing the badge INTO the name
  leaves the *run count* unchanged, so the pin read the badged peer's
  name draw as having the same glyph count as when nobody is badged.
  MARK-7 was the one above. MARK-8 held Mac's correction as a law
  rather than as a memory.

### AND THEN ACC1g RETIRED IT, hours later and for his own reason

The badge meant something only while a name could be VERIFIED **or**
TYPED. Mac closed the typed one the same night, so every name over
every head is a checked one and the badge appeared on all of them -
which is the wallpaper he named when he took the first polarity apart.
It is gone, with `NAME_MARK`, `NAME_MARK_GAP_PX`, the point's `vouched`,
the DOM layer's span, its pin and its campaign; `v` leaves the wire in
the same deploy, because the badge was its only reader.

**The mechanism is in the history and in this page, not in a dead
branch:** a mark beside a label, measured off the name's own width so
the label stays centred on the skull, drawn in both faces out of one
point, in the name's own colour. If a later slice needs one - a
moderator, a party leader, a mute - that is where to read how it was
done, and how not to do it (MARK-3 and MARK-7 both survived their first
run).

---

## ACC2c — the save that is only in the cloud (2026-09-22)

Mac, asked whether to build it: *"And yes."*

### ACC2 BUILT THE BACKUP AND NOTHING COULD READ ONE BACK

`pullSlot` was written, pinned end to end against the real service in a
real workerd, and had **zero callers.** Not a missing button — a missing
*surface*: a cloud card only ever reached a player as the cloud LINE on
a local tile, and a card with no local tile has no line to appear on.

So the one case cloud saves exist for did not work. A player who cleared
their browser, or sat down at a second machine, opened Load and saw
**"No saved games. Save a game and every slot of it appears here"**,
with their games three feet away in R2 and nothing on screen admitting
they existed. That sentence was the symptom and it is now one of the
things this slice deletes.

### The difference is a set difference, and it lives in `systems/`

`cloudOnly(cards, saves)` — the cards no local slot answers to, keyed by
`slotKeyOf`, the same key the cloud line is asked with. So a card gets
**a line on a tile or a tile of its own, never both and never neither**,
and the pin asserts exactly that, card by card.

It is not in the menu, and that is AUDIT-312 F3's finding taken
seriously rather than repeated: `ui/enhancedMenu.js` is DOM and a boot,
and the last copy of a slot key written there had **dropped the
character half** — which makes every character's QuickSave one slot —
and the mutant of it went through the whole suite untouched. Here, that
same mutant dies: one local QuickSave would otherwise hide *every* other
character's cloud QuickSave, and those saves would go on being invisible,
which is the failure this slice exists to end.

### The card is smaller than a save, so the tile says less

`server-account/src/saves.js` keeps eleven columns and **none of them is
a race, a class, a level, a health, a gold or a look.** None of it was
ever uploaded. So `saveFromCard` hands back a shape with those fields
**absent** — not zero, not a dash — and the tile degrades on its own:
`tileLine` joins nothing and is never appended, the stats list stays
empty and is never appended, and the well falls back to the character's
initial. **Not one special case in the drawing, and not one invented
fact.** Two mutants hold that line: a level read off `save_version`, and
the initial taken from the slot name so a tile reads `QuickSave` where
the character goes.

`gameTime` **is** classic minutes — `saveSlots.js`'s own `SaveInfo`
typedef says so of the very field `pushSlot` copies up — so the date and
hour are derived by the same two calls a local tile's are, rather than
by a second interpretation of one number.

### `only` is a seventh state, and its own whole ladder

Every rung of the local cloud ladder is a question about a *local* slot:
whether it predates CHARID1, whether its upload finished, whether it has
been backed up at all. **None is answerable about a save that is not
here** — a card with no `characterId` is still a card, not a `wait` — so
`local: false` is its own arm rather than a flag threaded through five
branches. What *is* still true of it is kept: a download in flight is
`busy`, and a refused one carries the service's own word.

The sentence is **"Only in your backup"**, not "Backed up". Under a tile
whose only copy *is* the backup, "Backed up" tells a player they have
two of something they have one of. It wears `is-only`, and the probe
reads it **brass** against the backed-up line's verdigris in a real
Chromium.

### One pane, and the delete that F1 half-finished

**Load, and no other.** Online brings a character in to play *now* and
cannot use a save that is not here, so offering it there is a two-step
act at a one-step door; Save writes rather than reads, and a cloud-only
slot in that grid would be an Overwrite target for a game this device
does not have. Load's whole job is getting a game back.

And the tile carries **Delete backup**, two presses, which is **the rest
of AUDIT-312 F1**: that slice gave a player the way to act on *"delete a
save there to make room"* and gave it to them on LOCAL tiles only — so a
cloud-only slot went on holding its share of `SAVES_MAX` with no surface
that could ever release it. Same word, same arm.

### SHIPPED 2026-09-22

- `src/systems/cloudSaves.js` — `cloudOnly`.
- `src/ui/saveTile.js` — `saveFromCard`; `CLOUD_STATES` gains `only`
  (appended, so nothing positional moves); `cloudStateOf` takes `local`,
  defaulting **true** so every caller written before this slice reads
  exactly what it read.
- `src/ui/enhancedMenu.js` — `download` (the caller `pullSlot` never
  had, through `runCloud`), `cloudForCard`, `cloudOnlyGrid`, and the
  narrowed empty case.
- `src/ui/enhancedStyle.js` — `.svcloudonly` and `.svcloud.is-only`.
- Pins: `test/cloudsaves.test.js` 19 → **21**, `test/savetile.test.js`
  11 → **13**. Probe: `npm run savetile` 18 → **29 checks**, which is
  where the heading's face, the brass, and a tile that could have
  collapsed to a strip were actually measured.
- Mutants: `tools/mutants/acc2c.json`, 10, **10 dead and 0 survived.**

---

## ACC1g — the wall moves to the door (2026-09-22)

> You shouldnt be able to just type a name and enter anymore.... this is
> what the account system is for

### THIS IS THE FLIP ACC1d NAMED AND DID NOT MAKE

ACC1d's own record says it out loud: *"a token makes a name TRUSTWORTHY,
it does not yet make one MANDATORY, and ACC0's wall is not fully
standing until that flip, which is its own slice with its own deploy."*
This is that slice.

Until here the hello carried a `name` **the client wrote** and the relay
only sanitised it. ACC1e put a text field in front of it — *"Name over
your head"* — and a URL could set it too. So anybody could type
anybody's name and walk in wearing it: the impersonation hole ACC1a
opened this arc to close, still open at the end of six slices about
closing it.

**ACC0's wall moves.** That page said *THE WALL IS AT CLOUD SAVES AND
NOWHERE ELSE*, and the argument was that a guest should be able to
connect, be seen, walk and chat under a generated name. **That argument
still holds and the wall still doesn't cost a guest anything** — a guest
session mints a token like anybody else, so the price of getting in is
one press of *Continue as guest* and no email. What changed is that
there is no longer a way to be in the room **unnamed by the service**.
Mac's own bargain from ACC0 — *the only people who can take a name are
the people who can be banned* — is the whole of it, and this is the line
where it becomes true.

### The relay refuses, and both arms are refusals

```
no token       -> 'sign in to play online'
no usable key  -> 'sign-ins cannot be checked right now'
token, bad     -> refused, loudly (unchanged)
token, good    -> the name out of the TOKEN (unchanged)
```

**The second arm changed direction.** While a token was optional, a
relay that could not verify admitted everybody unnamed, on the reasoning
that refusing the world over a mistyped config was the worse failure.
With the wall at the door that reading *is* the hole: a relay that
cannot verify cannot tell an issued name from a typed one. It fails
closed, and what keeps that from being how the game goes dark is at the
**deploy**, not here — both workflows check the relay's copy of the
public key against what the account service publishes, and a real
disagreement stops the deploy before a player sees it.

### What the player sees

The *"Name over your head"* field is **gone**, with the `onlineName`
pref and the `?name=` URL override behind it. In its place the Online
pane says who you are, read from the session on this device — a storage
read and no network, the same one the door's profile mark makes. Signed
out, it says why and offers the way in; **Play online** is a dead button
rather than a live one that fails at the relay.

**NAME-F2's entry half moved and did not disappear.** The filter that
refused `Cum` at that field now refuses it at **registration**, where a
name is chosen once instead of re-judged on every press:
`handleRefusal` ends in `nameIsIssuable`, which is
`sanitizeName(h) === h`, which is the very function carrying
`nameAllowed`. One filter, one home, asked earlier and asked once.

### `v` leaves the wire, and the mark with it

Every admitted socket is verified now, so the per-name verdict on the
join, the roster, the `who` answer and the chat line said the same thing
about everybody — a field carrying no information. It goes in **this**
deploy rather than a later one, because a wire change costs a drop and
this deploy is already paying for one. ACC1d-MARK, its only reader, is
retired above for the same reason: a badge on every head is no badge.

### What the fixtures learned, which is a finding about the tests

**Eighty-nine relay pins went red on the gate**, and that is the gate
telling the truth about what every one of them had been assuming. The
fix is not a back door in the room: `test/fakeRoom.mjs` mints a **real
Ed25519 token** against a real key and the room really verifies it, so
those pins now run through the door a player runs through rather than
around it. Three things fell out of it:

- **The token's name is the frame's**, because the relay takes the name
  out of the token and ignores the frame's. A harness that signed one
  name and typed another would be re-proving that the frame is ignored,
  in every pin that ever names a peer.
- **`n16` cannot be minted.** Two fixtures named their peers `n${i}` and
  `N${i}`, and the sixteenth folds to a slur under NAME-F1's leet
  normalisation — so `sanitizeName` answers `Traveller` and
  `nameIsIssuable` refuses. The old fixtures never noticed because
  nothing checked the name they typed. **A token has to be issuable to
  exist**, which is the filter reaching one layer further than it used
  to.
- **The harness's own uniqueness bug, found by the room.** The room
  spends a signature once and Ed25519 is deterministic, so two helloes
  for one identity need different claims. Counting mints and subtracting
  from the *current* clock cancels out the moment the clock moves: a
  test ticking its fake clock past a second boundary minted `nowS - 1`
  and then `(nowS + 1) - 2` — the same instant, the same bytes, refused
  as a replay. Each identity's issued-at is kept as a **value** now and
  only ever goes down.

Two pins were also measuring the wall clock without knowing it. WORLD1's
host tie-break gave the other three sockets a +10ms head start and
relied on the test reaching the hello inside that window; it freezes the
clock and sets three equal stamps now, which is what its own comment
always said the case was — *"the same-millisecond tie the smaller id
wins"*.

### SHIPPED 2026-09-22

- `server/src/index.js` — `_named` refuses both arms; the attachment,
  the join, the roster, the `who` answer and the chat line drop `v`.
- `src/net/wire.js` — `rosterFor` drops `v`; `RELAY_VERSION` world85 →
  **world86** (and ACC3 carried it on to world87 the same day, so both
  ride one drop).
- `src/net/online.js`, `src/net/chat.js` — no `v` on a peer or a line.
- `src/net/remotePlayers.js`, `src/ui/nameLayer.js` — the mark retired.
- `src/ui/enhancedMenu.js` — the name field replaced by who you are; the
  button gated on a session. `src/scenes/world.js` — the two typed name
  sources gone. `src/systems/uiPrefs.js` — `onlineName` gone.
- `test/fakeRoom.mjs` — `roomSigner`, shared with slam5's own harness.
- Pins: `test/identitytoken.test.js`'s two admit-arms rewritten as
  refusals; `test/acc1dclient.test.js`'s three verdict pins replaced by
  their inverse (no door may carry one, and a peer must not keep one a
  stale relay sends); NAME-F2, AUDIT-CHATR F2/F6 and SLOTS1 re-aimed to
  where the name is now judged.

**NOT DEPLOYED, and the price is the arc's largest yet.** The relay
deploy fires on merge to main: it drops every connected player, **and
from that moment nobody can join without a session.** Every player
online today is using a typed name.

---

## ACC1h — the Online pane is the tiles (2026-09-22)

> So the online pane should just be the new save panels, correct?

He had said it once already, when ACC1f moved the account card off this
pane: *"I want [the Online pane] reserved for a detailed tile based
design for your saves."* It was not. Above the tiles stood a heading, a
paragraph about what a shared world shares, a text field for a name, a
Relay field and a line telling the player to pick a character. ACC1g
took the name field; this takes the rest.

**The pane opens as the characters.** One card above them only when
nobody is signed in — the reason the buttons are dead, and the way in —
because a player looking at their own characters with every button
greyed out and no reason on screen is the fault this pane would
otherwise have.

### Nothing was deleted for tidiness

**The shared-world promise moved BELOW the tiles, not out.** AUDIT
WORLD34 D5's law is that *what a player is told here is the law*, and
the pins that hold that sentence against the relay's own behaviour are
the reason it says true things — it once said *"Nothing else is shared
yet"*, which WORLD1 had already made false. Twelve pins went red when it
was cut, which is those pins doing their job. So the rules a player is
agreeing to are still on the surface they enter through, where a page in
the bible cannot reach them; they are simply no longer in the way.

**The Relay field went with it,** and that is a compromise stated as
one: Settings is where an override a player sets once belongs, but
`ui/settingsMap.js` has no free-text row kind yet, and inventing one
inside this change is how a diff stops being reviewable. It cannot just
go — `scenes/world.js` still reads `onlineServer`, and deleting the only
way to set it would leave a read nothing can answer. **Owed: a text row
kind in settingsMap, and this field moved into it.**

---

## ACC3 — titles and glyphs (2026-09-22)

> Next feature before this becomes a live addition.
>
> 1. Player titles and Name glyphs
> Players can tap the account icon to equip 1 feature along with signing
> out.
>
> Player titles appear above a player name. We will develop 2 titles to
> start out.
>
> 1st title is Founder with a gold color
> 2nd title is Developer with a red color
>
> All current players should be granted the founder title
>
> 2nd is name glyphs. These small glyphs appear on the right side of the
> player name. These are as follows
>
> Sprouting green plant. Attached to new accounts for 2 weeks
>
> Developer glyph specifficaly for developers

Two answers settled the open halves of it before any code: **Developer
is granted by a config list of handles**, and **Founder goes to
registered accounts only**.

### EVERY GRANT IS DERIVED, AND NOT ONE OF THEM IS A COLUMN

This is the whole design, and it is this repo's own **DERIVED OVER
ENUMERATED** applied to the one place a grant is usually a row:

| | held when |
|---|---|
| **Founder** | `registered_at <= FOUNDER_UNTIL` (1790294400 — 2026-09-25T00:00:00Z since FOUNDER2; it was 1790121600, 2026-09-23T00:00:00Z) |
| **Developer** | the handle is in `env.DEVELOPER_HANDLES` |
| **sprout** | `nowS - created_at < SPROUT_S` (two weeks) |
| **dev** | the same list as the Developer title |

**Mac asked that "all current players should be granted the founder
title", and the obvious migration is an `UPDATE` over every row.** There
is none, and that is the design rather than an omission. A walk records
a fact ONCE, at a moment nobody can re-derive: a row added by hand
afterwards has no flag and nothing says why, a row restored from a
backup has whatever the backup had, and *"who is a founder?"* can only
be answered by reading every row. A cutoff answers it in one line, gives
the same set today, and is still right tomorrow.

**The sprout is the same argument with teeth.** A glyph that expires
after two weeks, *stored*, needs something to come along and remove it.
That is a cron, and a cron is a thing that can stop running while
everything looks fine — **AUDIT-ACC F9 settled exactly this**, one
system over, for idle sessions. Derived from `created_at` it expires
because time passed, which is not a job anybody can forget to run.

**And a developer is a list in config** because granting one is a thing
a person does by editing a reviewed, deployed file — not by reaching
into a live database at three in the morning. Taking a handle back off
that list is the whole of revoking it: the title and the glyph both stop
being signed for on that player's next token, with nothing to clear.

### D1 — HOLDING IS NOT WEARING, and only the wearing is stored

A player may hold two titles and wears at most one — Mac: *"equip 1
feature"*. `players.title` is the **only** column ACC3 adds, because the
worn title is the only part of a wardrobe that is a **choice**.

Equipping validates against the set derived *now*, and `titleWorn` asks
the same question again on the way out — so a developer taken off the
list stops wearing the badge without anybody remembering to clear a
column, and a column somebody edits by hand is not a grant.

`migrations/0004_titles.sql` is one `ALTER TABLE` and a long note saying
why there is no walk beneath it.

### D2 — THE BADGE RIDES THE SIGNATURE, and this is ACC1g's law one field over

ACC1g shut this hole on the **name** hours earlier. A title is the
stronger claim of the two: *"Developer"* over somebody's head reads as
this project's own word about them, and if the hello carried
`title: 'developer'` the relay could only sanitise it — the first person
to open devtools would be a developer.

So the account service, the only thing that knows what a player was
granted, **signs** `t` and `g` into the token, and the relay reads them
**out** of the verified claims exactly as it reads the name. `TITLES`
and `GLYPHS` are closed lists in `src/net/identityToken.js` and
`claimsValid` checks both *before* `verifyToken` says ok — so an unknown
badge cannot have been signed for, and the relay never re-checks one.

**The token is derived at mint**, so both lapse on their own: a token
lives `MAX_TTL_S`, which makes a badge at most five minutes stale.

### D3 — absent, never null

`wire.js` `badged` puts the two keys on a row **only when there is a
badge**, the same discipline `look.class` keeps two hundred lines up.
Most players wear nothing, so `"title":null` on every row of a 64-peer
welcome is bytes paid for saying nothing — and a reader that has to tell
*"no title"* from *"this build has no such key"* has two answers where
one will do.

It is one function, used by the welcome's roster, the join, the channel
roster **and the `who` answer** — that last one is built by hand rather
than by `rosterFor`, and is exactly where one peer comes to be the only
unbadged one in a badged room. That is a signal true most of the time,
which is the shape **ACC1d-MARK was retired for being**.

### D4 — it costs nothing NOW and would cost a deploy later

Mac's own framing: *"Next feature before this becomes a live addition."*
`identityToken.js` is in the relay bundle, so a claim added to it bumps
`RELAY_VERSION` and drops every connected player. **The deployed relay
is still world84**; world86 (ACC1g) and world87 (this) are both on the
branch, so all of it rides ONE drop rather than three. After that merge
each would cost its own.

### SHIPPED 2026-09-22 — the service, the token and the relay

- `server-account/src/titles.js` — new. The four grants, the wardrobe,
  the equip refusal. Pure, and it takes `env` and `nowS` rather than
  reaching for either.
- `server-account/migrations/0004_titles.sql` — new. `title TEXT`, and
  no walk.
- `server-account/src/accounts.js` — `accountWardrobe`, `equipTitle`.
- `server-account/src/index.js` — `/v1/auth/token` mints with the
  wardrobe; `/v1/account` answers it beside the account view; the new
  `POST /v1/account/title` equips one, or none.
- `server-account/src/service.js` — `/v1/account/title` in `ROUTES`;
  `ACCOUNT_VERSION` acct2 → **acct3**.
- `server-account/wrangler.toml` — `DEVELOPER_HANDLES`, empty. **It
  ships empty on purpose: nobody holds the Developer title until a
  handle is written there.**
- `src/net/identityToken.js` — `TITLES`, `GLYPHS`, `GLYPHS_MAX`; the
  `t`/`g` claims, minted and validated.
- `src/net/wire.js` — `badged`; `rosterFor` carries it;
  `RELAY_VERSION` world86 → **world87**.
- `server/src/index.js` — `_named` returns the badge off the claims; the
  attachment holds it; the welcome, the join, the channel roster and the
  `who` answer carry it.
- `test/acc3titles.test.js` — 13 pins. `test/fakeRoom.mjs` mints a
  badged token, and a `title` on a hello frame is **deleted** rather
  than sent: the relay ignores it, and a harness that could set one
  would be testing the wrong half forever.
- `tools/mutants/acc3a.json` — 12, all dead.

**OWED, and it is the half a player can see: `ACC3b`.** The name layer
does not draw either yet, and the account icon has no equip control on
it. Nothing above reaches a screen until it does.

### ACC3b — SHIPPED 2026-09-22: over a head, in both faces

**`src/ui/playerBadge.js` is the one home, and it is deliberately NOT in
`identityToken.js`.** That module owns what EXISTS and is in the relay
bundle, where a word of presentation costs a `RELAY_VERSION` bump and
drops every connected player — and the relay has no opinion about gold.
So the vocabulary is imported from there and the appearance lives here,
where it can be changed for nothing. A pin WALKS `TITLES` and `GLYPHS`
and requires an entry for every member, so a third title added to the
token cannot reach a screen as a blank.

**A glyph has TWO spellings and it is written down.** The enhanced DOM
layer can draw a sprouting plant; the classic bitmap pass draws through
a Daggerfall font and puts *nothing* on screen for a glyph that font
lacks — ACC1d-MARK learned that with a tick, one slice earlier. So each
glyph carries an SVG `path` for the face that can, and a one-character
`mark` inside FONT0003's own range for the face that cannot. The limit
is stated rather than left to be found: **this container has no ARENA2,
so the real font is not read by any pin — the range is.**

A title has ONE spelling, because it is a word, and both faces draw a
word. Only its colour is spelled twice (an RGBA array, `cssRgba` for the
DOM), which is exactly how SOC4's party green already crosses that seam.

**The title's colour is not `colorOf`'s.** SOC4 owns the NAME's green;
gold IS the Founder title. Either painted over the other erases a
distinction somebody asked for, so they are two labels with two owners
and a mutant holds the line.

**`readBadge` is the inverse of `badged`, and lives beside it** in
`wire.js` — the client's half of one field, so a badge cannot be written
one way and understood another. The relay never calls it (it reads a
badge out of a verified token, never off the wire); it is there because
the alternative is a second spelling of one law in `net/online.js`. It
CHECKS the vocabulary, because what arrives is a stranger's word: the
relay only sends what a signature carried, so anything else is a relay
that is older, newer, or not ours.

- `src/ui/playerBadge.js` — new. The words, the colours, the marks, the
  paths; `titleBadge`, `glyphBadges`, `glyphMarks`.
- `src/net/wire.js` — `readBadge`; `RELAY_VERSION` world87 → **world88**.
- `src/net/online.js` — the peer carries the badge, wears the NEWEST
  hello's including none, and the remembered introduction keeps it so a
  socket blip does not strip every title in the room.
- `src/net/remotePlayers.js` — the badge rides the POINT (a fact about
  the peer, unlike `colorOf`); the classic pass draws the title on its
  own line above and the glyphs inside the centred run.
- `src/ui/nameLayer.js` — `.dfname-title` above the row, `.dfname-glyphs`
  after the name, the run rebuilt only when the badge changes.
- `test/acc3badge.test.js` — 8 pins. `tools/mutants/acc3b.json` — 12,
  11 dead and 1 recorded equivalent.

**THE CAMPAIGN CAUGHT THE PIN THAT WAS SUPPOSED TO HOLD THE DRIFT.** A
badge beside a name widens the run the label is centred on, and a run
measured without it walks every badged name half a badge off its own
skull — NAME1's entire complaint, re-made sideways by the feature meant
to decorate it. The first cut of that pin compared two centres with a
four-pixel tolerance and the mutant walked straight through: a pin about
drift that tolerated the drift. The left edge is DERIVED now, through
the same `measureText` the draw uses and at the point's own perspective
scale — half the WHOLE run left of the head, and demonstrably not half
the name.

**And the recorded equivalent is honest rather than convenient.** The
client's glyph bound (`glyphs.length >= GLYPHS_MAX`) is unreachable by
construction: the duplicate test over a closed vocabulary already
implies it, and `GLYPHS_MAX` is that vocabulary's own length. It stays
because it is the TOKEN's bound restated at the client's door, for the
day somebody relaxes the duplicate test — AUDIT-PW P2 is the standing
example of why keeping such a guard is right.

### ACC3c — SHIPPED 2026-09-22: the control, and the roster

> Players can tap the account icon to equip 1 feature along with
> signing out.

Where he put it. The signed-in card gains a **Title** row of the titles
this account holds, and a **Glyphs** row beside it that is not pressable.

**THE CLIENT DOES NOT DECIDE WHAT IS HELD.** The grant is derived at the
service and can lapse *between the card being drawn and the button being
pressed* — a handle taken off `DEVELOPER_HANDLES` is the real case — so
the flow asks and takes the service's answer **whole**, including a
`titles` list that shrank in the same breath as the write. A client that
patched its own copy would go on offering a title nobody grants any more.

**Pressing the one already worn takes it off**, because a picker whose
only route to wearing nothing is a second button is a button that does
nothing most of the time — and Mac asked for one control.

**And the glyphs are not buttons.** A glyph is *true* of an account —
the sprout is its age, the dev mark is a grant — so nothing equips one,
and a control that cannot be operated is worse than a fact that never
offered to be. A pin reads the source to hold that.

### The card almost broke ACC1e's own rule, and the pin caught it

`ui/enhancedAccount.js` **may not style itself** — enhancedStyle.js's
header says why: *two copies of a design language is how the front door
and the rooms behind it drift apart*. The first cut of this slice wrote
`style.color` straight off the badge table, and ACC1e's pin went red.

It was right, and the fix is better than what it refused: the card
writes a **class**, and `enhancedStyle.js` emits one rule per title and
per glyph from `badgeCss()`, **walked out of the vocabulary**. The gold
on this card and the gold over a head are now one fact, and a third
title gets a colour without anybody remembering to write one.

`cssRgba` moved to `ui/playerBadge.js` with `ui/nameLayer.js`
re-exporting it — three surfaces cross that seam now, and a stylesheet
may not import a layer that drags the whole remote-player pass in behind
it. SOC4's pin that the party green survives the trip is untouched,
deliberately: moving that import would be a change to SOC4's seam for a
reason that is not SOC4's.

### The roster wears it too, and MY OWN ROW is the one that mattered

A roster is a list of names, and a name wears a title everywhere else it
is drawn — a bare one here is the same name saying two things on one
screen. **The relay never sends me my own roster entry**, so my row is
built from the session, and without the badge there the one name a
player looks at most would be the only one in the list with no title on
it. That is ACC1d-MARK's shape a third time: a signal true for everybody
but you reads as a fault in your own account.

It goes through `readBadge`, not a second spelling of the check. And it
is **in the repaint key** — that list redraws only when the key moves
(SOC3 put the open menu there for the same reason), so a title equipped,
or a sprout aged past two weeks, would otherwise stay correct in the
model and wrong on screen until somebody else joined the room.

- `src/net/accountClient.js` — `equipTitle`; `not-held` and `no-title`
  in the refusal table, two sentences because they are two situations.
- `src/ui/accountFlow.js` — `wardrobe` beside `account`, and `equip`.
- `src/ui/enhancedAccount.js` — the picker, `GLYPH_LABEL`.
- `src/ui/enhancedStyle.js` — the wardrobe's rules, plus `badgeCss()`.
- `src/ui/playerBadge.js` — `cssRgba`, `badgeClass`, `badgeCss`.
- `src/net/roster.js`, `src/ui/chatPanel.js` — the badge on a row.
- `test/acc3wear.test.js` — 10 pins. `tools/mutants/acc3c.json` — 12,
  all dead.

**THE CAMPAIGN CAUGHT A FIXTURE THAT PROVED NOTHING.** The pin for *"the
flow takes the service's answer whole"* had the service answer exactly
what a local patch would have produced, so the mutant that patches
locally walked through it. The fixture now answers a wardrobe that
**shrank** — the developer grant gone, the dev glyph with it — which is
the real shape of the case and kills it.

**STILL OWED: `DEVELOPER_HANDLES` ships empty.** Nobody holds the
Developer title until a handle is written into it. Mac (2026-09-22):
*"Ill have provide developer names once all our accounts are created."*

---

## RED1 — the server speaking (2026-09-22)

> Before we merge after everything, I want to set up a red text system
> (kind of like warframe) where I can message chat as the server before
> we merge.

Warframe's red text: the developer says something to everybody at once,
and everybody can tell it is not a player saying it.

### D1 — A LINE THAT LOOKS OFFICIAL IS THE MOST VALUABLE FORGERY HERE

*"The relay is restarting in 5 minutes."* *"There is a duplication bug,
log out now."* *"The developers are giving away X — click this."* Every
one of them costs a player something, and every one is free to whoever
can make a line look like the server.

So the authority is **a signature and nothing else**, and it is a
signature this arc already mints: `a.glyphs` on the socket's attachment,
written by `_named` out of the verified token claims and writable by
nothing else on that socket.

**The right to speak as the server is the same fact as the dev mark
beside the name.** Granted by a handle in `DEVELOPER_HANDLES`, revoked
by taking it off — within one token's life, with nothing to clear
anywhere, because the grant was never stored.

### D2 — NO SECOND CREDENTIAL, and that is the point

An admin password, a `/v1/broadcast` route, a separate signing key —
each was available and each is **another thing that can leak and another
thing somebody has to remember to revoke**. The one already here is
audited, already signed, and already expires.

The client never asks whether it may. Whether a socket can do this is a
question about a signature and only the relay holds the key, so a check
in `scenes/world.js` would be a second copy of an authority this side
does not hold — wrong the moment a grant lapses or arrives, and
protecting nothing.

### D3 — its own frame type, and no speaker

```
client -> relay:  {t:'say',  text}        shape checked by wire.js, nothing more
relay  -> all:    {t:'red',  text, at}    no id, no name
```

`net/chat.js`'s note beside `system` says why a notice must not be
recognised by a **name**: the relay lets a player call themselves
anything the filter allows, so a notice known by the string *"Server"*
would be one rename away from a player announcing a fake restart.

This is one step stronger. A flag on a chat line would be a **field**,
and a player can put a field on a frame. Its own frame type is something
a player cannot send at all, so the client marks the line from the type
and **there is nothing on it to forge**. It carries no id and no name
because nobody is speaking it — and that makes it a system line by
construction, which keeps every reader that already understands system
lines correct without being told (`bubbleLineOk` would otherwise hang a
chat bubble over the head of a peer whose id is the empty string).

### D4 — rated, and refused in silence

`RED_HZ_MAX` is its own bucket, under `CHAT_HZ_MAX`: a player's line
reaches a room, this reaches **every player in the game**. The grant says
who may speak and the bucket says how often; an authority with no rate is
one careless account away from an outage.

A player who sends `say` is **ignored, not refused**. A refusal would
tell a stranger the frame exists and is worth attacking.

### THE PINS CAUGHT A FEATURE THAT WOULD HAVE SHIPPED DEAD

`RED_HZ_MAX` was first written as **0.5** — "one every two seconds",
which reads perfectly well. `tokenGate` starts a fresh bucket with
`rate` tokens and a pass costs a whole one, so **at any rate below 1 the
first frame is refused and so is every frame after it.** Red text would
have been silently non-functional, in a slice whose entire point is
being able to say something when it matters.

It is 1 now; a pin holds the floor with the reason on it; and the
constraint is written at **`tokenGate`'s own door**, so the next slice
that wants "one every ten seconds" meets it before shipping rather than
after. That needs a different shape — a stamp of the last pass, not a
bucket — and whoever needs one should write that rather than pass a
fraction.

### SHIPPED 2026-09-22

- `src/net/wire.js` — `RED_HZ_MAX`, `redGate`, the `say` frame;
  `RELAY_VERSION` world88 → **world89**.
- `server/src/index.js` — the grant, the bucket, the fan.
- `src/net/online.js` — `sendRed`, `onRed`, gated coming in (CHAT-G).
- `src/net/chat.js` — `red` on a line, and every red line a system line.
- `src/scenes/world.js` — `/red <text>`, parsed and never guarded.
- `src/ui/chatPanel.js` — `.dfchat-line.red`, not an italic aside: the
  system's notices are asides and this is an announcement.
- `test/red1_server_say.test.js` — 9 pins. `tools/mutants/red1.json` —
  12, all dead.

**It rides the ordinary log**, so `ChatLog.peek` draws it over the world
for a player who never opens the panel. A broadcast nobody sees is not
one.

**HOW MAC USES IT:** sign in on an account whose handle is in
`DEVELOPER_HANDLES`, open chat, type `/red <the announcement>`. It
reaches everyone in the world channel — which is the one room every
player is in (ROSTER-G), so it reaches everybody, including players
down a dungeon. Until a handle is written into that config **nobody can
send one, including Mac**.

---

## ACC-CAP — the outage the arc shipped, and why nothing caught it (2026-09-22)

> The account service had a problem. Try again.

Mac, minutes after the merge went live, trying to create the account he
needed in order to send red text. **Every password route on the deployed
service was answering 500** — register, login and recover — and had been
since the moment they first deployed.

### The cause

**Cloudflare Workers refuses PBKDF2 above 100,000 iterations.**

```
NotSupportedError: Pbkdf2 failed: iteration counts above 100000
are not supported
```

It is a DoS guard on their side. ACC1c chose **210,000** — OWASP's figure
for PBKDF2-SHA256 — so every call to `hashPassword` and `verifyPassword`
threw, the router's catch turned it into a logged 500, and the client
showed its `server` sentence.

Guest sign-in was fine throughout, which is the shape that gave it away:
guests are hashed with **SHA-256** and never touch PBKDF2.

### Why every gate was green — and this is the finding

| | sees the cap? |
|---|---|
| `test/accountworker.test.js` (node) | no — node has no cap |
| `tools/accountProbe.mjs` (**real workerd**) | **no — workerd has no cap either** |
| `/v1/health` after deploy | no — it hashes nothing |
| a human registering | **yes, immediately** |

The cap is **production-only**. `wrangler dev`, Miniflare and node all
run higher counts happily.

**AUDIT-ACC F2 built that probe on the lesson that IMPORTABILITY IS NOT
DEPLOYABILITY** — the suite was green over a Worker that could not boot,
because the tests imported the very names workerd rejected. The probe
answered that by standing the service up in a real workerd.

**This is the same lesson one rung further out: LOCAL WORKERD IS NOT
CLOUDFLARE.** A probe in workerd proves the code runs. It does not prove
the platform will *allow* it. And the probe did not merely miss this — it
**measured it and passed**, printing *"PBKDF2 at 210,000 costs 36ms
there"* against a runtime that was never going to enforce the limit.

**A pin was actively holding the broken value.** `accountworker.test.js`
asserted `PBKDF2_ITERS >= 210_000`, *"below OWASP's current figure for
this pairing"*. It now holds the **platform's** bound instead, because a
number the runtime will not execute protects nobody.

### What it costs, said plainly

100,000 is below OWASP's recommendation (600,000 for PBKDF2-SHA256) and
below the 210,000 this arc chose. It is the most Cloudflare will run, so
the honest options were this or a different KDF, and a different KDF is
not a thing to design during an outage.

**It is not stuck here.** The stored form is self-describing
(`pbkdf2-sha256$<iters>$<salt>$<derived>`) and `needsRehash` upgrades a
row on its owner's next correct login — ACC1c built for exactly this. The
work factor can be bought back later by **chaining two capped
derivations**, with nobody logged out. And there was nothing to migrate:
**register had never once succeeded**, so no row was ever written at the
old cost.

### The gate that would have caught it, now standing

`account-deploy.yml` verified `/v1/health`, which proves the Worker is up
and serving this version and **nothing about whether it works**. It now
makes the one request no local runtime can fake: **a real registration
against the deployed Worker on Cloudflare** — a throwaway handle and a
guest row that costs nothing. A 500 there fails the deploy instead of a
player.

- `server-account/src/password.js` — `PBKDF2_CAP`, and `PBKDF2_ITERS`
  set to it, with the whole story at the constant.
- `test/accountworker.test.js` — the pin re-aimed at the platform bound.
- `tools/accountProbe.mjs` — asserts the cap as well as the cost, and
  says out loud that it cannot see the ceiling.
- `.github/workflows/account-deploy.yml` — the registration smoke test.
- `tools/mutants/acc1c.json`, `acctprobe.json` — both anchors re-aimed.

**THE DEPLOY THAT FIXES THIS DROPS NOBODY.** It is `server-account/`
only — the two-Worker split earning its keep on the day after the one
that dropped the whole room.

---

## NAME-ADOPT — the one person who could not see their own name (2026-09-22)

> 1. The top right corner button doesnt update with name
> 2. Ingame your name shows for other people but you still see your
>    character name in the chat menu

The first hour the arc was live, and the first account anybody made.

### One cause, two symptoms — and a third nobody had reported

The account service **issues** a name. The relay takes it out of the
token and shows it to everybody **else**. And this device **never took it
in for itself**:

- **Bug 1.** `register` answers the handle and a recovery code — *not* a
  session. So the session this device keeps was still written with the
  **guest's** name, and the top-right button reads the stored session.
- **Bug 2.** The online session was built from the **character's** name,
  under a comment that said it *"is carried no further"*. It was carried
  further: into the session's own `name`, which the chat roster draws
  **my** row from.
- **Bug 3, unreported.** The same thing on the badge. ACC3c built my own
  roster row from the session, and nothing had ever put a title on the
  session — so the first developer to equip one would have seen it on
  every screen but their own.

So everybody in the room read `Lattymoy`, and the one person who did not
was Lattymoy.

**And the answer was in hand the whole time.** `accountTokenMinter` kept
`answer.data.token` and dropped `name`, `kind`, `title` and `glyphs`
lying right beside it.

### The law

**The issued identity is the service's answer, and this device adopts it
wherever the service states it** — `/v1/account` and every
`/v1/auth/token`. One door writes it back (`adoptIdentity`), and the live
sessions take it in the same breath.

The door **never creates a session** — an answer landing after a sign-out
must not resurrect one — never touches the secret or the id, and writes
nothing when nothing changed, because a mint happens on every connect and
a store write is an event every open tab hears.

A host whose display seam throws **does not cost the hello its token**.
Since ACC1g a tokenless hello is refused, so a bug in how a name is
*drawn* would otherwise be a player who cannot *connect*.

### And the comment that caused it

It read *"fills the frame's shape and is carried no further. ACC1g-b
takes the field off the wire, in this same deploy."* Both halves were
false: the name went into the session, and ACC1g-b never happened —
`wire.js` still requires a name on a hello and the relay still ignores
it. Corrected where it stood rather than left for the next reader to
believe.

- `src/net/accountClient.js` — `adoptIdentity`; the minter adopts and
  calls `onIssued`, still returning the token alone.
- `src/ui/accountFlow.js` — `start()` adopts what `/v1/account` says.
- `src/net/online.js` — `adoptIdentity` on the session, through
  `sanitizeName` and `readBadge`.
- `src/scenes/world.js` — the session starts from the stored issued
  name; every mint corrects the presence session and every chat link.
- `test/nameadopt.test.js` — 7 pins, **each bug reproduced before it is
  shown fixed**. `tools/mutants/nameadopt.json` — 11, all dead.

**Client-only — no relay change, no account-service change.** It ships
with the site build and drops nobody.

## ACC4 — registered date and time played on the profile card (2026-09-22)

> Lets add an account registered date and time played to the icon profile

### The registered date was already a column

`registered_at` has been stamped by `register` since 0002. `accountView`
now carries it as `registeredAt`, **null for a guest** — there is no date
to show, and a 0 would print as 1970. The card draws a `Registered` row
only when there is a date; a guest's `Kind` row already says why not.

### Time played is measured by the service's clock, never the client's

The obvious build is a counter in the tab that posts *"I played 300
seconds"*. That is a number the client **asserts**, and ACC1g and ACC3
settled what this project does with a client's word about itself.

So a tab in the world sends a **beat with no number in it** every
`PLAY_BEAT_S` (five minutes) while the page is visible
(`src/net/playClock.js`). The service credits the gap from the account's
last beat **by its own clock**, capped at `PLAY_GRACE_S` (two beats,
derived). A gap wider than that is a new sitting and credits nothing —
the tab was closed, the machine slept, the page sat hidden.

- **A forged beat cannot credit more than real time.** The route never
  reads the body.
- **Two tabs, or two devices, count the wall clock once.** Each beat
  measures from whichever beat really landed last. That is why
  `creditPlay` is **one `UPDATE … RETURNING`**, not read-then-write: two
  beats in flight together would both read the same last beat and both
  add it. The pin drives exactly that race.
- **A late, out-of-order beat credits nothing** and does not drag the
  clock back (`MAX`).
- **The cost, said plainly:** the tail of each sitting — under one beat —
  is not counted, and the first beat of a sitting opens it rather than
  crediting. That is the honest price of never believing a client about
  a duration.
- **Guest time counts.** Registering upgrades the same row, so every
  minute a guest played is kept.
- **Every existing row starts at zero.** Nothing counted time before
  0005, so there is no history to derive from, and a backfill would be a
  guess written down as a fact.

The world host starts the clock once per page (bootWorld runs once),
online or not — a signed-in player in a single-player world is still
playing. The session is read at each beat, so signing in mid-sitting
counts from the next knock. An `auth` answer to a beat is **left alone**:
forgetting a dead session is the minter's and the card's job, each of
which can say so on screen.

### And a hole found on the way

`account-deploy.yml` fires on a path filter, and that filter named
`src/net/identityToken.js` as the one file outside `server-account/` the
Worker bundles. It bundles **six**: the handle shape, the name filter,
the wire, mat4 and the name tables as well. A change to any of those five
shipped nowhere. The filter now lists all of them plus `playClock.js`,
and `test/accountdeploy.test.js` **walks the Worker's import graph** and
holds the filter to it, instead of naming one file. The walk moved from
`relayversion.test.js` into `test/importGraph.mjs` so both Workers are
read by the same law; the relay's hash is unchanged.

- `server-account/migrations/0005_played.sql` — `played_s`, `played_at`.
- `server-account/src/accounts.js` — `creditPlay`; `accountView` gains
  `registeredAt` and `playedS`.
- `server-account/src/index.js`, `service.js` — `POST
  /v1/account/played`; `ACCOUNT_VERSION` `acct4` (and wrangler.toml).
- `src/net/playClock.js` — `PLAY_BEAT_S`, `PLAY_GRACE_S`,
  `startPlayClock`.
- `src/net/accountClient.js` — `beatPlay`, `accountPlayBeat`.
- `src/scenes/world.js` — the clock starts, gated on visibility.
- `src/ui/enhancedAccount.js` — `registeredText`, `playedText`, the two
  rows. It still styles nothing.
- `.github/workflows/account-deploy.yml` — the filter; the smoke step
  now beats a throwaway guest on real D1 and requires `playedS: 0`,
  because `RETURNING` and numbered parameters are exactly the class of
  thing node runs and a platform might not.
- `test/acc4played.test.js` — 13 pins. `tools/mutants/acc4.json` — 15,
  all dead.

**Account service + site only.** The relay's bundle is untouched, so the
relay deploy is a no-op and **drops nobody**.

## MOD1 — the moderator shield, /mute and /unmute (2026-09-22)

> Next up I want a moderator glyph and moderator chat commands

Asked which: **/mute and /unmute**, and the **blue shield**.

### Who is a moderator

`MODERATOR_HANDLES` in the service's config — the same law as
`DEVELOPER_HANDLES`: a reviewed, deployed edit grants it, taking the
handle off revokes it on the next token and the next call, and nothing is
stored. **Asynian** is the first (Mac: "Username is Asynian"). A developer may moderate
without being listed (`canModerate`), but the **shield** is the
moderator list's alone — the dev mark already says more. A guest can be
neither: the list names people, and a guest row is a device.

### Where the authority lives — and where it does not

A mute is an authority, and the build that passes a naive test is the one
where a client says *"I am a moderator, mute Bob"* and something believes
it. So:

- **The service decides.** `POST /v1/mod/mute {target, minutes}` checks
  the caller against the lists, **refuses a moderator or developer as a
  target** (a mod-on-mod fight is Mac's to settle) and a self-mute, bounds
  it at a week (`MUTE_MAX_MIN`, one home in `src/net/moderation.js`), and
  writes `muted_until` — ACC0's own column — with **`muted_by`**
  (migration 0006), so the power leaves a record.
- **The row is the truth, and every later token carries it** as the `mu`
  claim. A reconnect cannot shed a mute; every room reads it at the hello.
- **Live rooms hear it through a signed ORDER.** The relay cannot read
  D1, so the service also signs `{o:'mute', s, mu}` — a minute-long token
  of a **different shape** from an identity. One key signs both, and the
  shapes keep them apart: an identity needs an issuable `n`, an order must
  carry none. The moderator's client carries the order into every room it
  holds; **the relay checks the signature and never asks who carried it.**
- **The newest order wins.** A replayed mute inside its minute cannot undo
  the unmute that followed it, and a hello whose token predates the room's
  newest order takes the order's word — so a token minted a moment before
  the mute cannot carry its holder past it.

A muted player's line goes nowhere — not even back to them — and they
alone are told `{t:'muted', until}`. They still read chat.

### A name is not an account

Two guests can share a generated name. So chat lines and a channel's
roster carry **`sub`**, the sender's verified account from their token
(not `acct`: that word is the social hub's own id, a different law). The
command resolves a typed name against the players the relay has named,
and **two matches is a refusal, never a guess**. A name may have a space
in it — every guest's does — so the minutes are the last word.

### What it costs

**A relay deploy — `world90` — which drops every connected player once.**
The token module and the wire are in the relay's bundle. The account
service deploys beside it and drops nobody.

**Honestly bounded:** a player muted while standing in a place room the
moderator is not in is muted there on their next connection to it (every
room change is one), not instantly; the world channel — where everyone is
— hears it at once.

- `src/net/identityToken.js` — `mod` glyph, `mu` claim, `ORDER_KINDS`,
  `mintOrder` / `verifyOrder` / `orderValid`, one shared verify ladder.
- `server-account/` — `canModerate`, `isModerator`, `muteAccount`,
  `/v1/mod/mute`, `acct5`, migration 0006, `MODERATOR_HANDLES`.
- `server/src/index.js` — `sub` and `mu` on the attachment, the muted
  refusal, the `mute` arm, `_orders`, `_loadKey`.
- `src/net/wire.js` — the frames, `MUTE_HZ_MAX`, `subOf`,
  `mutedUntilOf`. `src/net/online.js` — `sub` on peers and lines,
  `onMuted`, `sendMuteOrder`.
- `src/net/moderation.js` — the commands, the lookup, the words.
- `src/ui/playerBadge.js`, `enhancedAccount.js` — the blue shield.
- `test/mod1.test.js` — 15 pins. `tools/mutants/mod1.json` — 20, all dead.

## MAIL1 — letters, kept for a player who is away (2026-09-23)

Addison Knox, on Discord: "An in-game mail system where players can send messages to offline players". The full
record is `06-Systems/Community-Arc.md` (MAIL1). This is the service's part of it.

- `server-account/src/letters.js` provides `sendLetter`, `inboxOf`, `readLetter` and `deleteLetter`. Letters go
  between registered players only, and the function refuses a guest itself (`mail-needs-account`) as well as behind the
  route's wall. It also refuses a muted sender (`muted`, 403), an unknown handle (`no-reader`, 404), oneself
  (`to-self`), and an hour's letters to anyone or to one reader (`mail-rate`, 429, spent before the lookup). A full
  box (`inbox-full`, 409) is bounded inside the INSERT, so the check and the write are one statement.
- `/v1/mail/inbox` (GET), `/v1/mail/send`, `/v1/mail/read` and `/v1/mail/delete` (POST, the letter's id in the body,
  never the path) all sit behind a session; none is open. The service is `acct6`, and migration 0007 adds `letters`:
  `to_id` cascades, while `from_id` and `from_name` are what was sent.
- `src/net/letterLaw.js` is the letter's law for both ends. The worker bundles it, so it is in the deploy's paths.
- `src/net/accountClient.js`'s one table has a sentence for every new word, since ACC1e's walk reads letterLaw.js too.

## TITLE-N and TITLE-R — the Dungeon Master, the Patreon tiers, and a roster of glyphs (2026-09-24)

Mac: "Titles shouldnt show in the online panel. Only gyphs. Titles should remain over names and within chat itself.
Remove the founder title from being obtained. Current users keep their founder title", and "Add 4 new titles/glyphs -
Dungeon Master is an orange title with its own glyph. This title allows the user to use the /dm to message chat with
orange text (similar to /red). This goes strictly to the account SquidKamer. Disciple, Apostle, Hierophant are new
patreon titles. These also recieve their own unique glyphs. The account Dutchess will recieve the Disciple title/glyph".

- **The vocabulary** (`src/net/identityToken.js`, in the relay bundle): the titles are `dungeonmaster`, `disciple`,
  `apostle` and `hierophant`, and the glyphs are `dm`, `disciple`, `apostle` and `hierophant`. Each title carries its
  own glyph. `src/ui/playerBadge.js` gives each title its word and colour: the Dungeon Master is orange (#ff8c1a), and
  the tiers are teal, violet and rose, since Mac named no colours for them. Each glyph takes its title's colour, and
  has its own shape (a d20, a flame, an open book, a crown) and a classic mark. `src/ui/enhancedAccount.js` names each
  one on the card.
- **The grants** (`server-account/src/titles.js`, `TIER_LISTS`): each title is a handle list in `wrangler.toml`, which
  is the developers' own law. `DUNGEON_MASTER_HANDLES = "SquidKamer"` and `DISCIPLE_HANDLES = "Dutchess,Satranath"` (Mac added Satranath the same day); Apostle
  and Hierophant are empty. A list grants its title and its glyph, and never to a guest. A lapsed Patreon tier is a
  handle taken off the list, and it disappears from that player's next token. The service is `acct7`.
- **/dm** is RED1's law, one glyph over. The client sends `{t:'narrate', text}` on the World link, and only from a
  world104 relay (`DM_RELAY_MIN`, since an older one closes the socket on the frame).
  - The relay accepts it only from a socket whose signed token carried `dm`. A developer, a player or a typed glyph is
    ignored in silence.
  - It is metered on its own bucket (`DM_HZ_MAX`) and fanned as `{t:'dm', text, at}`, with no speaker.
  - The client gates it coming in and keeps it as a system line on every tab, drawn in the title's orange.
  - The host parses it before /red and never guards it.
- **The roster** (the chat's online column) shows glyphs only. The title stays over the name (`ui/nameLayer.js`,
  `net/remotePlayers.js`) and on a chat line (`badgeNodes`).
- **Founder** is closed. It was already derived from `registered_at <= FOUNDER_UNTIL` (2026-09-23T00:00Z), so no
  account registered since then could obtain it, and every account that holds it keeps it, both held and worn. A pin
  now holds both halves.
- **FOUNDER2 (2026-09-24, Mac: "I want to grant all current accounts the founder title if they dont have it
  already").** The same derived grant, asked again at a later moment: `FOUNDER_UNTIL` moves to the end of the day it
  was asked, 2026-09-25T00:00Z, so every account registered since TITLE-R closed it holds Founder too - no row is
  written, as ACC3 designed - and past the new cutoff the title is closed again. Guests still hold none. The account
  service is `acct8`, and it takes effect on that deploy. `test/founder2.test.js`, `tools/mutants/founder2.json`
  (2 dead); TITLE-R's and ACC3's pins read the new date.
- `test/titlen.test.js` has 8 pins. `tools/mutants/titlen.json` has 17 mutants, all dead. The relay is world104.
