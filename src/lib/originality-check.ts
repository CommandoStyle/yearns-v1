/**
 * N-gram similarity check against the gold corpus.
 *
 * Detects suspiciously close textual overlap — not exact-match plagiarism
 * detection, but a fast, cheap signal for "this looks too similar to something
 * already in the corpus."
 *
 * Approach: shingle both texts into n-grams (n=8 words), compute Jaccard
 * similarity between the shingle sets. Catches near-duplicate passages even
 * with minor word substitutions, without external services. Pure string
 * processing; runs in milliseconds for corpora up to a few hundred entries.
 *
 * KNOWN FUTURE OPTIMISATION: as the gold corpus grows past ~500 entries,
 * re-shingling every entry on each check becomes a bottleneck. Fix: pre-compute
 * shingle sets once per corpus entry and store them in a `gold_corpus_shingles`
 * table rather than recomputing. Do not build this prematurely — V1 scale does
 * not warrant it.
 */

export interface SimilarityResult {
  maxSimilarity:  number           // 0–1, highest Jaccard match found
  matchedStoryId: string | null
  matchedPassage: string | null    // overlapping shingles text, for trainer review
  flagged:        boolean          // true if maxSimilarity >= threshold
  checkedAt:      string
}

const SIMILARITY_THRESHOLD = 0.35  // tune based on false-positive rate in testing
const SHINGLE_SIZE = 8             // words per shingle

function shingle(text: string, n: number): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  const shingles = new Set<string>()
  for (let i = 0; i <= words.length - n; i++) {
    shingles.add(words.slice(i, i + n).join(' '))
  }
  return shingles
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  a.forEach(s => { if (b.has(s)) intersection++ })
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function findOverlappingPassage(
  a: Set<string>,
  b: Set<string>,
): string | null {
  const overlapping: string[] = []
  a.forEach(s => {
    if (b.has(s) && overlapping.length < 5) overlapping.push(s)
  })
  return overlapping.length > 0 ? overlapping.join(' … ') : null
}

export function checkAgainstGoldCorpus(
  newText: string,
  goldCorpusTexts: Array<{ story_id: string; text: string }>,
): SimilarityResult {
  const newShingles = shingle(newText, SHINGLE_SIZE)

  let maxSimilarity  = 0
  let matchedStoryId: string | null = null
  let matchedPassage: string | null = null

  for (const entry of goldCorpusTexts) {
    const entryShingles = shingle(entry.text, SHINGLE_SIZE)
    const similarity    = jaccardSimilarity(newShingles, entryShingles)
    if (similarity > maxSimilarity) {
      maxSimilarity  = similarity
      matchedStoryId = entry.story_id
      matchedPassage = similarity >= SIMILARITY_THRESHOLD
        ? findOverlappingPassage(newShingles, entryShingles)
        : null
    }
  }

  return {
    maxSimilarity,
    matchedStoryId,
    matchedPassage,
    flagged:    maxSimilarity >= SIMILARITY_THRESHOLD,
    checkedAt:  new Date().toISOString(),
  }
}
