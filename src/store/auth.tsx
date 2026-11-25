import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  GUEST_ID,
  GUEST_PROJECT_KEY,
  hashPin,
  loadSession,
  loadUsers,
  makeSalt,
  persistSession,
  persistUsers,
  projectKeyFor,
  type LocalUser,
} from '../lib/localAuth'

export interface AuthUser {
  id: string
  name: string
  guest: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  users: LocalUser[]
  signIn: (name: string, pin: string) => Promise<string | null>
  signUp: (name: string, pin: string) => Promise<string | null>
  continueAsGuest: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<LocalUser[]>(loadUsers)
  const [userId, setUserId] = useState<string | null>(loadSession)

  const user = useMemo<AuthUser | null>(() => {
    if (!userId) return null
    if (userId === GUEST_ID) return { id: GUEST_ID, name: 'Guest', guest: true }
    const found = users.find((entry) => entry.id === userId)
    return found ? { id: found.id, name: found.name, guest: false } : null
  }, [userId, users])

  const signIn = useCallback(
    async (name: string, pin: string) => {
      const clean = name.trim()
      if (!clean) return 'Enter your profile name.'
      if (!/^\d{4,8}$/.test(pin)) return 'PIN must be 4–8 digits.'
      const found = users.find((entry) => entry.name.toLowerCase() === clean.toLowerCase())
      if (!found) return 'No local profile with that name.'
      const hash = await hashPin(pin, found.salt)
      if (hash !== found.hash) return 'Incorrect PIN.'
      persistSession(found.id)
      setUserId(found.id)
      return null
    },
    [users],
  )

  const signUp = useCallback(
    async (name: string, pin: string) => {
      const clean = name.trim()
      if (clean.length < 2) return 'Name needs at least 2 characters.'
      if (clean.length > 24) return 'Name must be 24 characters or fewer.'
      if (!/^\d{4,8}$/.test(pin)) return 'PIN must be 4–8 digits.'
      if (users.some((entry) => entry.name.toLowerCase() === clean.toLowerCase())) {
        return 'A profile with that name already exists.'
      }
      const salt = makeSalt()
      const hash = await hashPin(pin, salt)
      const created: LocalUser = {
        id: `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: clean,
        salt,
        hash,
        createdAt: Date.now(),
      }
      const next = [...users, created]
      persistUsers(next)
      setUsers(next)

      // Carry the guest project into the first account so existing work is not
      // stranded when a player creates their profile.
      const key = projectKeyFor(created.id)
      if (!localStorage.getItem(key)) {
        const guest = localStorage.getItem(GUEST_PROJECT_KEY)
        if (guest) localStorage.setItem(key, guest)
      }

      persistSession(created.id)
      setUserId(created.id)
      return null
    },
    [users],
  )

  const continueAsGuest = useCallback(() => {
    persistSession(GUEST_ID)
    setUserId(GUEST_ID)
  }, [])

  const signOut = useCallback(() => {
    persistSession(null)
    setUserId(null)
  }, [])

  const value = useMemo(
    () => ({ user, users, signIn, signUp, continueAsGuest, signOut }),
    [user, users, signIn, signUp, continueAsGuest, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
