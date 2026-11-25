import { useEffect, useState, type ReactNode } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// Chrome fires this event once, often before React has mounted. Capture it as
// early as the module loads so the Download button never misses its chance.
let earlyPrompt: BeforeInstallPromptEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    earlyPrompt = event as BeforeInstallPromptEvent
    window.dispatchEvent(new Event('pulso:installprompt'))
  })
}

type Platform = 'ios' | 'android' | 'desktop'

const PLATFORM_LABELS: Record<Platform, string> = {
  ios: 'iPhone / iPad',
  android: 'Android',
  desktop: 'Computer',
}

const HELP: Record<Platform, { lead: string; steps: ReactNode[]; note: string }> = {
  ios: {
    lead: 'Add the app from Safari',
    steps: [
      <>Open this page in <strong>Safari</strong>.</>,
      <>Tap the <strong>Share</strong> button (square with an arrow).</>,
      <>Scroll down, tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</>,
    ],
    note: 'Chrome and Firefox on iOS cannot install web apps — use Safari’s Share menu.',
  },
  android: {
    lead: 'Install from your browser menu',
    steps: [
      <>Open the browser menu (<strong>⋮</strong> in Chrome).</>,
      <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>,
      <>Confirm <strong>Install</strong> — the app gets its own icon and opens full screen.</>,
    ],
    note: 'If an install icon appears in the address bar, you can tap that instead.',
  },
  desktop: {
    lead: 'Install from Chrome or Edge',
    steps: [
      <>Click the <strong>install icon</strong> in the address bar (a monitor with a down arrow).</>,
      <>Or open the <strong>⋮</strong> menu → <strong>Install Balance Sandbox</strong> (Edge: Apps → Install this site as an app).</>,
      <>Confirm <strong>Install</strong> — it opens in its own window from now on.</>,
    ],
    note: 'Firefox and Safari on desktop cannot install PWAs — use Chrome or Edge.',
  },
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(earlyPrompt)
  const [installed, setInstalled] = useState(isStandalone)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpPlatform, setHelpPlatform] = useState<Platform>(detectPlatform)

  useEffect(() => {
    const syncPrompt = () => setPromptEvent(earlyPrompt)
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
      earlyPrompt = null
      setHelpOpen(false)
    }
    window.addEventListener('pulso:installprompt', syncPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('pulso:installprompt', syncPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (!helpOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelpOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [helpOpen])

  if (installed) return <span className="install-state">✓ App installed</span>

  const startInstall = async () => {
    if (!promptEvent) {
      setHelpPlatform(detectPlatform())
      setHelpOpen(true)
      return
    }
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
    earlyPrompt = null
  }

  const help = HELP[helpPlatform]

  return (
    <>
      <button
        className="btn btn--sm install-btn"
        onClick={startInstall}
        title="Install Balance Sandbox as an app — works offline"
      >
        <span aria-hidden="true">⤓</span> Download app
      </button>

      {helpOpen ? (
        <div
          className="modal"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false)
          }}
        >
          <div className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
            <div className="install-help__head">
              <div>
                <h3 id="install-help-title">Download Balance Sandbox</h3>
                <p>Install it on this device — no store, no file, works offline.</p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setHelpOpen(false)}
                aria-label="Close install help"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="install-help__body">
              <div className="chips install-help__platforms">
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((key) => (
                  <button
                    key={key}
                    className={`chip${helpPlatform === key ? ' chip--active' : ''}`}
                    onClick={() => setHelpPlatform(key)}
                  >
                    {PLATFORM_LABELS[key]}
                  </button>
                ))}
              </div>
              <p className="install-help__lead">{help.lead}</p>
              <ol className="install-help__steps">
                {help.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <div className="callout callout--info">{help.note}</div>
            </div>

            <div className="install-help__foot">
              <span className="hint">Your sheets and projects stay in this device’s browser storage.</span>
              <button className="btn btn--sm" onClick={() => setHelpOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
