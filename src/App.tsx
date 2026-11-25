import { useEffect, useMemo, useState } from 'react'
import { useProject } from './store/project'
import { useAuth } from './store/auth'
import { uid } from './lib/format'
import { sampleProject } from './lib/sample'
import { CommandPalette, type PaletteCommand } from './components/CommandPalette'
import { InstallButton } from './components/InstallButton'
import RecipesPanel from './components/panels/RecipesPanel'
import CharactersPanel from './components/panels/CharactersPanel'
import DicePanel from './components/panels/DicePanel'
import AdvancementPanel from './components/panels/AdvancementPanel'
import CombatPanel from './components/panels/CombatPanel'
import SurvivalPanel from './components/panels/SurvivalPanel'
import UnlocksPanel from './components/panels/UnlocksPanel'
import DataPanel from './components/panels/DataPanel'
import {
  exportItemsCsv,
  exportProjectJson,
  exportQuestbook,
  exportRecipesCsv,
  exportSnbt,
} from './lib/io/exporters'

const MODULES = [
  {
    id: 'recipes',
    label: 'Crafting',
    glyph: '▤',
    title: 'Crafting & Resources',
    subtitle: 'Pulso crafting (Tecnologia, Dif 2–5) with reverse material calculation.',
  },
  {
    id: 'characters',
    label: 'Characters',
    glyph: '☰',
    title: 'Character Sheets & Tests',
    subtitle: 'Official Pulso d6 sheet, rollable tests with automatic derivations, and editable derived formulas.',
  },
  {
    id: 'dice',
    label: 'Resolution',
    glyph: '⚄',
    title: 'Resolution & Probability',
    subtitle: 'd6 pools counting 4–6, difficulty, critical failure, partial success and opposed tests.',
  },
  {
    id: 'advancement',
    label: 'Advancement',
    glyph: '⧖',
    title: 'Advancement Planner',
    subtitle: 'XP purchases per session: skills, advantages and attribute steps.',
  },
  {
    id: 'combat',
    label: 'Encounters',
    glyph: '⚔',
    title: 'Encounter Lab',
    subtitle: 'Threat budgets, archetype statblocks and seeded Pulso combat simulation.',
  },
  {
    id: 'survival',
    label: 'Survival',
    glyph: '☀',
    title: 'Survival & Hunger',
    subtitle: 'Multi-day cycles of demand, gathering, fatigue and health.',
  },
  {
    id: 'unlocks',
    label: 'Unlocks',
    glyph: '⛓',
    title: 'Conditional Unlock Tree',
    subtitle: 'Questbook gates, reachability and softlock detection.',
  },
  {
    id: 'data',
    label: 'Data',
    glyph: '⇅',
    title: 'Import, Export & Diff',
    subtitle: 'JSON, CSV, SNBT, spreadsheet import and balance comparisons.',
  },
] as const

type ModuleId = (typeof MODULES)[number]['id']

export default function App() {
  const { project, update, replace, savedAt } = useProject()
  const { user, signOut } = useAuth()
  const [module, setModule] = useState<ModuleId>('recipes')
  const [selectedItemId, setSelectedItemId] = useState<string>(project.items[0]?.id ?? '')
  const [paletteOpen, setPaletteOpen] = useState(false)

  const activeModule = MODULES.find((entry) => entry.id === module) ?? MODULES[0]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const createItem = () => {
    const id = uid('item')
    update((draft) => {
      draft.items.push({
        id,
        name: `New Item ${draft.items.length + 1}`,
        kind: 'raw',
        unit: '',
        nutrition: 0,
        notes: '',
      })
    })
    setSelectedItemId(id)
    setModule('recipes')
  }

  const createRecipe = (itemId: string) => {
    const item = project.items.find((entry) => entry.id === itemId)
    if (!item) return
    update((draft) => {
      draft.recipes.push({
        id: uid('recipe'),
        name: `Craft ${item.name}`,
        outputItemId: item.id,
        outputQty: 1,
        inputs: [],
        craftTimeSec: 30,
        difficulty: 2,
        station: '',
        requires: [],
      })
    })
    setSelectedItemId(itemId)
    setModule('recipes')
  }

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = MODULES.map((entry) => ({
      id: `nav-${entry.id}`,
      label: entry.title,
      group: 'Go to',
      hint: entry.subtitle,
      run: () => setModule(entry.id),
    }))

    list.push(
      { id: 'new-item', label: 'Create new item', group: 'Actions', run: createItem },
      {
        id: 'new-recipe',
        label: 'Add recipe for selected item',
        group: 'Actions',
        hint: project.items.find((item) => item.id === selectedItemId)?.name,
        run: () => createRecipe(selectedItemId),
      },
      {
        id: 'new-achievement',
        label: 'Create new achievement',
        group: 'Actions',
        run: () => {
          update((draft) => {
            draft.achievements.push({
              id: uid('ach'),
              name: `New Milestone ${draft.achievements.length + 1}`,
              requires: [],
              itemCost: [],
            })
          })
          setModule('unlocks')
        },
      },
      {
        id: 'randomize-seed',
        label: 'Randomize combat seed',
        group: 'Actions',
        run: () => {
          update((draft) => {
            draft.combat.seed = Math.floor(Math.random() * 100000)
          })
          setModule('combat')
        },
      },
      {
        id: 'load-sample',
        label: 'Load sample project',
        group: 'Actions',
        hint: 'replaces current data',
        run: () => {
          if (window.confirm('Replace the current project with the sample project?')) replace(sampleProject())
        },
      },
      { id: 'export-json', label: 'Export project JSON', group: 'Export', run: () => exportProjectJson(project) },
      { id: 'export-snbt', label: 'Export project SNBT', group: 'Export', run: () => exportSnbt(project) },
      { id: 'export-questbook', label: 'Export questbook SNBT', group: 'Export', run: () => exportQuestbook(project) },
      { id: 'export-items', label: 'Export items CSV', group: 'Export', run: () => exportItemsCsv(project) },
      { id: 'export-recipes', label: 'Export recipes CSV', group: 'Export', run: () => exportRecipesCsv(project) },
    )

    for (const item of project.items) {
      list.push({
        id: `item-${item.id}`,
        label: `Calculate: ${item.name}`,
        group: 'Items',
        hint: item.kind,
        run: () => {
          setSelectedItemId(item.id)
          setModule('recipes')
        },
      })
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedItemId])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="brandmark">⚖</span>
          <div>
            <h1>Balance Sandbox</h1>
            <p>deterministic · offline</p>
          </div>
        </div>
        <nav className="sidebar__nav">
          {MODULES.map((entry) => (
            <button
              key={entry.id}
              className={`navlink${module === entry.id ? ' navlink--active' : ''}`}
              onClick={() => setModule(entry.id)}
            >
              <span className="navlink__glyph">{entry.glyph}</span>
              <span>{entry.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          <div className="sidebar__user">
            <span className="sidebar__avatar">{(user?.name ?? 'G').slice(0, 1).toUpperCase()}</span>
            <div className="sidebar__userinfo">
              <strong>{user?.name ?? 'Guest'}</strong>
              <span>{user?.guest ? 'Guest session' : 'Local profile'}</span>
            </div>
            <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={signOut}>
              ⏻
            </button>
          </div>
          <button className="palette-trigger" onClick={() => setPaletteOpen(true)}>
            <span>Command palette</span>
            <kbd>Ctrl K</kbd>
          </button>
          <p className="sidebar__save">{savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Autosaving…'}</p>
          <p className="sidebar__note">All data stays in this browser.</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__title">
            <input
              className="project-name"
              value={project.name}
              aria-label="Project name"
              onChange={(event) =>
                update((draft) => {
                  draft.name = event.target.value
                })
              }
            />
            <span className="topbar__crumb">{activeModule.title}</span>
          </div>
          <div className="topbar__meta">
            <span className="pill">{project.items.length} items</span>
            <span className="pill">{project.recipes.length} recipes</span>
            <InstallButton />
            <button className="btn btn--ghost btn--sm topbar__palette" onClick={() => setPaletteOpen(true)}>
              ⌘K
            </button>
          </div>
        </header>

        <div className="content">
          <div className="page-head">
            <h2>{activeModule.title}</h2>
            <p>{activeModule.subtitle}</p>
          </div>

          {module === 'recipes' ? (
            <RecipesPanel selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
          ) : null}
          {module === 'characters' ? <CharactersPanel onOpenEncounter={() => setModule('combat')} /> : null}
          {module === 'dice' ? <DicePanel /> : null}
          {module === 'advancement' ? <AdvancementPanel /> : null}
          {module === 'combat' ? <CombatPanel /> : null}
          {module === 'survival' ? <SurvivalPanel /> : null}
          {module === 'unlocks' ? <UnlocksPanel /> : null}
          {module === 'data' ? <DataPanel /> : null}
        </div>
      </main>

      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
