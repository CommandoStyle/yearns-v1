/**
 * External plagiarism check — backstop against reproducing published text.
 *
 * Applied selectively (NOT on every generation):
 *   - When a user saves a Yearn (async, non-blocking)
 *   - When a trainer tags a story 'gold'
 *
 * This is the ONLY file that knows which provider is in use.
 * The interface is intentionally stable so the provider can be swapped
 * (Copyleaks → Originality.ai → in-house) without touching calling code.
 *
 * Provider: set PLAGIARISM_PROVIDER env var to 'copyleaks' or 'originality'
 * (defaults to 'stub' when neither API key is configured — logs a warning).
 */

export interface PlagiarismCheckResult {
  flagged:         boolean
  similarityScore: number      // 0–1, provider-normalised
  matchedSources:  Array<{ url: string; similarity: number }>
  provider:        string
  checkedAt:       string
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function checkWithOriginalityAi(text: string): Promise<PlagiarismCheckResult> {
  const apiKey = process.env.ORIGINALITY_AI_API_KEY!
  const res = await fetch('https://api.originality.ai/api/v1/scan/ai-plag', {
    method:  'POST',
    headers: {
      'X-OAI-API-KEY': apiKey,
      'Accept':        'application/json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ content: text, plag: 1, ai: 0 }),
  })

  if (!res.ok) {
    throw new Error(`Originality.ai API error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json() as {
    plagiarism?: {
      score?: { overall?: number }
      sources?: Array<{ url: string; score: number }>
    }
  }

  const score   = data.plagiarism?.score?.overall ?? 0
  const sources = (data.plagiarism?.sources ?? []).map(s => ({
    url:        s.url,
    similarity: s.score / 100,
  }))

  return {
    flagged:         score >= 0.2,  // 20% external similarity is concerning
    similarityScore: score / 100,
    matchedSources:  sources,
    provider:        'originality.ai',
    checkedAt:       new Date().toISOString(),
  }
}

async function checkWithCopyleaks(text: string): Promise<PlagiarismCheckResult> {
  // Copyleaks uses a two-step async flow (submit → webhook result).
  // For V1 synchronous usage, use their "quick scan" endpoint if available,
  // or adapt to webhook pattern when integrating properly.
  // This is a placeholder that throws so the caller falls back to no-op.
  void text
  throw new Error('Copyleaks integration not yet implemented — switch PLAGIARISM_PROVIDER to originality')
}

// ─── Stub (no provider configured) ───────────────────────────────────────────

function stubResult(): PlagiarismCheckResult {
  return {
    flagged:         false,
    similarityScore: 0,
    matchedSources:  [],
    provider:        'stub',
    checkedAt:       new Date().toISOString(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkExternalOriginality(text: string): Promise<PlagiarismCheckResult> {
  const provider = process.env.PLAGIARISM_PROVIDER ?? ''

  if (provider === 'originality' && process.env.ORIGINALITY_AI_API_KEY) {
    return checkWithOriginalityAi(text)
  }

  if (provider === 'copyleaks' && process.env.COPYLEAKS_API_KEY) {
    return checkWithCopyleaks(text)
  }

  // No provider configured — log once (at module load time this would be
  // noisy; instead log on first call so it's visible in Vercel function logs)
  console.warn('[yearns/plagiarism] No provider configured. Set PLAGIARISM_PROVIDER + API key to enable external checks.')
  return stubResult()
}

/**
 * Fire-and-forget wrapper for the save flow.
 * Call this AFTER the save response is already sent to the user.
 * Any error is swallowed — plagiarism check failures must never affect saves.
 */
export function scheduleExternalOriginalityCheck(
  yearnId: string,
  storyText: string,
  onFlagged: (yearnId: string, result: PlagiarismCheckResult) => Promise<void>,
): void {
  checkExternalOriginality(storyText)
    .then(async (result) => {
      if (result.flagged) {
        await onFlagged(yearnId, result)
      }
    })
    .catch((err) => {
      console.error('[yearns/plagiarism] External check failed (non-fatal):', err)
    })
}
