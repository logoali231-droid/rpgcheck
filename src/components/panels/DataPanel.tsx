import { useMemo, useRef, useState } from 'react'
import { useProject } from '../../store/project'
import { download, readFileText } from '../../lib/io/download'
import { importSpreadsheet } from '../../lib/io/csv'
import { diffProjects, type EntityDiff } from '../../lib/io/diff'
import {
  exportItemsCsv,
  exportProjectJson,
  exportQuestbook,
  exportRecipesCsv,
  exportSnbt,
} from '../../lib/io/exporters'
import { sanitizeProject } from '../../lib/validate'
import { sampleProject } from '../../lib/sample'
import { slugify } from '../../lib/format'
import type { Project } from '../../lib/types'
import { Badge, Button, Card, Callout, Empty, Stat } from '../ui'

function DiffBlock({ title, diff }: { title: string; diff: EntityDiff }) {
  const unchanged = !diff.added.length && !diff.removed.length && !diff.changed.length
  return (
    <div className="diff-block">
      <h4 className="subhead">
        {title}{' '}
        <span className="muted">
          +{diff.added.length} / −{diff.removed.length} / ~{diff.changed.length}
        </span>
      </h4>
      {unchanged ? <p className="hint">Identical.</p> : null}
      {diff.added.length ? (
        <div className="diff">
          {diff.added.map((entry) => (
            <div key={`add-${entry.id}`} className="diff__entry diff__entry--added">
              <span className="diff__name">+ {entry.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      {diff.removed.length ? (
        <div className="diff">
          {diff.removed.map((entry) => (
            <div key={`rem-${entry.id}`} className="diff__entry diff__entry--removed">
              <span className="diff__name">− {entry.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      {diff.changed.length ? (
        <div className="diff">
          {diff.changed.map((entry) => (
            <div key={`chg-${entry.id}`} className="diff__entry diff__entry--changed">
              <span className="diff__name">~ {entry.name}</span>
              {entry.fields.map((field) => (
                <div key={field.field} className="diff__field">
                  <span className="diff__key">{field.field}</span>
                  <span className="diff__before">{field.before}</span>
                  <span className="diff__arrow">→</span>
                  <span className="diff__after">{field.after}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function DataPanel() {
  const { project, replace, reset, savedAt, storageError, exportKey } = useProject()
  const [importText, setImportText] = useState('')
  const [importStatus, setImportStatus] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [sheetText, setSheetText] = useState('')
  const [sheetStatus, setSheetStatus] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [diffA, setDiffA] = useState<Project | null>(null)
  const [diffB, setDiffB] = useState<Project | null>(null)
  const [diffStatus, setDiffStatus] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const diffAFileRef = useRef<HTMLInputElement>(null)
  const diffBFileRef = useRef<HTMLInputElement>(null)

  const sheet = useMemo(() => importSpreadsheet(project, sheetText), [project, sheetText])
  const diff = useMemo(() => (diffA && diffB ? diffProjects(diffA, diffB) : null), [diffA, diffB])

  const bytes = useMemo(() => new Blob([JSON.stringify(project)]).size, [project])

  const applyImport = (text: string) => {
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object') throw new Error('JSON must be an object')
      const next = sanitizeProject(parsed)
      replace(next)
      setImportStatus({
        tone: 'good',
        text: `Loaded “${next.name}” — ${next.items.length} items, ${next.recipes.length} recipes, ${next.achievements.length} achievements.`,
      })
    } catch (error) {
      setImportStatus({ tone: 'bad', text: `Import failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const loadDiff = async (file: File, target: 'a' | 'b') => {
    try {
      const text = await readFileText(file)
      const parsed = sanitizeProject(JSON.parse(text))
      if (target === 'a') setDiffA(parsed)
      else setDiffB(parsed)
      setDiffStatus(null)
    } catch (error) {
      setDiffStatus(`Could not read ${file.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const applySheet = () => {
    if (!sheet.items.length && !sheet.recipes.length) {
      setSheetStatus({ tone: 'bad', text: 'Nothing to import.' })
      return
    }
    const snapshot = { items: sheet.items, recipes: sheet.recipes }
    replace({
      ...project,
      items: [...project.items, ...snapshot.items],
      recipes: [...project.recipes, ...snapshot.recipes],
    })
    setSheetStatus({
      tone: 'good',
      text: `Imported ${snapshot.items.length} new items and ${snapshot.recipes.length} linked recipes.`,
    })
    setSheetText('')
  }

  const clearProject = () => {
    if (!window.confirm('Clear every item, recipe, achievement, character, combatant and survival setting in this project?')) return
    const empty = sampleProject()
    empty.name = 'Untitled Sandbox'
    empty.items = []
    empty.recipes = []
    empty.achievements = []
    empty.advancement.entries = []
    empty.combat.combatants = []
    empty.survival.sources = []
    empty.characters = []
    replace(empty)
  }

  return (
    <div className="stack">
      <Card title="Project backup" subtitle="Everything lives in your browser — nothing is uploaded.">
        <div className="stats">
          <Stat label="Items" value={project.items.length} />
          <Stat label="Recipes" value={project.recipes.length} />
          <Stat label="Achievements" value={project.achievements.length} />
          <Stat label="Stored size" value={`${(bytes / 1024).toFixed(1)} KB`} sub={exportKey} />
          <Stat
            label="Autosave"
            value={savedAt ? new Date(savedAt).toLocaleTimeString() : 'pending'}
            sub="localStorage"
            tone={storageError ? 'bad' : 'good'}
          />
        </div>
        {storageError ? <Callout tone="bad" title="Autosave failed">{storageError}</Callout> : null}

        <div className="btn-row">
          <Button variant="primary" onClick={() => exportProjectJson(project)}>
            Export JSON
          </Button>
          <Button onClick={() => exportSnbt(project)}>Export SNBT</Button>
          <Button onClick={() => exportQuestbook(project)}>Export questbook SNBT</Button>
          <Button onClick={() => exportItemsCsv(project)}>Items CSV</Button>
          <Button onClick={() => exportRecipesCsv(project)}>Recipes CSV</Button>
          <Button
            onClick={() => {
              const summary = [
                `Project: ${project.name}`,
                `Items: ${project.items.length}`,
                `Recipes: ${project.recipes.length}`,
                '',
                ...project.items.map((item) => `${item.kind === 'raw' ? '•' : '◆'} ${item.name}${item.unit ? ` (${item.unit})` : ''}`),
              ].join('\n')
              download(`${slugify(project.name)}-summary.txt`, summary)
            }}
          >
            Plain-text summary
          </Button>
        </div>
        <p className="hint">
          JSON round-trips the whole project (including dice, grind, combat and survival settings); CSV and SNBT are for
          version control and external tooling.
        </p>
      </Card>

      <div className="split-2">
        <Card title="Import JSON" subtitle="Replaces the current project after validation.">
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden-input"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const text = await readFileText(file)
              setImportText(text)
              applyImport(text)
              event.target.value = ''
            }}
          />
          <div className="btn-row">
            <Button onClick={() => importFileRef.current?.click()}>Choose file…</Button>
            <Button variant="primary" onClick={() => applyImport(importText)} disabled={!importText.trim()}>
              Import pasted JSON
            </Button>
          </div>
          <textarea
            className="textarea textarea--mono"
            rows={8}
            placeholder="Paste a project JSON export here…"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            aria-label="Project JSON"
          />
          {importStatus ? (
            <Callout tone={importStatus.tone === 'good' ? 'good' : 'bad'}>{importStatus.text}</Callout>
          ) : null}
          <div className="btn-row">
            <Button
              onClick={() => {
                if (window.confirm('Replace the current project with the bundled sample project?')) reset()
              }}
            >
              Load sample project
            </Button>
            <Button variant="danger" onClick={clearProject}>
              Clear project
            </Button>
          </div>
        </Card>

        <Card title="Balance diff" subtitle="Compare two project JSON versions field by field.">
          <input
            ref={diffAFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden-input"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (file) await loadDiff(file, 'a')
              event.target.value = ''
            }}
          />
          <input
            ref={diffBFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden-input"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (file) await loadDiff(file, 'b')
              event.target.value = ''
            }}
          />
          <div className="diff-pickers">
            <div className="diff-picker">
              <span className="field__label">Before</span>
              <strong>{diffA?.name ?? 'Not loaded'}</strong>
              <div className="btn-row">
                <Button small onClick={() => diffAFileRef.current?.click()}>
                  Load file…
                </Button>
                <Button small onClick={() => setDiffA(project)}>
                  Use current
                </Button>
              </div>
            </div>
            <span className="diff-pickers__arrow">→</span>
            <div className="diff-picker">
              <span className="field__label">After</span>
              <strong>{diffB?.name ?? 'Not loaded'}</strong>
              <div className="btn-row">
                <Button small onClick={() => diffBFileRef.current?.click()}>
                  Load file…
                </Button>
                <Button small onClick={() => setDiffB(project)}>
                  Use current
                </Button>
              </div>
            </div>
          </div>
          {diffStatus ? <Callout tone="bad">{diffStatus}</Callout> : null}
          {diff ? (
            <>
              <div className="btn-row">
                <Badge tone="ok">+{diff.totals.items} items</Badge>
                <Badge tone="ok">+{diff.totals.recipes} recipes</Badge>
                <Badge tone="info">+{diff.totals.achievements} achievements</Badge>
              </div>
              <DiffBlock title="Items" diff={diff.items} />
              <DiffBlock title="Recipes" diff={diff.recipes} />
              <DiffBlock title="Achievements" diff={diff.achievements} />
            </>
          ) : (
            <Empty>Load two versions to see balance changes.</Empty>
          )}
        </Card>
      </div>

      <Card
        title="Spreadsheet importer"
        subtitle="Paste from Excel, LibreOffice or Google Sheets — CSV, TSV and semicolon tables are detected automatically."
      >
        <textarea
          className="textarea textarea--mono"
          rows={7}
          placeholder={'name\tkind\ttime\tinputs\nIron Ingot\tcrafted\t40\tIron Ore:2; Coal:1\nBread\tcrafted\t45\tFlour:1; Water:1'}
          value={sheetText}
          onChange={(event) => setSheetText(event.target.value)}
          aria-label="Spreadsheet data"
        />
        <div className="btn-row">
          <Button variant="primary" disabled={!sheetText.trim() || (!sheet.items.length && !sheet.recipes.length)} onClick={applySheet}>
            Import {sheet.items.length} items / {sheet.recipes.length} recipes
          </Button>
          <Button onClick={() => { download('spreadsheet-template.csv', 'name,kind,unit,nutrition,time,difficulty,station,inputs,qty\nIron Ingot,crafted,bar,0,40,2,Furnace,Iron Ore:2; Coal:1,1\n', 'text/csv') }}>
            Download template
          </Button>
        </div>

        {sheetStatus ? <Callout tone={sheetStatus.tone === 'good' ? 'good' : 'bad'}>{sheetStatus.text}</Callout> : null}
        {sheet.warnings.length ? (
          <ul className="bullets">
            {sheet.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        ) : null}

        {sheet.headers.length ? (
          <>
            <h4 className="subhead">Detected columns</h4>
            <div className="chips">
              {sheet.headers.map((header, index) => (
                <Badge key={`${header}-${index}`} tone="info">
                  {header || `(col ${index + 1})`}
                </Badge>
              ))}
              <Badge tone="crafted">{sheet.rowCount} data rows</Badge>
            </div>
          </>
        ) : null}

        {sheet.items.length || sheet.recipes.length ? (
          <div className="split-2">
            <div>
              <h4 className="subhead">Items ({sheet.items.length})</h4>
              <div className="table-wrap">
                <table className="table table--compact">
                  <tbody>
                    {sheet.items.slice(0, 12).map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>
                          <Badge tone={item.kind === 'raw' ? 'raw' : 'crafted'}>{item.kind}</Badge>
                        </td>
                        <td className="right mono">{item.nutrition || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h4 className="subhead">Linked recipes ({sheet.recipes.length})</h4>
              <div className="table-wrap">
                <table className="table table--compact">
                  <tbody>
                    {sheet.recipes.slice(0, 12).map((recipe) => (
                      <tr key={recipe.id}>
                        <td>{recipe.name}</td>
                        <td className="muted mono">
                          {recipe.inputs
                            .map((input) => `${project.items.find((i) => i.id === input.itemId)?.name ?? sheet.items.find((i) => i.id === input.itemId)?.name ?? input.itemId}×${input.qty}`)
                            .join(', ') || '—'}
                        </td>
                        <td className="right mono">{recipe.craftTimeSec}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
        <p className="hint">
          Recognised headers: name, kind, unit, nutrition, time, difficulty, station, inputs, qty, notes. Inputs take
          the form <code>Item:2; Other Item:1</code>.
        </p>
      </Card>
    </div>
  )
}
