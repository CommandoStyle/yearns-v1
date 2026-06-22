/**
 * Yearns — Model router (post ADR-002)
 *
 * Qwen is the single primary generation engine across all explicitness
 * tiers 1-4. This resolves the architectural constraint where Claude's
 * involvement in tiers 1-2 broke continuity for the live explicitness
 * dial, continue/extend, and planned branching narrative features — any
 * feature requiring a story to cross a model boundary mid-generation was
 * incompatible with Claude's usage policy (see ADR-002 for full reasoning,
 * including the policy boundary on offline Claude use).
 *
 * Llama is kept as an inactive fallback adapter — not currently routed to,
 * but preserved so a future challenger model can be tested cheaply via the
 * same adapter pattern without re-architecting this file.
 *
 * Claude is removed from this file entirely. Claude API access is preserved
 * in the project (env vars, SDK dependency) for the offline gold-corpus
 * authorship workflow — a manual, non-runtime process outside this file.
 *
 * Swapping models: change the QWEN model string constant below.
 * Testing a challenger: add a case to streamFromModel(), implement or reuse
 * the streamTogether adapter. The rest of the codebase is untouched.
 */

import type { BuiltPrompt, ExplicitnessLevel } from '@/lib/prompt-engine'

// ─── Model config ─────────────────────────────────────────────────────────────

const MODELS = {
  // Qwen3-235B via Together.ai — primary engine, all tiers 1-4.
  // 235B total / 22B active parameters (MoE), throughput-optimised variant.
  // Served via Together.ai serverless endpoint (pay-per-token, no dedicated
  // endpoint required). Confirmed working at all four tiers in blind
  // quality evaluation — see ADR-002.
  QWEN: 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput',

  // Llama 3.3 70B via Together.ai — inactive fallback only.
  // Not currently routed to. Kept so the adapter pattern is available for
  // future challenger model testing without re-architecting this file.
  // Deprioritised per ADR-002: weakest in blind quality comparison, known
  // failure modes (vocabulary blacklist violations, repetition, generic
  // phrasing) that the craft supplement had not yet fully resolved.
  LLAMA_70B: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
} as const

type ModelKey = keyof typeof MODELS

// ─── Routing decision ─────────────────────────────────────────────────────────

export function selectModel(_explicitness: ExplicitnessLevel): ModelKey {
  // All tiers route to Qwen post ADR-002.
  // The explicitness parameter is retained in the signature (not removed) so:
  // 1. Call sites in the generate route don't need to change.
  // 2. A future tier-based split has a clear insertion point without
  //    restructuring callers.
  return 'QWEN'
}

// ─── Unified stream interface ─────────────────────────────────────────────────

export async function* streamFromModel(
  prompt: BuiltPrompt,
  model: ModelKey,
): AsyncGenerator<string, void, unknown> {
  switch (model) {
    case 'QWEN':
      yield* streamTogether(prompt, MODELS.QWEN)
      break
    case 'LLAMA_70B':
      // Inactive fallback path — not reached in normal operation.
      // Manually activate by changing selectModel() to return 'LLAMA_70B'
      // for the tiers you want to test.
      yield* streamTogether(prompt, MODELS.LLAMA_70B)
      break
  }
}

// ─── Together.ai adapter ──────────────────────────────────────────────────────
// Both Qwen and Llama are served via Together.ai's OpenAI-compatible
// chat completions API. This single adapter handles both — model selection
// is the only difference between them.
//
// System prompt mapping: Together.ai uses the standard chat completions
// format [{role:"system",...},{role:"user",...}] which maps directly from
// BuiltPrompt.system and BuiltPrompt.user.
//
// Temperature: Together.ai accepts 0.0-1.0. Prompt engine produces 0.92 —
// within range, no adjustment needed.

interface TogetherChunk {
  choices: Array<{
    delta: {
      content?: string
    }
    finish_reason: string | null
  }>
}

async function* streamTogether(
  prompt: BuiltPrompt,
  model: string,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TOGETHER_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: prompt.max_tokens,
      temperature: prompt.temperature,
      stream: true,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user',   content: prompt.user   },
      ],
      // Repetition penalty helps with erotic fiction which tends toward
      // repetitive phrasing without it.
      repetition_penalty: 1.08,
      // Slightly tighter top_p for more coherent prose.
      top_p: 0.92,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Together.ai error ${response.status}: ${error}`)
  }

  if (!response.body) {
    throw new Error('Together.ai returned no response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return

        let parsed: TogetherChunk
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }

        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ─── Quality notes for trainers ───────────────────────────────────────────────
// Qwen3-235B vs Claude — known differences observed in blind evaluation:
//
// QWEN TENDENCIES (monitor in trainer reviews):
//   - Occasional "reach for effect" phrasing — ambitious but not always landing
//   - Some unearned abstraction at emotionally heightened moments
//   - Generally good interiority and specificity; fewer flat-affect issues
//     than Llama showed
//   - Permissive across all explicitness tiers with no content hesitation
//
// The CRAFT_SUPPLEMENT (craft-correction-supplement.ts) is applied to all
// tiers to close the quality gap with Claude's tier 1-2 baseline.
// Trainer review of which supplement instructions Qwen already handles
// natively (candidates for trimming) vs new failure modes to add is
// pending — see craft-correction-supplement.ts comment.
