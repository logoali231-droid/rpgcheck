import { useEffect, useMemo, useRef, useState } from 'react'

export interface PaletteCommand {
  id: string
  label: string
  group: string
  hint?: string
  run: () => void
}

export function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean
  commands: PaletteCommand[]
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands
      .map((command) => {
        const haystack = `${command.label} ${command.group} ${command.hint ?? ''}`.toLowerCase()
        const direct = haystack.indexOf(q)
        const words = q.split(/\s+/)
        const allWords = words.every((word) => haystack.includes(word))
        if (direct < 0 && !allWords) return null
        return { command, score: direct >= 0 ? direct : 500 }
      })
      .filter((entry): entry is { command: PaletteCommand; score: number } => entry !== null)
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.command)
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      const timer = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const item = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const grouped: { group: string; items: PaletteCommand[] }[] = []
  for (const command of filtered) {
    const last = grouped[grouped.length - 1]
    if (last && last.group === command.group) last.items.push(command)
    else grouped.push({ group: command.group, items: [command] })
  }

  let flatIndex = -1
  const handleKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => Math.min(filtered.length - 1, current + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(0, current - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = filtered[active]
      if (command) {
        command.run()
        onClose()
      }
    }
  }

  return (
    <div className="modal" role="presentation" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Type a command, item or module…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKey}
          aria-label="Command input"
        />
        <div className="palette__list" ref={listRef}>
          {filtered.length === 0 ? <p className="empty">No matching commands.</p> : null}
          {grouped.map((group) => (
            <div key={group.group}>
              <div className="palette__group">{group.group}</div>
              {group.items.map((command) => {
                flatIndex++
                const index = flatIndex
                return (
                  <button
                    key={command.id}
                    data-index={index}
                    className={`palette__item${index === active ? ' palette__item--active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      command.run()
                      onClose()
                    }}
                  >
                    <span>{command.label}</span>
                    {command.hint ? <span className="palette__hint">{command.hint}</span> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <footer className="palette__foot">
          <span>↑ ↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </footer>
      </div>
    </div>
  )
}
