import { useState, type FormEvent } from 'react'
import { useAuth } from '../store/auth'
import { Button, Field } from './ui'

export default function LoginScreen() {
  const { users, signIn, signUp, continueAsGuest } = useAuth()
  const [mode, setMode] = useState<'signin' | 'create'>(users.length ? 'signin' : 'create')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (mode === 'create' && pin !== confirmPin) {
      setError('PINs do not match.')
      return
    }
    setPending(true)
    const message = mode === 'create' ? await signUp(name, pin) : await signIn(name, pin)
    setPending(false)
    if (message) setError(message)
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__brand">
          <span className="brandmark">⚖</span>
          <div>
            <h1>Balance Sandbox</h1>
            <p>local · deterministic · offline</p>
          </div>
        </div>

        <div>
          <h2>{mode === 'create' ? 'Create a local profile' : 'Sign in'}</h2>
          <p className="hint">
            {users.length
              ? `${users.length} local profile${users.length === 1 ? '' : 's'} on this browser. Each profile keeps its own project.`
              : 'No profiles yet. Create one to keep a separate project on this browser.'}
          </p>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab${mode === 'signin' ? ' tab--active' : ''}`}
            onClick={() => {
              setMode('signin')
              setError(null)
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`tab${mode === 'create' ? ' tab--active' : ''}`}
            onClick={() => {
              setMode('create')
              setError(null)
            }}
          >
            Create profile
          </button>
        </div>

        <form className="login__form" onSubmit={submit}>
          <Field label="Profile name">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="username"
              autoFocus
              maxLength={24}
            />
          </Field>
          <Field label="PIN" hint="4–8 digits">
            <input
              className="input"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            />
          </Field>
          {mode === 'create' ? (
            <Field label="Confirm PIN">
              <input
                className="input"
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                autoComplete="new-password"
              />
            </Field>
          ) : null}
          {error ? <p className="callout callout--bad">{error}</p> : null}
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? 'Checking…' : mode === 'create' ? 'Create profile' : 'Sign in'}
          </Button>
        </form>

        <button type="button" className="login__guest" onClick={continueAsGuest}>
          Continue as guest →
        </button>
        <p className="login__note">
          Profiles, PINs and projects stay in this browser. The PIN is a casual lock, not encryption —
          clearing browser data removes everything.
        </p>
      </div>
    </div>
  )
}
