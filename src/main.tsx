import { createRoot } from 'react-dom/client'
import App from './App'
import LoginScreen from './components/LoginScreen'
import { AuthProvider, useAuth } from './store/auth'
import { ProjectProvider } from './store/project'
import { projectKeyFor } from './lib/localAuth'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing')

function Gate() {
  const { user } = useAuth()
  if (!user) return <LoginScreen />
  return (
    <ProjectProvider key={user.id} storageKey={projectKeyFor(user.id)}>
      <App />
    </ProjectProvider>
  )
}

createRoot(container).render(
  <AuthProvider>
    <Gate />
  </AuthProvider>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline install support is optional; the app still runs online.
    })
  })
}
