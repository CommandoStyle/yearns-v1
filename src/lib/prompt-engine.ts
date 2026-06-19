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

export type ParticipantMode = 'participant' | 'voyeur'
// participant = user is protagonist, referred to by display_name
// voyeur      = third-person camera, user is not in the story

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

export type SupportedLanguage = 'en' | 'fr' | 'it' | 'ja'

export interface GenerationRequest {
  profile: DesireProfile
  explicitness: ExplicitnessLevel        // live dial value — overrides profile default
  setting: SettingType
  length_mins: number                    // 1–30
  participant_mode?: ParticipantMode     // overrides profile if set
  continuation_id?: string              // if continuing a saved Yearn
  continuation_context?: string         // last 200 words of previous Yearn
  prompt_version: string                // semver, loaded from Supabase
  language?: SupportedLanguage
  // ── Per-story overrides (all optional — fall back to profile if absent) ──
  spark?: string                        // inciting moment phrase
  character_override?: {
    name?: string
    traits?: string[]                   // max 2 from curated list
  }
  pace?: 1 | 2 | 3                      // 1=lingering 2=building 3=inevitable
  specific_detail?: string              // max 60 chars — free text setting detail
  tonights_want?: string               // max 120 chars — overrides three_words emphasis
  participant_mode_override?: ParticipantMode  // per-story override, doesn't touch profile
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
  1: `Write with pure suggestion. Desire is palpable but never stated. Bodies are 
      implied through sensation — warmth, proximity, breath, gaze. Nothing is named 
      explicitly. The reader should feel more than they are told. Think: a hand 
      resting on a wrist and all that means.`,

  2: `Write with sensual clarity. Desire is explicit in feeling if not in act. 
      You may describe arousal, skin, mouths, the body wanting. Sexual acts are 
      approached and felt but described obliquely — the approach, not the mechanics. 
      The erotic charge is high; the explicit detail is low.`,

  3: `Write with full erotic clarity. Sexual acts may be described directly and 
      without euphemism. Physicality, sensation, and desire are all available to you. 
      Write with craft — the goal is arousal through quality prose, not through 
      clinical description. The reader's desire matters more than explicitness for 
      its own sake.`,

  4: `Write without restriction within the absolute limits defined below. All 
      consensual sexual content is permitted. Write with the full vocabulary of 
      erotic literature. Quality and emotional truth remain the standard — 
      this is not a licence for crudeness, it is a licence for freedom.`,
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

import { LLAMA_SUPPLEMENT } from '@/lib/llama-supplement'

// ─── Core assembler ───────────────────────────────────────────────────────────

export function buildPrompt(req: GenerationRequest): BuiltPrompt {
  const {
    profile,
    explicitness,
    setting,
    length_mins,
    continuation_id,
    continuation_context,
    prompt_version,
    spark,
    character_override,
    pace,
    specific_detail,
    tonights_want,
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

  // 5. Llama supplement — explicit tiers only
  // Compensates for known Llama failure modes (emotional flatness, perspective
  // drift, cliché vocab, rushed pacing). Stacks after craft standard so it
  // is freshest in context at generation time.
  if (explicitness >= 3) {
    systemParts.push(LLAMA_SUPPLEMENT)
  }

  // 6. Language
  if (lang !== 'en') {
    const langNames: Record<SupportedLanguage, string> = {
      en: 'English', fr: 'French', it: 'Italian', ja: 'Japanese',
    }
    systemParts.push(`
LANGUAGE: Write entirely in ${langNames[lang]}. Do not mix languages.
The erotic register, idiom, and cultural tone should be authentic to 
${langNames[lang]}-language literary erotica — not a translation of 
English conventions.
    `.trim())
  }

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

  // D. Protagonist configuration
  // display_name is set during onboarding. Fall back to 'her' for edge cases
  // (e.g. voyeur mode, or a generation triggered before onboarding completes).
  const name = profile.display_name?.trim() || 'her'
  if (mode === 'participant') {
    narrativeParts.push(`
PROTAGONIST: The reader is the protagonist. Her name is ${name}. 
Write in close third-person or second-person — she should feel that 
this is happening to her, that ${name} is unmistakably her. 
Her interior experience is primary.
    `.trim())
  } else {
    narrativeParts.push(`
PROTAGONIST: Write in close third-person. The protagonist is a distinct 
character — not the reader, but someone the reader can inhabit. 
Give her interiority, specificity, and desire of her own.
    `.trim())
  }

  // E. Who she desires (character_override replaces desire_targets for this story)
  if (character_override && (character_override.name || character_override.traits?.length)) {
    const parts: string[] = []
    if (character_override.name) parts.push(`His name is ${character_override.name}.`)
    if (character_override.traits?.length) {
      parts.push(`He is defined by: ${character_override.traits.join('; ')}.`)
    }
    parts.push('Build a specific person from these qualities — don\'t just note them.')
    narrativeParts.push(`THE OTHER (for this story): ${parts.join(' ')}`.trim())
  } else if (profile.desire_targets) {
    narrativeParts.push(`
THE OTHER: ${profile.desire_targets}
Let this description guide the character — but add texture.
A type is a starting point, not a character.
    `.trim())
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
  if (continuation_id && continuation_context) {
    narrativeParts.push(`
CONTINUATION: This story continues from a previous Yearn. 
The final passage was:

"${continuation_context}"

Continue from exactly this point. Maintain character, tone, and momentum.
Do not recap what came before.
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
