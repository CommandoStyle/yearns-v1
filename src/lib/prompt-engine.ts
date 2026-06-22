/**
 * Yearns Prompt Engine — v1.0
 * The core IP of the product. Assembles a layered Claude system prompt
 * from a user's desire profile + live request params.
 *
 * Architecture decisions:
 * - Layered construction: hard limits first, always. Non-negotiable constraints
 *   are established before any creative direction is set.
 * - Separation of system prompt (who Claude is, what it never does) from
 *   narrative prompt (what this specific story is).
 * - All profile fields are optional at the type level — the engine degrades
 *   gracefully if a profile is incomplete (e.g. first-session user).
 * - Prompt versions are stored externally (Supabase) and injected at runtime.
 *   This file contains the assembly logic, not the prompt text itself.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExplicitnessLevel = 1 | 2 | 3 | 4
// 1 = suggestive (a glance, a touch, nothing more)
// 2 = sensual    (desire made clear, bodies acknowledged, nothing explicit)
// 3 = explicit   (sex described with clarity, nothing held back)
// 4 = unrestricted (full range, user has confirmed this preference)

export type ParticipantMode = 'participant' | 'voyeur' | 'alone'
// participant = user is protagonist, referred to by display_name
// voyeur      = third-person camera, user is not in the story
// alone       = no second character; scene is purely internal/sensory

export type Genre =
  | 'contemporary'
  | 'historical'
  | 'fantasy'
  | 'scifi'
  | 'romantic'
  | 'dark'
  | 'surprise'

export type EmotionalRegister =
  | 'desired'
  | 'powerful'
  | 'surrendered'
  | 'adored'
  | 'forbidden'
  | 'dangerous'
  | 'seen'
  | 'surprised'

export interface DesireProfile {
  // From onboarding
  display_name?: string
  genre_weights?: Partial<Record<Genre, number>>    // 0.0–1.0 per genre
  emotional_register?: EmotionalRegister[]           // ordered by preference
  desire_targets?: string                            // free text: "a man, powerful, older"
  explicitness_default?: ExplicitnessLevel

  // From progressive unlock sessions
  participant_mode?: ParticipantMode
  hard_limits?: string[]                             // absolute exclusions, honoured always
  three_words?: [string, string, string]             // e.g. ["slow", "powerful", "inevitable"]
  style_references?: string[]                        // e.g. ["Atonement library scene", "Rebecca"]
  setting_preference?: Partial<Record<SettingType, number>>
  language?: SupportedLanguage
}

export type SettingType =
  | 'bedroom'
  | 'hotel'
  | 'travelling'
  | 'outdoors'
  | 'urban'
  | 'workplace'
  | 'unknown'

export type SupportedLanguage = 'en' | 'fr' | 'it' | 'ja' | 'es' | 'de'

export interface CharacterConfig {
  id: string                                        // client-generated, for UI list management
  name?: string                                     // optional free text
  gender?: 'man' | 'woman' | 'unspecified'          // unspecified = let model decide
  traits?: string[]                                 // max 2 from curated list
  role?: string                                     // curated pick or free text, optional
}

export interface AloneContext {
  focus: 'solitude' | 'object' | 'watching_or_reading' | 'memory'
  // solitude            = nothing but herself; pure internal/sensory experience
  // object              = a toy or object is present and part of the scene
  // watching_or_reading = consuming adult content/media as part of the scene
  // memory              = scene is built around recalling a past experience
  discovery_risk?: boolean
  // false/undefined = completely private
  // true            = somewhere she could plausibly be discovered — changes pacing and tension
}

export type PerceptualChannel = 'full_sight' | 'sound_only' | 'fragments' | 'peripheral'

export interface VoyeurContext {
  watcher_position: string                          // curated phrase or free text
  perceptual_channel: PerceptualChannel
  relationship_to_watched: string                   // curated phrase or free text
  interior_state: string[]                          // max 2 from curated list
}

export interface GenerationRequest {
  profile: DesireProfile
  explicitness: ExplicitnessLevel        // live dial value — overrides profile default
  setting: SettingType
  length_mins: number                    // 1–30
  participant_mode?: ParticipantMode     // overrides profile if set
  continuation_id?: string              // if continuing a saved Yearn
  continuation_context?: string         // last 200 words of previous Yearn
  previous_explicitness?: ExplicitnessLevel  // set on mid-read dial change to smooth transition
  prompt_version: string                // semver, loaded from Supabase
  language?: SupportedLanguage
  // ── Per-story overrides (all optional — fall back to profile if absent) ──
  spark?: string                        // inciting moment phrase
  characters?: CharacterConfig[]        // 1–4 entries; replaces character_override
  pace?: 1 | 2 | 3                      // 1=lingering 2=building 3=inevitable
  specific_detail?: string              // max 60 chars — free text setting detail
  tonights_want?: string               // max 120 chars — overrides three_words emphasis
  participant_mode_override?: ParticipantMode  // per-story override, doesn't touch profile
  voyeur_context?: VoyeurContext        // present only when mode is voyeur
  alone_context?: AloneContext          // present only when mode is alone
}

export interface BuiltPrompt {
  system: string
  user: string
  max_tokens: number
  temperature: number
  prompt_version: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORDS_PER_MINUTE = 250
const TOKENS_PER_WORD = 1.4  // Claude tokenisation average for literary prose

// Explicitness descriptors — used in system prompt to calibrate Claude's output.
// These are NOT shown to the user. They define the ceiling for each level.
const EXPLICITNESS_GUIDANCE: Record<ExplicitnessLevel, string> = {
  1: `Write with pure suggestion. Desire is felt, never stated. Nothing below the
      neck is named or described — not body parts, not touch, not physical sensation
      below the shoulders. The erotic charge lives entirely in atmosphere: a look held
      a beat too long, proximity, the quality of silence, what is not said. The reader
      should ache without being able to say exactly why. Think literary fiction,
      not erotica.`,

  2: `Write with sensual clarity. Desire is explicit in feeling, not in act. You may
      describe mouths, skin, breath, the body's awareness of another body. Arousal may
      be named but not anatomically located. No sex acts — not described, not
      approached, not implied as imminent. The story ends at the threshold, or in the
      wanting. The charge is high; what happens stays behind a closed door.`,

  3: `Write with full erotic clarity. Sexual acts are described directly, without
      euphemism or fade-to-black. Bodies, sensation, and physical detail are all in
      play. Be specific — vague gestures at what is happening are not enough. Write
      with craft: the goal is arousal through honest, specific prose. Not clinical,
      not crude for its own sake, but clear and physical and present.`,

  4: `Write without restriction within the absolute limits defined below. All
      consensual sexual content is permitted — explicit, detailed, physical, prolonged.
      Use the full vocabulary available to you: anatomically direct language is
      permitted and often correct. Do not pull back, soften, or summarise what is
      happening. Stay in the scene. Linger. The reader wants more than they expected —
      give it to them. Quality still matters; crudeness in service of arousal is
      not a failure.`,
}

const GENRE_WORLD: Record<Genre, string> = {
  contemporary: 'The present day, recognisable and real. Ordinary life with extraordinary charge.',
  historical: 'A specific past era — its manners, its tensions, its repressions and freedoms.',
  fantasy: 'A world with magic, myth, or creatures. Rules exist, but they are not ours.',
  scifi: 'The future, or a technological present. Distance, isolation, and intimacy in new forms.',
  romantic: 'A world governed by emotional logic. Connection is the engine. Feeling is everything.',
  dark: 'Moral ambiguity, power imbalance, transgression, shadow. Not without consent — but not comfortable either.',
  surprise: 'You choose the world. Surprise the reader.',
}

const EMOTIONAL_REGISTER_GUIDANCE: Record<EmotionalRegister, string> = {
  desired: 'The protagonist should feel unmistakably wanted — chosen, seen, pursued with intention.',
  powerful: 'The protagonist is in command. Others respond to her. She sets the terms.',
  surrendered: 'The protagonist gives herself over — safely, willingly, completely. The surrender is its own power.',
  adored: 'The protagonist is worshipped. Not just desired — treasured, handled with reverence.',
  forbidden: 'There is a rule being broken, a line being crossed. The transgression is part of the charge.',
  dangerous: 'Something is at stake. The other person is unpredictable, or the situation is. Edge.',
  seen: 'The protagonist is known completely — her interior life, her contradictions, her hidden self.',
  surprised: 'Something unexpected happens. The story should go somewhere the reader did not anticipate.',
}

const SETTING_ATMOSPHERE: Record<SettingType, string> = {
  bedroom: 'A private space the protagonist knows intimately. Familiar textures, low light, the permission of home.',
  hotel: 'Somewhere anonymous and temporary. Clean sheets that belong to no one. The freedom of displacement.',
  travelling: 'In transit — airport, train, plane. Suspended between places, slightly unreal.',
  outdoors: 'Nature, space, exposure. The body and the world in contact.',
  urban: 'A city — bars, restaurants, streets, rooftops. Other people nearby, the private carved from the public.',
  workplace: 'Familiar professional territory, rules that exist to be broken. The charge of the inappropriate.',
  unknown: 'An unspecified setting. Choose what best serves the story.',
}

// ─── Absolute hard limits — system-level, never overridden ───────────────────
// These appear in EVERY system prompt regardless of profile or explicitness level.

const ABSOLUTE_LIMITS = `
ABSOLUTE LIMITS — these override every other instruction in this prompt:

1. All characters are explicitly adults. No character's age is ambiguous. 
   If a character's age is unspecified, write them as clearly adult (25+).
   Never write characters who are, or could be interpreted as, under 18.

2. All sexual activity is consensual. Non-consent may appear as a fantasy 
   framing (explicitly signalled as such) but must never be presented 
   approvingly or as desirable in itself.

3. Do not include real named public figures in sexual or romantic scenarios.

4. Do not reproduce copyrighted text or song lyrics.

5. The story must be fiction. Do not create the impression that events 
   described are real or that real people are involved.
`.trim()

import { CRAFT_SUPPLEMENT } from '@/lib/craft-correction-supplement'
import { getLanguageRegister } from '@/lib/language-registers'

// ─── Core assembler ───────────────────────────────────────────────────────────

const PERCEPTUAL_CHANNEL_GUIDANCE: Record<PerceptualChannel, string> = {
  full_sight: 'You can see everything clearly from your position. Describe visually with full clarity.',
  sound_only: 'You cannot see what is happening. Everything must be conveyed through sound — voices, breathing, movement, the creak of furniture, the things sound implies but does not confirm. Do not describe visual details you could not perceive from this position. The imagination fills in what the ears suggest.',
  fragments:  'Your view is partial — glimpses through a gap, a reflection, an interrupted line of sight. You piece together what is happening from fragments. The prose should feel assembled, incomplete in a way that heightens desire.',
  peripheral: 'You are aware of them without directly watching — they are at the edge of your attention, your perception catching details without you intending to look. The prose should have the quality of something half-noticed and impossible to ignore.',
}

export function buildPrompt(req: GenerationRequest): BuiltPrompt {
  const {
    profile,
    explicitness,
    setting,
    length_mins,
    continuation_id,
    continuation_context,
    previous_explicitness,
    prompt_version,
    spark,
    characters,
    pace,
    specific_detail,
    tonights_want,
    voyeur_context,
    alone_context,
  } = req

  const lang = req.language ?? profile.language ?? 'en'
  // participant_mode_override (per-story) > participant_mode (request) > profile
  const mode = req.participant_mode_override ?? req.participant_mode ?? profile.participant_mode ?? 'participant'
  const targetWords = Math.round(length_mins * WORDS_PER_MINUTE)
  const maxTokens = Math.round(targetWords * TOKENS_PER_WORD * 1.15) // 15% buffer

  // ── System prompt ────────────────────────────────────────────────────────
  // Order matters. Hard limits → identity → craft standard → user's limits →
  // content guidance → format guidance.

  const systemParts: string[] = []

  // 1. Identity and absolute limits (always first)
  systemParts.push(`
You are Yearns — an AI erotic fiction author writing personalised, 
literary-quality erotic stories for adult women. Your writing is tasteful, 
stylish, and emotionally intelligent. You write like a novelist, not a chatbot.

${ABSOLUTE_LIMITS}
  `.trim())

  // 2. User's personal hard limits (if set)
  if (profile.hard_limits && profile.hard_limits.length > 0) {
    systemParts.push(`
USER'S PERSONAL LIMITS — this reader has specified these exclusions. 
Honour them absolutely:
${profile.hard_limits.map(l => `— ${l}`).join('\n')}
    `.trim())
  }

  // 3. Explicitness calibration
  systemParts.push(`
EXPLICITNESS LEVEL: ${explicitness}/4
${EXPLICITNESS_GUIDANCE[explicitness]}
  `.trim())

  // 4. Craft standard (pace-aware)
  const pacingGuidance = pace === 1
    ? `Pacing: move slowly. Let each moment breathe. Delay the inevitable —
       the reader should ache for what's coming long before it arrives.
       Linger on sensation, interiority, the space between touches.`
    : pace === 3
    ? `Pacing: move with compressed urgency. Tension arrives fast and builds
       faster. The release should feel earned but close — don't make the reader
       wait. Every paragraph should push toward the inevitable.`
    : `Pacing: build tension before release. The most charged moments are often
       the ones just before something happens.`

  systemParts.push(`
CRAFT STANDARD:
Write prose that earns its explicitness. Use specific, sensory language.
Avoid: purple prose, stock phrases ("throbbing", "heaving", "moist"),
anatomical clinical language, cliché scenarios without specific texture.

Favour: unusual detail, psychological interiority, the specificity of
a particular moment — the grain of a table, the angle of light, a pause
before a sentence is finished. The best erotic writing makes the reader
feel desire, not just read about it.

${pacingGuidance}
  `.trim())

  // 5. Craft correction supplement — ALL tiers (post ADR-002 behavioural change)
  // Previously injected only at tiers 3-4 when Claude handled 1-2. Now Qwen
  // generates all tiers, so the supplement applies universally. Content is
  // general craft principles that transfer across models; a trainer-driven
  // review to calibrate specifically for Qwen's tendencies is pending.
  systemParts.push(CRAFT_SUPPLEMENT)

  // 6. Language — curated register guidance (sits after craft standard + LLAMA_SUPPLEMENT
  //    so it is the final calibration layer, freshest in the model's context)
  if (lang !== 'en') {
    const register = getLanguageRegister(lang)
    if (register) {
      systemParts.push(register)
    }
    // If register is empty (shouldn't happen with a full Record, but defensive):
    // fall through silently — the model will still produce the correct language
    // from profile or request context.
  }

  // Output format — always last so it is freshest in context
  systemParts.push(
    'OUTPUT FORMAT: Plain prose only. Separate every paragraph with a single blank line (two newlines). No headings, no chapter numbers, no asterisk dividers, no markdown.'
  )

  const system = systemParts.join('\n\n')

  // ── User turn (narrative prompt) ─────────────────────────────────────────
  // This is the specific story request, assembled from profile + request.

  const narrativeParts: string[] = []

  // A. Genre and world
  const topGenre = getTopGenre(profile.genre_weights)
  if (topGenre) {
    narrativeParts.push(`
WORLD: ${GENRE_WORLD[topGenre]}
    `.trim())
  }

  // A1. Opening moment (spark) — anchors the inciting scene
  if (spark && spark !== 'surprise_me') {
    narrativeParts.push(`
OPENING MOMENT: Begin the story from this specific inciting moment: "${spark}"
Do not announce it — open in the middle of it, already happening.
    `.trim())
  }

  // B. Emotional register — the most important signal
  if (profile.emotional_register && profile.emotional_register.length > 0) {
    const primaryFeel = profile.emotional_register[0]
    const secondaryFeel = profile.emotional_register[1]
    narrativeParts.push(`
HOW SHE SHOULD FEEL:
Primary: ${EMOTIONAL_REGISTER_GUIDANCE[primaryFeel]}
${secondaryFeel ? `Secondary: ${EMOTIONAL_REGISTER_GUIDANCE[secondaryFeel]}` : ''}
    `.trim())
  }

  // C. Setting / atmosphere (augmented with specific_detail if provided)
  narrativeParts.push(`
SETTING: ${SETTING_ATMOSPHERE[setting]}${specific_detail ? `\nSpecific detail to weave in naturally: "${specific_detail}" — incorporate this as lived texture, not a fact inserted out of context.` : ''}
  `.trim())

  // D. Protagonist / watcher / alone framing
  const displayName = profile.display_name?.trim() || 'her'

  if (mode === 'alone') {
    const focus = alone_context?.focus ?? 'solitude'
    const discoveryRisk = alone_context?.discovery_risk ?? false

    const focusLine =
      focus === 'solitude'
        ? 'Nothing else is needed. The experience is complete in itself — internal, sensory, hers alone.'
        : focus === 'object'
        ? 'An object or toy is present and part of the physical experience. Describe its role with the same specificity you would give a character — texture, weight, the particular way it is used.'
        : focus === 'watching_or_reading'
        ? 'She is engaging with adult content or media as part of this moment — describe her reactions and experience, not the content itself in detail. The focus stays on her, not on what she is consuming.'
        : 'This scene is built from a memory she keeps returning to. Blend present sensation with recollection — let the remembered experience and the current moment intertwine.'

    const discoveryLine = discoveryRisk
      ? 'There is a real possibility of being discovered. This risk is part of the tension and should be felt throughout — heightened awareness, urgency, the specific thrill of "what if someone…" Do not actually have her get caught unless the user has indicated otherwise; the thrill of potential discovery is the point, not an actual interruption.'
      : 'This is completely private. No risk of discovery — the focus is entirely internal and uninterrupted.'

    narrativeParts.push(`
ALONE:

This is a story about solitude, not absence. The reader is the entire scene — there is no one else, and the story should not gesture toward an implied missing partner. Write with full attention to physical sensation, internal narrative, and the specific texture of this private moment.

${focusLine}

${discoveryLine}
    `.trim())
  } else if (mode === 'participant') {
    narrativeParts.push(`
PROTAGONIST: The reader is the protagonist. Her name is ${displayName}.
Write in close third-person or second-person — she should feel that
this is happening to her, that ${displayName} is unmistakably her.
Her interior experience is primary.
    `.trim())
  } else {
    // Voyeur mode: the reader is a watcher, not a character in the scene
    if (voyeur_context) {
      const channelGuidance = PERCEPTUAL_CHANNEL_GUIDANCE[voyeur_context.perceptual_channel]
      narrativeParts.push(`
THE WATCHER (this is the reader's position — they are NOT a character in the story):

Position: ${voyeur_context.watcher_position}.

What the watcher can perceive: ${channelGuidance}

Their relationship to the people being watched: ${voyeur_context.relationship_to_watched}.

How watching makes them feel: ${voyeur_context.interior_state.join(' and ')}.
This feeling should colour every observation — the reader should feel this as THEIR experience of watching, not a neutral camera.

CRITICAL: Never give the watcher a name, a body the watched characters can perceive, or dialogue. The watcher exists only as a perspective and a feeling. The watched characters do not know they are being observed and must never address or acknowledge the watcher.
      `.trim())
    } else {
      narrativeParts.push(`
THE WATCHER: The reader observes this scene from nearby, unnoticed. They are not a character — they have no name, no body the others can perceive. They watch with an illicit thrill and cannot look away. The watched characters do not know they are being observed.
      `.trim())
    }
  }

  // E. Character roster — who is with the protagonist (participant) or being watched (voyeur)
  // Alone mode has no roster — skip entirely.
  const hasRoster = mode !== 'alone' && characters && characters.length > 0
  const rosterLabel = mode === 'participant' ? 'WHO IS WITH YOU' : 'WHO YOU ARE WATCHING'

  if (hasRoster) {
    const characterLines = characters!.map((c, i) => {
      const namePart = c.name
        ? `${c.name}`
        : `(choose an appropriate name — vary across genders, origins, and languages; do not default to a narrow set)`
      const genderPart = c.gender === 'unspecified' || !c.gender
        ? 'Gender: your choice — make it specific and committed'
        : `Gender: ${c.gender}`
      const rolePart = c.role
        ? `Role: ${c.role} — let this relationship/context inform the scene's setup, tension, and dialogue naturally. Don't over-explain the role in the narration; let it shape behaviour and dynamic instead.`
        : ''
      const traitPart = c.traits?.length
        ? `Defining traits: ${c.traits.join('; ')}`
        : ''
      return [
        `Character ${i + 1}: ${namePart}`,
        `  ${genderPart}`,
        rolePart  ? `  ${rolePart}`  : '',
        traitPart ? `  ${traitPart}` : '',
      ].filter(Boolean).join('\n')
    }).join('\n\n')

    narrativeParts.push(`
${rosterLabel}:

${characterLines}

These are specific people, not types. Give each one at least one unexpected, particular detail beyond what is listed above.
    `.trim())
  } else if (mode !== 'alone' && profile.desire_targets) {
    // Fall back to profile-level desire_targets when no per-story roster
    narrativeParts.push(`
THE OTHER: ${profile.desire_targets}
Let this description guide the character — but add texture. A type is a starting point, not a character.

NAMING: Vary character names across genders, origins, and languages. Do not default to a narrow set of names. Use names appropriate to the story's setting and the character's implied background.
    `.trim())
  } else if (mode !== 'alone') {
    // No roster, no profile targets — give naming guidance anyway
    narrativeParts.push(
      'NAMING: Vary character names across genders, origins, and languages. Do not default to a narrow set of names (avoid reusing the same small pool across stories).'
    )
  }

  // E1. Tonight's want — highest-priority tone signal when present
  if (tonights_want) {
    narrativeParts.push(`
TONIGHT'S WANT (primary emphasis — this shapes the story above all other preferences):
"${tonights_want}"
This specific want should govern the story's tone and content more than any standing preference below.
    `.trim())
  }

  // F. Three words — used verbatim, the most concentrated signal
  if (profile.three_words) {
    narrativeParts.push(`
THE FEELING IN THREE WORDS: ${profile.three_words.join(' · ')}
${tonights_want ? 'Let these words colour the background — the want above takes precedence.' : 'Let these words govern the story\'s rhythm, temperature, and movement.'}
    `.trim())
  }

  // G. Style references
  if (profile.style_references && profile.style_references.length > 0) {
    narrativeParts.push(`
STYLE REFERENCE: The reader responded to: ${profile.style_references.join(', ')}.
Draw on the register, emotional temperature, and prose quality of these 
references — not their plots or characters.
    `.trim())
  }

  // H. Continuation context
  // Used for both saved-Yearn continuation and mid-read explicitness dial changes.
  // previous_explicitness is only set on mid-read dial changes — triggers the
  // transition instruction so the shift reads as natural escalation/easing.
  if (continuation_context) {
    const isLevelShift = previous_explicitness !== undefined && previous_explicitness !== explicitness
    const shiftDirection = isLevelShift
      ? (explicitness > previous_explicitness! ? 'escalating' : 'de-escalating')
      : null

    const transitionInstruction = isLevelShift ? `

TRANSITION: This continuation shifts in intensity from what came before — moving from level ${previous_explicitness} to level ${explicitness} on a scale of 1–4.
Do not snap to the new register instantly. Let the next few sentences carry the transition naturally — as if the scene itself is ${shiftDirection === 'escalating' ? 'building and intensifying' : 'easing and settling'}, not as if a switch was flipped. The reader should feel a shift in temperature, not a jump cut.` : ''

    narrativeParts.push(`
CONTINUATION: This story continues directly from where it left off.
The final passage was:

"${continuation_context}"

Continue from exactly this point. Maintain character, tone, and momentum.
Do not recap what came before.${transitionInstruction}
    `.trim())
  }

  // I. Format and length instruction (always last in narrative)
  narrativeParts.push(`
LENGTH: Write approximately ${targetWords} words (~${length_mins} minute read).
Start in the story immediately — no preamble, no scene-setting paragraph 
that announces what is about to happen. Begin in the middle of something.
The ending should feel complete but not closed — leave a breath of wanting.
  `.trim())

  const user = narrativeParts.join('\n\n')

  return {
    system,
    user,
    max_tokens: Math.min(maxTokens, 4096),  // hard cap at 4K for V1
    temperature: 0.92,    // high creative variance, still coherent
    prompt_version,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTopGenre(
  weights?: Partial<Record<Genre, number>>
): Genre | undefined {
  if (!weights) return undefined
  const entries = Object.entries(weights) as [Genre, number][]
  if (entries.length === 0) return undefined
  return entries.sort(([, a], [, b]) => b - a)[0][0]
}

// ─── Example: assembled system prompt (for reference / testing) ───────────────

/*
  For a user with:
    display_name: "Isabelle"
    genre_weights: { contemporary: 0.8 }
    emotional_register: ["desired", "surrendered"]
    hard_limits: ["violence", "group scenarios"]
    three_words: ["slow", "inevitable", "private"]
    style_references: ["Atonement library scene"]
    explicitness: 3
    setting: "hotel"
    participant_mode: "participant"
    length_mins: 7

  The system prompt opens with identity + absolute limits,
  then adds Isabelle's hard limits (violence, group scenarios),
  then sets explicitness 3 guidance,
  then craft standard.

  The user turn specifies:
  - Contemporary world
  - Feel: desired (primary), surrendered (secondary)
  - Hotel setting atmosphere
  - Participant mode: "her name is Isabelle"
  - Three words verbatim: slow · inevitable · private
  - Style: Atonement library scene register
  - ~1750 words, begin in the middle

  That's the complete context Claude receives. Everything else
  it generates from training — the specific characters, the
  scene, the prose quality. The prompt engine sets the stage;
  Claude writes the story.
*/
