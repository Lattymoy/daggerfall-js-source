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
