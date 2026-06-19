/**
 * WebAuthn server helpers.
 * These functions run in Node.js runtime only (not edge) because
 * @simplewebauthn/server depends on the Web Crypto API via Node.
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import { createHmac, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// ─── Relying party config ─────────────────────────────────────────────────────

export const RP_NAME    = 'Yearns'
export const RP_ID      = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
  : 'localhost'
export const RP_ORIGIN  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── Challenge cookie ─────────────────────────────────────────────────────────

const CHALLENGE_COOKIE = 'yn_wac'
const HMAC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-secret'

function signChallenge(challenge: string): string {
  return createHmac('sha256', HMAC_KEY).update(challenge).digest('hex')
}

export async function setChallengeCookie(challenge: string) {
  const sig = signChallenge(challenge)
  const cookieStore = await cookies()
  cookieStore.set(CHALLENGE_COOKIE, `${challenge}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 300, // 5 minutes — more than enough to complete ceremony
    path: '/',
  })
}

export async function consumeChallengeCookie(): Promise<string> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(CHALLENGE_COOKIE)?.value
  cookieStore.delete(CHALLENGE_COOKIE)
  if (!raw) throw new Error('No challenge cookie found')
  const [challenge, sig] = raw.split('.')
  if (!challenge || !sig) throw new Error('Malformed challenge cookie')
  if (sig !== signChallenge(challenge)) throw new Error('Challenge cookie signature invalid')
  return challenge
}

// ─── Service-role Supabase client ─────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Credential CRUD ──────────────────────────────────────────────────────────

export interface StoredCredential {
  id:            string
  credential_id: string
  public_key:    string
  counter:       number
  device_label:  string | null
}

export async function getCredentialsForUser(userId: string): Promise<StoredCredential[]> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('id, credential_id, public_key, counter, device_label')
    .eq('user_id', userId)
  if (error) throw error
  return data ?? []
}

export async function getCredentialById(credentialId: string): Promise<StoredCredential & { user_id: string } | null> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('webauthn_credentials')
    .select('id, credential_id, public_key, counter, device_label, user_id')
    .eq('credential_id', credentialId)
    .single()
  return data ?? null
}

export async function saveCredential(userId: string, {
  credentialId,
  publicKey,
  counter,
  deviceLabel,
}: {
  credentialId: string
  publicKey:    string
  counter:      number
  deviceLabel:  string | null
}) {
  const supabase = adminClient()
  const { error } = await supabase.from('webauthn_credentials').insert({
    user_id:      userId,
    credential_id: credentialId,
    public_key:   publicKey,
    counter,
    device_label: deviceLabel,
  })
  if (error) throw error
}

export async function updateCredentialCounter(credentialId: string, newCounter: number) {
  const supabase = adminClient()
  await supabase
    .from('webauthn_credentials')
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq('credential_id', credentialId)
}

export async function deleteCredential(credentialId: string, userId: string) {
  const supabase = adminClient()
  const { error } = await supabase
    .from('webauthn_credentials')
    .delete()
    .eq('credential_id', credentialId)
    .eq('user_id', userId)
  if (error) throw error
}

// ─── Registration ceremony ────────────────────────────────────────────────────

export async function buildRegistrationOptions(userId: string, userEmail: string) {
  const existingCredentials = await getCredentialsForUser(userId)

  const options = await generateRegistrationOptions({
    rpName:   RP_NAME,
    rpID:     RP_ID,
    userID:   Buffer.from(userId),
    userName: userEmail,
    excludeCredentials: existingCredentials.map(c => ({
      id:         c.credential_id,
      transports: [],
    })),
    authenticatorSelection: {
      residentKey:        'preferred',
      userVerification:   'preferred',
    },
  })

  await setChallengeCookie(options.challenge)
  return options
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceLabel: string | null
) {
  const expectedChallenge = await consumeChallengeCookie()

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID:   RP_ID,
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed')
  }

  const { credential } = verification.registrationInfo

  await saveCredential(userId, {
    credentialId: credential.id,
    publicKey:    Buffer.from(credential.publicKey).toString('base64'),
    counter:      credential.counter,
    deviceLabel:  deviceLabel ?? null,
  })

  return verification
}

// ─── Authentication ceremony ──────────────────────────────────────────────────

export async function buildAuthenticationOptions(userId?: string) {
  const allowCredentials = userId
    ? (await getCredentialsForUser(userId)).map(c => ({
        id:         c.credential_id,
        transports: [] as never[],
      }))
    : []

  const options = await generateAuthenticationOptions({
    rpID:     RP_ID,
    allowCredentials,
    userVerification: 'preferred',
  })

  await setChallengeCookie(options.challenge)
  return options
}

export async function verifyAuthentication(response: AuthenticationResponseJSON) {
  const expectedChallenge = await consumeChallengeCookie()

  const stored = await getCredentialById(response.id)
  if (!stored) throw new Error('Credential not found')

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID:   RP_ID,
    credential: {
      id:         stored.credential_id,
      publicKey:  Buffer.from(stored.public_key, 'base64'),
      counter:    stored.counter,
    },
  })

  if (!verification.verified) throw new Error('Authentication verification failed')

  await updateCredentialCounter(response.id, verification.authenticationInfo.newCounter)

  return { ...verification, userId: stored.user_id }
}
