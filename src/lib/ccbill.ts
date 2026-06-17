/**
 * CCBill integration helpers.
 *
 * CCBill is the parallel adult-content payment processor.
 * It MUST be live at launch — Stripe drops adult merchants without warning.
 * Setup: https://www.ccbill.com/ → request a FlexForm ID from your account manager.
 *
 * Required env vars:
 *   CCBILL_ACCOUNT_NUMBER     — 6-digit account number
 *   CCBILL_SUB_ACCOUNT_NUMBER — 4-digit sub-account
 *   CCBILL_WEBHOOK_SECRET     — account salt (used for price hashes + postback digest)
 *   CCBILL_FLEXFORM_ID        — FlexForm ID from CCBill dashboard
 */

// ─── MD5 ──────────────────────────────────────────────────────────────────────
// Pure-JS MD5 (RFC 1321) — edge-compatible, no Node.js crypto dependency.
// Required because CCBill uses MD5 for price verification hashes.
// Web Crypto does not support MD5, so this cannot use crypto.subtle.

function md5(input: string): string {
  const rotate = (n: number, s: number) => (n << s) | (n >>> (32 - s))

  const toHex = (n: number) => {
    let s = ''
    for (let i = 0; i < 4; i++) s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    return s
  }

  // UTF-8 encode
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c < 0x80)       { bytes.push(c) }
    else if (c < 0x800) { bytes.push((c >> 6) | 0xc0, (c & 0x3f) | 0x80) }
    else                { bytes.push((c >> 12) | 0xe0, ((c >> 6) & 0x3f) | 0x80, (c & 0x3f) | 0x80) }
  }

  const len = bytes.length
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  const bits = len * 8
  for (let i = 0; i < 4; i++) bytes.push((bits >>> (i * 8)) & 0xff)
  for (let i = 0; i < 4; i++) bytes.push(0) // high 32 bits — zero for inputs < 512 MB

  // Pre-computed sine-derived constants
  const T = Array.from({ length: 64 }, (_, i) => (Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0)

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476

  for (let blk = 0; blk < bytes.length; blk += 64) {
    const M = Array.from({ length: 16 }, (_, j) =>
      bytes[blk + j * 4]        |
      (bytes[blk + j * 4 + 1] << 8)  |
      (bytes[blk + j * 4 + 2] << 16) |
      (bytes[blk + j * 4 + 3] << 24),
    )

    const [aa, bb, cc, dd] = [a, b, c, d]

    const F = (x: number, y: number, z: number) => (x & y) | (~x & z)
    const G = (x: number, y: number, z: number) => (x & z) | (y & ~z)
    const H = (x: number, y: number, z: number) => x ^ y ^ z
    const I = (x: number, y: number, z: number) => y ^ (x | ~z)

    // Round 1
    for (let j = 0; j < 16; j++) {
      const s = [7, 12, 17, 22][j % 4]
      const t = (b + rotate((a + F(b, c, d) + M[j] + T[j]) | 0, s)) | 0
      ;[a, b, c, d] = [d, t, b, c]
    }
    // Round 2
    for (let j = 0; j < 16; j++) {
      const s = [5, 9, 14, 20][j % 4]
      const t = (b + rotate((a + G(b, c, d) + M[(5 * j + 1) % 16] + T[16 + j]) | 0, s)) | 0
      ;[a, b, c, d] = [d, t, b, c]
    }
    // Round 3
    for (let j = 0; j < 16; j++) {
      const s = [4, 11, 16, 23][j % 4]
      const t = (b + rotate((a + H(b, c, d) + M[(3 * j + 5) % 16] + T[32 + j]) | 0, s)) | 0
      ;[a, b, c, d] = [d, t, b, c]
    }
    // Round 4
    for (let j = 0; j < 16; j++) {
      const s = [6, 10, 15, 21][j % 4]
      const t = (b + rotate((a + I(b, c, d) + M[(7 * j) % 16] + T[48 + j]) | 0, s)) | 0
      ;[a, b, c, d] = [d, t, b, c]
    }

    a = (a + aa) | 0; b = (b + bb) | 0; c = (c + cc) | 0; d = (d + dd) | 0
  }

  return toHex(a) + toHex(b) + toHex(c) + toHex(d)
}

// ─── Price hash ───────────────────────────────────────────────────────────────
// Prevents URL tampering. CCBill rejects any checkout URL where the price
// fields don't match the hash.
//
// Formula: MD5(initialPrice + initialPeriod + recurringPrice + recurringPeriod
//              + rebills + currencyCode + MD5(salt))

export function ccbillPriceHash(params: {
  initialPrice:    string
  initialPeriod:   number
  recurringPrice:  string
  recurringPeriod: number
  rebills:         number
  currencyCode:    string
  salt:            string
}): string {
  const saltHash = md5(params.salt)
  const input = [
    params.initialPrice,
    String(params.initialPeriod),
    params.recurringPrice,
    String(params.recurringPeriod),
    String(params.rebills),
    params.currencyCode,
    saltHash,
  ].join('')
  return md5(input)
}

// ─── Postback verification ────────────────────────────────────────────────────
// CCBill signs approval postbacks with:
//   MD5(subscriptionId + MD5(salt))
// where salt = CCBILL_WEBHOOK_SECRET.

export function verifyCcbillPostback(subscriptionId: string, digest: string, salt: string): boolean {
  const expected = md5(subscriptionId + md5(salt))
  return expected === digest.toLowerCase()
}

// ─── Plan config ──────────────────────────────────────────────────────────────

export const CCBILL_PLANS = {
  monthly: { initialPrice: '12.99', initialPeriod: 30,  recurringPrice: '12.99', recurringPeriod: 30  },
  annual:  { initialPrice: '99.00', initialPeriod: 365, recurringPrice: '99.00', recurringPeriod: 365 },
} as const

export type CcbillPlanKey = keyof typeof CCBILL_PLANS
