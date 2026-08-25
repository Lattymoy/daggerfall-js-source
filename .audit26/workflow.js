export const meta = {
  name: 'audit26-parity-sweep',
  description: 'Full-codebase bug/parity audit of the DFU port: survey + sweeps, then two adversarial refuters per claim',
  phases: [
    { title: 'Survey', detail: '38 chunk surveyors + 5 cross-cutting sweeps' },
    { title: 'Verify', detail: 'two independent refuters per finding, refute by default' },
    { title: 'Critic', detail: 'completeness review over coverage notes' },
  ],
}

const SP = '/tmp/claude-0/-home-user-project-dagger/f208e17c-50cf-5d2e-84cb-04bd749381c9/scratchpad'
const BRIEF = SP + '/audit26/brief.md'
const REPO = '/home/user/project-dagger'
const DFU = '/home/user/interkarma/daggerfall-unity'

const CHUNKS = ['core-misc','voxel-visual','voxel-visual-2','enemy-ai','npc-population','combat',
 'formats-binary','formats-binary-2','formats-defs','player-motor','render','hosts-support',
 'hosts-support-2','hosts-dungeon','hosts-world','hosts-modes','effects-magic','systems-misc',
 'systems-misc-2','audio-music','talk-engine','save-session','region-law-money','entity-career',
 'guilds-factions','enchant-potions','items-loot-trade','quest-core','quest-resources','dev-tools',
 'ui-misc','ui-misc-2','ui-hud-map','ui-frame-settings','ui-native-core','ui-crafting',
 'world-action-misc','world-assembly']

const FINDING_ITEM = {
  type: 'object',
  required: ['jsFile','title','claim','consequence','severity','confidence'],
  additionalProperties: false,
  properties: {
    jsFile: { type: 'string', maxLength: 120 },
    jsLine: { type: 'integer' },
    csFile: { type: 'string', maxLength: 160 },
    csLine: { type: 'string', maxLength: 40 },
    title: { type: 'string', maxLength: 110 },
    claim: { type: 'string', maxLength: 700 },
    consequence: { type: 'string', maxLength: 350 },
    severity: { enum: ['bug','parity','nit'] },
    confidence: { enum: ['high','medium','low'] },
  },
}
const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['group','coverageNotes','findings'],
  additionalProperties: false,
  properties: {
    group: { type: 'string', maxLength: 60 },
    coverageNotes: { type: 'string', maxLength: 1600 },
    findings: { type: 'array', maxItems: 40, items: FINDING_ITEM },
  },
}
const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted','reason','confidence'],
  additionalProperties: false,
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string', maxLength: 600 },
    confidence: { enum: ['high','medium','low'] },
  },
}

function surveyPrompt(name) {
  return `You are surveyor "${name}" in AUDIT 26, a full parity/bug audit of a 1:1 JS port of Daggerfall against Daggerfall Unity.

FIRST read the shared brief at ${BRIEF} - it defines doctrine, departures, the two hunting lenses, method and evidence discipline. It is binding.
THEN read your chunk manifest at ${SP}/audit26/chunks/${name}.json - your files (with line counts and the C# each cites) and your group's lens note.

Port tree: ${REPO} (src/, test/). DFU tree: ${DFU}/Assets/Scripts (commit 81e89e9). Read the port files against the real C# - Grep the DFU tree by member/constant name to land on the right spot, and read the C# NEIGHBORHOOD (sibling arms, callers, the line after the closing brace), not just cited lines.

Report ONLY findings where you personally read both sides this session and can quote file:line on each. No style, no doc issues, no deliberate departures, no speculation. Refuters will kill unsupported claims - a false gap is more expensive than a missed one. If your chunk is clean, an empty findings list with honest coverageNotes is a good result. In coverageNotes name what you did NOT read.

Your final message is consumed by an orchestrator - return only the structured output.`
}

const SWEEPS = [
  { key: 'wiring', prompt: `You are the WIRING sweep of AUDIT 26 (brief: ${BRIEF} - read it first; doctrine and evidence rules bind you).
A scan listed every export in ${REPO}/src with no reference anywhere else in src/: ${SP}/unused.json (1598 candidates - most are benign: test-only fixtures, data tables, editor payloads, intra-file helpers).
Your job: find the REAL "ported but never called" gameplay laws - a DFU member the port translated that nothing in the shipping game invokes ("a ported function with no caller is a comment"). Method: prioritize candidates in modules citing .cs files and names matching DFU members (Grep ${DFU}/Assets/Scripts for the name to see what DFU wires it to); for each candidate that looks like a gameplay law, verify with Grep across src/ (dynamic names, re-exports, host seam objects can hide consumers - check before claiming). Also check the reverse where cheap: DFU call sites whose port-side seam exists but is passed nowhere. Report each verified gap as a finding (severity bug, jsFile = the module owning the orphan, claim = what DFU wires it to and what the port fails to call, consequence = what a player never sees). group = "sweep-wiring".` },
  { key: 'four-hosts', prompt: `You are the FOUR-HOSTS sweep of AUDIT 26 (brief: ${BRIEF} - read it first).
Host files owning a motor/frame: ${REPO}/src/scenes/exterior.js, world.js, worldModes.js (interior+dungeon modal), dungeonContext.js, plus interior.js and standalone dungeon.js. History shows seams get wired into some hosts and forgotten in others (weapon rig, FOV gate, quicksave envelope, magic/poison rounds, senses context, corpse/loot/blood/flash, death screen, footsteps, save slots).
Method: enumerate the seam surface each host builds/passes (deps objects, ctx builders in scenes/shared.js, imports used); diff hosts pairwise; for each seam present in one and absent in another, decide from the DFU side whether the absent host's MODE genuinely needs it (a dungeon-only law missing from exterior is correct). Report only misses DFU says should exist there, with C# evidence. group = "sweep-four-hosts", severity bug.` },
  { key: 'rng', prompt: `You are the RNG-DISCIPLINE sweep of AUDIT 26 (brief: ${BRIEF} - read it first).
DFU's DFRandom is ONE shared global LCG; classic parity depends on draw ORDER and COUNT, not just distribution. The port mirrors it (Grep src/ for dfRandom / umRandom / rand()).
Method: find every port site consuming the shared generator (enemy AI ticks, loot, name gen, town population, quest rolls); for each, compare against the C# call sequence: does the port draw when DFU does not, skip when DFU draws, reorder draws within a tick, or substitute Math.random on a classic path? Also check seed handling and the unsigned 32-bit wraparound semantics vs JS number coercion. Quote both sides. group = "sweep-rng".` },
  { key: 'lifecycle', prompt: `You are the LIFECYCLE sweep of AUDIT 26 (brief: ${BRIEF} - read it first).
DFU leans on Unity Destroy/GC; the port owns every allocation. Method: Grep ${REPO}/src for allocation seams (createBillboardBatch, uploadTexture, createTexture, createBuffer, AudioContext/AudioNode creation, addEventListener on window/document/canvas, setInterval/requestAnimationFrame) and for each: find the matching free/removeEventListener/cancel in the owning module's teardown, and confirm that teardown is REACHABLE from the path that ends the object's life (scene unmount, window close, context switch). Also: async re-entrancy guards that drop instead of coalescing (boolean busy flags around awaits), and frame-gating functions with mixed return types across exits. Report leaks/drops a player session can actually hit, with the reaching path. group = "sweep-lifecycle".` },
  { key: 'saves', prompt: `You are the SAVE-ENVELOPE sweep of AUDIT 26 (brief: ${BRIEF} - read it first).
SaveLoadManager.cs saves and restores EVERYTHING wherever the player stands; envelope gaps have burned this port before (the dungeon quicksave lost quest+talk state). Method: read ${REPO}/src/systems/save.js and every host quickSave/quickLoad/snapshot/restore path (world.js, dungeonContext.js, sceneCache.js, exterior.js); enumerate the state DFU's SaveData_v1 tree carries (Grep ${DFU}/Assets/Scripts/SaveLoadManager.cs and Serializable* classes); for each DFU-side field with a port-side counterpart, verify it round-trips in EVERY host that can save, and that restore ORDER matches (clamps after writes, references re-linked). Report fields that save in one host and not another, restore-order divergence, and state that silently re-derives instead of restoring. group = "sweep-saves".` },
]

function refuteCsPrompt(f) {
  return `You are an adversarial refuter in AUDIT 26. A parity audit of the JS port at ${REPO} claims the following divergence from Daggerfall Unity. ASSUME THE C# READING IS WRONG and try to kill the claim.

CLAIM ${f.id} [${f.severity}/${f.confidence}] ${f.title}
port: ${f.jsFile}${f.jsLine ? ':' + f.jsLine : ''}  C#: ${f.csFile || 'uncited'}${f.csLine ? ':' + f.csLine : ''}
${f.claim}
Claimed consequence: ${f.consequence}

Open the C# YOURSELF at ${DFU}/Assets/Scripts (Grep by member name if the citation is loose) and read the full member plus its callers and sibling arms. Refute if: the C# does not do what the claim says; a caller-side guard, sibling arm, struct default, or enum value makes the claimed difference vanish; the cited code is EnhancedCombatAI/mod-only/dead on the classic path; or the consequence does not follow from the difference. Only leave the claim standing if your own reading of the C# supports it. Default to refuted=true when uncertain. Touch the port side only as far as needed to understand the claim. reason: cite C# file:line for whatever you conclude.`
}
function refuteJsPrompt(f) {
  return `You are an adversarial refuter in AUDIT 26. A parity audit claims the following defect in the JS port at ${REPO}. ASSUME THE PORT ALREADY HANDLES IT and try to kill the claim.

CLAIM ${f.id} [${f.severity}/${f.confidence}] ${f.title}
port: ${f.jsFile}${f.jsLine ? ':' + f.jsLine : ''}  C#: ${f.csFile || 'uncited'}${f.csLine ? ':' + f.csLine : ''}
${f.claim}
Claimed consequence: ${f.consequence}

Read the port YOURSELF. Refute if: the quoted port code is not at the cited spot or does not behave as claimed; the behavior lives elsewhere under another name (Grep src/ widely - host seam objects, adapters, shared.js builders, dynamic dispatch); a later slice already fixed it (check test/ for a pin citing the same C# - a pin plus green suite is strong evidence); or the divergence is a doctrine departure (hand-rolled renderer, voxel characters, FM synth, no mod tree, browser runtime - read ${BRIEF} if unsure). Default to refuted=true when uncertain. Do NOT modify any file. reason: cite port file:line for whatever you conclude.`
}

phase('Survey')
const surveyJobs = [
  ...CHUNKS.map(name => () => agent(surveyPrompt(name), { label: 'survey:' + name, phase: 'Survey', schema: FINDINGS_SCHEMA })),
  ...SWEEPS.map(s => () => agent(s.prompt, { label: 'sweep:' + s.key, phase: 'Survey', schema: FINDINGS_SCHEMA })),
]
const surveys = (await parallel(surveyJobs)).filter(Boolean)
let raw = surveys.flatMap(s => (s.findings || []).map(f => ({ ...f, group: s.group })))
const seen = new Map()
const findings = []
for (const f of raw) {
  const key = (f.jsFile || '') + '|' + (f.csFile || '') + '|' + (f.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 48)
  if (seen.has(key)) continue
  seen.set(key, 1)
  findings.push(f)
}
findings.forEach((f, i) => { f.id = 'F' + String(i + 1).padStart(3, '0') })
log(`survey done: ${surveys.length}/${surveyJobs.length} reports in, ${raw.length} raw claims, ${findings.length} after dedup`)

phase('Verify')
const verified = await parallel(findings.map(f => () =>
  parallel([
    () => agent(refuteCsPrompt(f), { label: 'refuteCs:' + f.id, phase: 'Verify', schema: VERDICT_SCHEMA }),
    () => agent(refuteJsPrompt(f), { label: 'refuteJs:' + f.id, phase: 'Verify', schema: VERDICT_SCHEMA }),
  ]).then(([cs, js]) => ({
    ...f,
    csVerdict: cs, jsVerdict: js,
    noVerdict: !cs || !js,
    confirmed: !!cs && !!js && !cs.refuted && !js.refuted,
  }))
))
const done = verified.filter(Boolean)
const confirmed = done.filter(f => f.confirmed)
const killed = done.filter(f => !f.confirmed && !f.noVerdict)
const pending = done.filter(f => f.noVerdict)
log(`verify done: ${confirmed.length} confirmed, ${killed.length} refuted, ${pending.length} without a full verdict`)

phase('Critic')
const critic = await agent(`You are the completeness critic of AUDIT 26 (a parity audit of ${REPO} vs ${DFU}). Below are the surveyors' coverage notes and the confirmed finding titles. Name what the audit structurally MISSED: chunks whose coverage notes admit unread files (list them concretely), zero-finding groups that look implausible given their size, lenses nobody ran, and DFU subsystems no chunk owned. Be specific and ranked; this becomes the follow-up work list.

COVERAGE NOTES:
${surveys.map(s => `[${s.group}] ${s.coverageNotes}`).join('\n')}

CONFIRMED (${confirmed.length}): ${confirmed.map(f => f.id + ' ' + f.title).join('; ')}`,
  { label: 'critic', phase: 'Critic', schema: {
    type: 'object', required: ['gaps','assessment'], additionalProperties: false,
    properties: {
      gaps: { type: 'array', maxItems: 25, items: { type: 'object', required: ['area','why'], additionalProperties: false,
        properties: { area: { type: 'string', maxLength: 120 }, why: { type: 'string', maxLength: 400 } } } },
      assessment: { type: 'string', maxLength: 1500 },
    } } })

return {
  stats: {
    surveyors: surveyJobs.length, reportsIn: surveys.length, rawClaims: raw.length,
    deduped: findings.length, confirmed: confirmed.length, killed: killed.length, pending: pending.length,
  },
  confirmed: confirmed.map(f => ({ id: f.id, sev: f.severity, group: f.group, js: f.jsFile + (f.jsLine ? ':' + f.jsLine : ''), cs: (f.csFile || '') + (f.csLine ? ':' + f.csLine : ''), title: f.title })),
  killed: killed.map(f => ({ id: f.id, title: f.title, by: (f.csVerdict && f.csVerdict.refuted ? 'C#' : '') + (f.jsVerdict && f.jsVerdict.refuted ? 'JS' : '') })),
  pending: pending.map(f => f.id),
  critic,
}