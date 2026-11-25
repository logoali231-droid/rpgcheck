export interface LocalUser {
  id: string
  name: string
  salt: string
  hash: string
  createdAt: number
}

const USERS_KEY = 'balance-sandbox:users:v1'
const SESSION_KEY = 'balance-sandbox:session:v1'
export const GUEST_ID = 'guest'
export const GUEST_PROJECT_KEY = 'balance-sandbox:project:v1'

function isUser(value: unknown): value is LocalUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<LocalUser>
  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.salt === 'string' &&
    typeof user.hash === 'string'
  )
}

export function loadUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isUser) : []
  } catch {
    return []
  }
}

export function persistUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function persistSession(userId: string | null) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Session storage is best-effort; the app still works for this tab.
  }
}

export function projectKeyFor(userId: string): string {
  return userId === GUEST_ID ? GUEST_PROJECT_KEY : `balance-sandbox:project:user:${userId}`
}

function fallbackHash(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fallback_${(hash >>> 0).toString(16)}`
}

/**
 * PINs are a casual local lock, not encryption: this only keeps the hash in
 * localStorage so another person on the same browser cannot read the PIN.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const input = `${salt}:${pin}`
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch {
    // Fall through to the non-cryptographic hash in insecure contexts.
  }
  return fallbackHash(input)
}

export function makeSalt(): string {
  try {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12))
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return Math.random().toString(36).slice(2, 14)
  }
}
