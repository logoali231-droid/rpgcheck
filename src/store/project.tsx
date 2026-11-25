import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Project } from '../lib/types'
import { sampleProject } from '../lib/sample'
import { sanitizeProject } from '../lib/validate'

const STORAGE_KEY = 'balance-sandbox:project:v1'

interface ProjectContextValue {
  project: Project
  update: (mutate: (draft: Project) => void) => void
  replace: (project: Project) => void
  reset: () => void
  savedAt: number | null
  storageError: string | null
  exportKey: string
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

function loadInitial(storageKey: string): Project {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return sampleProject()
    const parsed = JSON.parse(raw)
    // Projects saved before the Pulso d6 reshape cannot be mapped to the new
    // statblock model; start them on the current sample instead.
    if (!parsed || parsed.version !== 3) return sampleProject()
    return sanitizeProject(parsed)
  } catch {
    return sampleProject()
  }
}

export function ProjectProvider({
  children,
  storageKey = STORAGE_KEY,
}: {
  children: ReactNode
  storageKey?: string
}) {
  const [project, setProject] = useState<Project>(() => loadInitial(storageKey))
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const projectRef = useRef(project)
  projectRef.current = project

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(project))
        setSavedAt(Date.now())
        setStorageError(null)
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : 'localStorage write failed')
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [project, storageKey])

  // Flush on unmount (for example when signing out) so the last edits are not
  // lost when the debounce is cancelled.
  useEffect(
    () => () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(projectRef.current))
      } catch {
        // The debounced save already reports storage errors.
      }
    },
    [storageKey],
  )

  const update = useCallback((mutate: (draft: Project) => void) => {
    setProject((previous) => {
      const draft: Project = structuredClone(previous)
      mutate(draft)
      draft.updatedAt = Date.now()
      return draft
    })
  }, [])

  const replace = useCallback((next: Project) => {
    setProject(sanitizeProject(next))
  }, [])

  const reset = useCallback(() => {
    setProject(sampleProject())
  }, [])

  const value = useMemo(
    () => ({ project, update, replace, reset, savedAt, storageError, exportKey: storageKey }),
    [project, update, replace, reset, savedAt, storageError, storageKey],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
