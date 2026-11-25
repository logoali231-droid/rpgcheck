import { useMemo, useState } from 'react'
import { useProject } from '../../store/project'
import { planCraft, recipesForItem } from '../../lib/engine/recipe'
import { successDistribution } from '../../lib/engine/dice'
import type { Project, TreeNode } from '../../lib/types'
import { fmtDuration, fmtNum, fmtPct, uid } from '../../lib/format'
import { copyText } from '../../lib/clipboard'
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  NumberInput,
  Select,
  Stat,
  TextInput,
} from '../ui'

function TreeRow({
  node,
  project,
  choices,
  onChoose,
}: {
  node: TreeNode
  project: Project
  choices: Record<string, string>
  onChoose: (itemId: string, recipeId: string) => void
}) {
  const options = recipesForItem(project, node.itemId)
  return (
    <div>
      <div className="tree__row" style={{ paddingLeft: `${node.depth * 16}px` }}>
        <span className="tree__qty">{fmtNum(node.qty)}×</span>
        <span className="tree__name">{node.name}</span>
        {node.recipeName ? (
          <span className="tree__meta">
            {node.recipeName} ×{node.crafts}
          </span>
        ) : (
          <Badge tone="raw">base</Badge>
        )}
        {node.surplus > 0 ? <Badge tone="info">+{fmtNum(node.surplus)} surplus</Badge> : null}
        {node.cycle ? <Badge tone="bad">cycle / depth limit</Badge> : null}
        {options.length > 1 ? (
          <select
            className="select select--sm tree__pick"
            aria-label={`Recipe for ${node.name}`}
            value={node.recipeId ?? ''}
            onChange={(event) => onChoose(node.itemId, event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {node.children.map((child) => (
        <TreeRow key={child.key} node={child} project={project} choices={choices} onChoose={onChoose} />
      ))}
    </div>
  )
}

export default function RecipesPanel({
  selectedItemId,
  onSelectItem,
}: {
  selectedItemId: string | null
  onSelectItem: (id: string) => void
}) {
  const { project, update } = useProject()
  const [search, setSearch] = useState('')
  const [amount, setAmount] = useState(10)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [craftPool, setCraftPool] = useState(5)

  const selected = project.items.find((item) => item.id === selectedItemId) ?? project.items[0]
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? project.items.filter((item) => item.name.toLowerCase().includes(query)) : project.items
  }, [project.items, search])

  const plan = useMemo(
    () => (selected ? planCraft(project, selected.id, Math.max(1, amount), choices) : null),
    [project, selected, amount, choices],
  )
  const craftOdds = useMemo(() => {
    if (!plan || !plan.maxDifficulty) return null
    const distribution = successDistribution(craftPool, project.dice.criticalSuccess)
    let success = 0
    let quality = 0
    for (const [value, probability] of distribution.dist) {
      if (value >= plan.maxDifficulty) success += probability
      if (value >= plan.maxDifficulty + 3) quality += probability
    }
    return { success, quality }
  }, [plan, craftPool, project.dice.criticalSuccess])

  const itemOptions = project.items.map((item) => ({ value: item.id, label: item.name }))
  const selectedRecipes = selected ? recipesForItem(project, selected.id) : []

  const addItem = () => {
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
    onSelectItem(id)
  }

  const deleteItem = (id: string) => {
    const item = project.items.find((entry) => entry.id === id)
    if (!item) return
    if (!window.confirm(`Delete “${item.name}” and every recipe, ingredient reference and unlock cost that uses it?`)) {
      return
    }
    update((draft) => {
      draft.items = draft.items.filter((entry) => entry.id !== id)
      draft.recipes = draft.recipes
        .filter((recipe) => recipe.outputItemId !== id)
        .map((recipe) => ({ ...recipe, inputs: recipe.inputs.filter((ing) => ing.itemId !== id) }))
      draft.achievements = draft.achievements.map((achievement) => ({
        ...achievement,
        itemCost: achievement.itemCost.filter((cost) => cost.itemId !== id),
      }))
      draft.survival.sources = draft.survival.sources.filter((source) => source.itemId !== id)
    })
    const next = project.items.find((entry) => entry.id !== id)
    onSelectItem(next?.id ?? '')
  }

  const addRecipe = () => {
    if (!selected) return
    const id = uid('recipe')
    update((draft) => {
      draft.recipes.push({
        id,
        name: `Craft ${selected.name}`,
        outputItemId: selected.id,
        outputQty: 1,
        inputs: [],
        craftTimeSec: 30,
        difficulty: 2,
        station: '',
        requires: [],
      })
    })
  }

  const addInput = (recipeId: string) => {
    update((draft) => {
      const recipe = draft.recipes.find((entry) => entry.id === recipeId)
      if (!recipe) return
      const used = new Set(recipe.inputs.map((ing) => ing.itemId))
      const candidate = draft.items.find((item) => !used.has(item.id))
      if (candidate) recipe.inputs.push({ itemId: candidate.id, qty: 1 })
    })
  }

  const copyPlan = async () => {
    if (!plan || !selected) return
    const lines = [
      `Plan: ${fmtNum(Math.max(1, amount))}× ${selected.name}`,
      `Crafts: ${plan.totalCrafts} · Time: ${fmtDuration(plan.totalSeconds)} · Highest difficulty: ${plan.maxDifficulty || '—'}`,
      '',
      'Base resources:',
      ...plan.baseResources.map((entry) => `  ${fmtNum(entry.qty)}${entry.unit ? ` ${entry.unit}` : ''} ${entry.name}`),
      '',
      'Craft steps:',
      ...plan.crafts.map((entry) => `  ${entry.count}× ${entry.name} → ${entry.outputName}`),
    ]
    setCopied(await copyText(lines.join('\n')))
    setTimeout(() => setCopied(false), 1600)
  }

  if (!project.items.length) {
    return (
      <Card title="No items yet" subtitle="Add your first raw material or crafted item to begin.">
        <Button variant="primary" onClick={addItem}>
          Add item
        </Button>
      </Card>
    )
  }

  return (
    <div className="layout-split">
      <div className="stack">
        <Card
          title="Items"
          subtitle={`${project.items.length} entries · click to edit and calculate`}
          actions={
            <Button variant="primary" small onClick={addItem}>
              + Item
            </Button>
          }
        >
          <input
            className="input"
            placeholder="Filter items…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Filter items"
          />
          <div className="list">
            {filteredItems.map((item) => {
              const recipeCount = recipesForItem(project, item.id).length
              return (
                <div
                  key={item.id}
                  className={`list__row${selected?.id === item.id ? ' list__row--active' : ''}`}
                >
                  <button className="list__main" onClick={() => onSelectItem(item.id)}>
                    <span className="list__name">{item.name}</span>
                    <span className="list__meta">
                      <Badge tone={item.kind === 'raw' ? 'raw' : 'crafted'}>{item.kind}</Badge>
                      {recipeCount ? <span>{recipeCount} recipe{recipeCount > 1 ? 's' : ''}</span> : null}
                      {item.nutrition > 0 ? <span>{item.nutrition} nutrition</span> : null}
                    </span>
                  </button>
                  <button
                    className="icon-btn"
                    title={`Delete ${item.name}`}
                    aria-label={`Delete ${item.name}`}
                    onClick={() => deleteItem(item.id)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
            {filteredItems.length === 0 ? <Empty>No items match “{search}”.</Empty> : null}
          </div>
        </Card>

        {selected ? (
          <>
            <Card title="Item definition" subtitle={selected.id}>
              <div className="field-grid">
                <Field label="Name" wide>
                  <TextInput
                    value={selected.name}
                    onChange={(value) =>
                      update((draft) => {
                        const item = draft.items.find((entry) => entry.id === selected.id)
                        if (item) item.name = value
                      })
                    }
                  />
                </Field>
                <Field label="Kind">
                  <Select
                    value={selected.kind}
                    options={[
                      { value: 'raw', label: 'Raw material' },
                      { value: 'crafted', label: 'Crafted' },
                    ]}
                    onChange={(value) =>
                      update((draft) => {
                        const item = draft.items.find((entry) => entry.id === selected.id)
                        if (item) item.kind = value === 'crafted' ? 'crafted' : 'raw'
                      })
                    }
                  />
                </Field>
                <Field label="Unit">
                  <TextInput
                    value={selected.unit}
                    onChange={(value) =>
                      update((draft) => {
                        const item = draft.items.find((entry) => entry.id === selected.id)
                        if (item) item.unit = value
                      })
                    }
                  />
                </Field>
                <Field label="Nutrition" hint="Used by the survival cycle.">
                  <NumberInput
                    value={selected.nutrition}
                    min={0}
                    onChange={(value) =>
                      update((draft) => {
                        const item = draft.items.find((entry) => entry.id === selected.id)
                        if (item) item.nutrition = Math.max(0, value)
                      })
                    }
                  />
                </Field>
              </div>
            </Card>

            <Card
              title="Recipes producing this item"
              subtitle="Add inputs to build the dependency graph."
              actions={
                <Button small variant="primary" onClick={addRecipe}>
                  + Recipe
                </Button>
              }
            >
              {selectedRecipes.length === 0 ? (
                <Empty>No recipe — this item is treated as a base resource.</Empty>
              ) : null}
              <div className="stack">
                {selectedRecipes.map((recipe) => (
                  <div key={recipe.id} className="recipe-card">
                    <div className="recipe-card__head">
                      <TextInput
                        value={recipe.name}
                        onChange={(value) =>
                          update((draft) => {
                            const entry = draft.recipes.find((r) => r.id === recipe.id)
                            if (entry) entry.name = value
                          })
                        }
                      />
                      <button
                        className="icon-btn"
                        title="Delete recipe"
                        aria-label={`Delete ${recipe.name}`}
                        onClick={() =>
                          update((draft) => {
                            draft.recipes = draft.recipes.filter((entry) => entry.id !== recipe.id)
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                    <div className="field-grid">
                      <Field label="Output qty">
                        <NumberInput
                          value={recipe.outputQty}
                          min={1}
                          onChange={(value) =>
                            update((draft) => {
                              const entry = draft.recipes.find((r) => r.id === recipe.id)
                              if (entry) entry.outputQty = Math.max(1, value)
                            })
                          }
                        />
                      </Field>
                      <Field label="Time" hint="seconds">
                        <NumberInput
                          value={recipe.craftTimeSec}
                          min={0}
                          onChange={(value) =>
                            update((draft) => {
                              const entry = draft.recipes.find((r) => r.id === recipe.id)
                              if (entry) entry.craftTimeSec = Math.max(0, value)
                            })
                          }
                        />
                      </Field>
                      <Field label="Difficulty" hint="Tecnologia test (2–5)">
                        <NumberInput
                          value={recipe.difficulty}
                          min={1}
                          max={6}
                          onChange={(value) =>
                            update((draft) => {
                              const entry = draft.recipes.find((r) => r.id === recipe.id)
                              if (entry) entry.difficulty = Math.min(6, Math.max(1, Math.round(value)))
                            })
                          }
                        />
                      </Field>
                      <Field label="Station">
                        <TextInput
                          value={recipe.station}
                          onChange={(value) =>
                            update((draft) => {
                              const entry = draft.recipes.find((r) => r.id === recipe.id)
                              if (entry) entry.station = value
                            })
                          }
                        />
                      </Field>
                    </div>

                    <div className="inputs">
                      <span className="field__label">Inputs</span>
                      {recipe.inputs.length === 0 ? <p className="hint">No inputs — produces from nothing.</p> : null}
                      {recipe.inputs.map((input, index) => (
                        <div key={`${recipe.id}-${index}`} className="inputs__row">
                          <Select
                            value={input.itemId}
                            options={itemOptions}
                            small
                            onChange={(value) =>
                              update((draft) => {
                                const entry = draft.recipes.find((r) => r.id === recipe.id)
                                if (entry && entry.inputs[index]) entry.inputs[index].itemId = value
                              })
                            }
                          />
                          <NumberInput
                            value={input.qty}
                            min={1}
                            onChange={(value) =>
                              update((draft) => {
                                const entry = draft.recipes.find((r) => r.id === recipe.id)
                                if (entry && entry.inputs[index]) entry.inputs[index].qty = Math.max(1, value)
                              })
                            }
                          />
                          <button
                            className="icon-btn"
                            title="Remove input"
                            aria-label="Remove input"
                            onClick={() =>
                              update((draft) => {
                                const entry = draft.recipes.find((r) => r.id === recipe.id)
                                if (entry) entry.inputs.splice(index, 1)
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <Button small onClick={() => addInput(recipe.id)}>
                        + Ingredient
                      </Button>
                    </div>

                    {project.achievements.length ? (
                      <div className="chips">
                        <span className="field__label">Locked behind</span>
                        {project.achievements.map((achievement) => {
                          const active = recipe.requires.includes(achievement.id)
                          return (
                            <button
                              key={achievement.id}
                              className={`chip${active ? ' chip--active' : ''}`}
                              onClick={() =>
                                update((draft) => {
                                  const entry = draft.recipes.find((r) => r.id === recipe.id)
                                  if (!entry) return
                                  entry.requires = active
                                    ? entry.requires.filter((id) => id !== achievement.id)
                                    : [...entry.requires, achievement.id]
                                })
                              }
                            >
                              {achievement.name}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </>
        ) : null}
      </div>

      <div className="stack">
        <Card
          title="Reverse recipe calculator"
          subtitle="Exact base materials for a target quantity."
          actions={
            <Button small onClick={copyPlan} disabled={!plan}>
              {copied ? 'Copied ✓' : 'Copy plan'}
            </Button>
          }
        >
          <div className="target-row">
            <Select
              value={selected?.id ?? ''}
              options={itemOptions}
              onChange={onSelectItem}
              ariaLabel="Target item"
            />
            <NumberInput
              value={amount}
              min={1}
              onChange={(value) => setAmount(Math.max(1, Math.round(value)))}
              suffix="×"
              ariaLabel="Target quantity"
            />
            {[1, 10, 100, 1000].map((preset) => (
              <Button key={preset} small variant={amount === preset ? 'primary' : 'subtle'} onClick={() => setAmount(preset)}>
                {preset}
              </Button>
            ))}
          </div>

          {plan ? (
            <>
              <div className="stats">
                <Stat label="Craft actions" value={fmtNum(plan.totalCrafts)} sub={`${plan.crafts.length} distinct recipes`} />
                <Stat label="Total time" value={fmtDuration(plan.totalSeconds)} sub="sequential crafting" />
                <Stat label="Highest difficulty" value={plan.maxDifficulty || '—'} sub="crafting test" />
                <Stat
                  label="Base resources"
                  value={fmtNum(plan.baseResources.reduce((sum, entry) => sum + entry.qty, 0))}
                  sub={`${plan.baseResources.length} raw types`}
                />
              </div>

              <div className="craft-check">
                <div className="field">
                  <span className="field__label">Crafting test · pool = Mente + Tecnologia</span>
                  <div className="inline-form">
                    <span className="inline-num">
                      <NumberInput
                        value={craftPool}
                        min={1}
                        max={20}
                        onChange={(value) => setCraftPool(Math.max(1, Math.round(value)))}
                      />
                    </span>
                    <span className="hint">
                      Success <strong>{craftOdds ? fmtPct(craftOdds.success, 1) : '—'}</strong> · 3+ excess (quality){' '}
                      <strong>{craftOdds ? fmtPct(craftOdds.quality, 1) : '—'}</strong>
                    </span>
                  </div>
                </div>
                <p className="hint">Crafting uses Tecnologia vs Difficulty 2–5; three excess successes add +1 quality.</p>
              </div>

              {plan.hasCycle ? (
                <p className="callout callout--bad">
                  {plan.maxDepthHit
                    ? 'Depth limit reached — the recipe chain is deeper than 40 levels.'
                    : 'A recipe cycle was detected. Cyclic ingredients are counted as unmet base resources.'}
                </p>
              ) : null}

              <div className="split-2">
                <div>
                  <h4 className="subhead">Base resources</h4>
                  {plan.baseResources.length === 0 ? (
                    <Empty>This item is produced from nothing.</Empty>
                  ) : (
                    <div className="table-wrap">
                      <table className="table table--compact">
                        <thead>
                          <tr>
                            <th>Resource</th>
                            <th className="right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.baseResources.map((entry) => (
                            <tr key={entry.itemId}>
                              <td>{entry.name}</td>
                              <td className="right mono">
                                {fmtNum(entry.qty)} {entry.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="subhead">Craft plan</h4>
                  {plan.crafts.length === 0 ? (
                    <Empty>No crafting steps.</Empty>
                  ) : (
                    <div className="table-wrap">
                      <table className="table table--compact">
                        <thead>
                          <tr>
                            <th>Recipe</th>
                            <th className="right">Runs</th>
                            <th className="right">Time</th>
                            <th className="right">Difficulty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.crafts.map((entry) => (
                            <tr key={entry.recipeId}>
                              <td>
                                {entry.name}
                                <span className="muted"> → {entry.outputName}</span>
                              </td>
                              <td className="right mono">{fmtNum(entry.count)}</td>
                              <td className="right mono">{fmtDuration(entry.seconds)}</td>
                              <td className="right mono">{entry.difficulty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <h4 className="subhead">
                Dependency tree{' '}
                {Object.keys(choices).length ? (
                  <Button small variant="subtle" onClick={() => setChoices({})}>
                    Reset recipe choices
                  </Button>
                ) : null}
              </h4>
              <div className="tree">
                <TreeRow
                  node={plan.root}
                  project={project}
                  choices={choices}
                  onChoose={(itemId, recipeId) => setChoices((current) => ({ ...current, [itemId]: recipeId }))}
                />
              </div>

              <p className="hint">
                Batch rounding is exact: needing 3 of an item made 2 at a time runs the recipe twice and reports surplus.
              </p>
            </>
          ) : <Empty>Select a target item.</Empty>}
        </Card>
      </div>
    </div>
  )
}
