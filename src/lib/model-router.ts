/**
 * Yearns — Model router
 * Routes generation requests to the appropriate model based on explicitness level.
 *
 * Routing logic:
 *   Level 1 (suggestive)  → Claude claude-sonnet-4  — literary craft, emotional intelligence
 *   Level 2 (sensual)     → Claude claude-sonnet-4  — same; Claude handles this tier well
 *   Level 3 (explicit)    → Together.ai / Llama 3.1 70B  — no content restrictions
 *   Level 4 (unrestricted)→ Together.ai / Mixtral 8x22B  — maximum capability
 *
 * Both paths:
 *   - Accept identical BuiltPrompt input from the prompt engine
 *   - Return an identical AsyncIterator<string> of text tokens
 *   - Apply identical SSE streaming to the client
 *   - Are subject to the same output content filter post-generation
 *
 * The client never knows which model generated its story.
 * The prompt engine never knows which model will receive its output.
 * The router is the only place model selection logic lives.
 *
 * Swapping models: change the model string constants below.
 * Adding a model: add a case to streamFromModel(), implement the adapter.
 * The rest of the codebase is untouched.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { BuiltPrompt, ExplicitnessLevel } from '@/lib/prompt-engine'

// ─── Model config ─────────────────────────────────────────────────────────────

const MODELS = {
  // Claude handles the literary intelligence layer (tiers 1–2).
  // Best-in-class for: emotional interiority, prose quality,
  // character voice, sensory specificity, narrative pacing.
  CLAUDE: 'claude-sonnet-4-6',

  // Llama 3.3 70B via Together.ai — explicit tier (level 3).
  // Serverless (pay-per-token, no dedicated endpoint needed).
  LLAMA_70B: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',

  // Qwen3-235B via Together.ai — unrestricted tier (level 4).
  // 235B total / 22B active (MoE), throughput-optimised variant.
  // Qwen models are permissive for English adult content.
  MIXTRAL: 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput',
} as const

type ModelKey = keyof typeof MODELS

// ─── Routing decision ─────────────────────────────────────────────────────────

export function selectModel(explicitness: ExplicitnessLevel): ModelKey {
  switch (explicitness) {
    case 1:
    case 2:
      return 'CLAUDE'
    case 3:
      return 'LLAMA_70B'
    case 4:
      return 'MIXTRAL'
  }
}

// ─── Unified stream interface ─────────────────────────────────────────────────
// Returns an async iterator of text tokens regardless of which model is used.
// The caller (api/generate route handler) processes tokens identically
// regardless of which model produced them.

export async function* streamFromModel(
  prompt: BuiltPrompt,
  model: ModelKey,
): AsyncGenerator<string, void, unknown> {
  switch (model) {
    case 'CLAUDE':
      yield* streamClaude(prompt)
      break
    case 'LLAMA_70B':
    case 'MIXTRAL':
      yield* streamTogether(prompt, MODELS[model])
      break
  }
}

// ─── Claude adapter ───────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

async function* streamClaude(
  prompt: BuiltPrompt,
): AsyncGenerator<string, void, unknown> {
  const stream = anthropic.messages.stream({
    model: MODELS.CLAUDE,
    max_tokens: prompt.max_tokens,
    temperature: prompt.temperature,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}

// ─── Together.ai adapter ──────────────────────────────────────────────────────
// Together.ai supports the OpenAI-compatible chat completions API with streaming.
// We use fetch directly (no SDK dependency) — keeps the edge bundle lean.
//
// System prompt mapping:
// Together.ai / Llama / Mixtral use the standard chat completions format:
// [{role: "system", content: "..."}, {role: "user", content: "..."}]
// This maps directly from our BuiltPrompt.system and BuiltPrompt.user fields.
//
// Temperature note: Together.ai models accept 0.0–1.0. Our prompt engine
// produces 0.92 which is within range — no adjustment needed.

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
      // Together.ai-specific: repetition penalty helps with erotic fiction
      // which tends toward repetitive phrasing without it.
      repetition_penalty: 1.08,
      // top_p slightly tighter than default for more coherent prose
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

  // Parse Server-Sent Events from the response body stream
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
// (Stored here so they live near the model selection logic)
//
// Llama 3.1 70B vs Claude — known differences to tune for in prompt engineering:
//
// LLAMA TENDENCIES (prompt against these):
//   - More direct/blunt physicality — less emotional interiority by default
//   - Occasional repetition of phrases, especially adjectives → repetition_penalty helps
//   - Weaker at maintaining a consistent character voice across long passages
//   - Stronger at explicit physical description but weaker at the charged moment *before*
//   - Sometimes breaks fourth wall or adds meta-commentary → prompt explicitly against this
//
// COMPENSATIONS IN SYSTEM PROMPT FOR LLAMA (add to prompt engine for levels 3-4):
//   - "Write with psychological depth. The body matters less than what the body feels."
//   - "Maintain the protagonist's interior voice throughout. Never break perspective."
//   - "Vary your sentence rhythm. Short sentences for tension. Long for surrender."
//   - "The most explicit content should still earn its explicitness through emotional truth."
//
// These additions are injected by the prompt engine when explicitness >= 3.
// See prompt-engine.ts: LLAMA_SUPPLEMENT constant (add in next iteration).
