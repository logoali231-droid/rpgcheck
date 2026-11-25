import type { Achievement, Item, Project, Recipe } from '../types'

export interface FieldChange {
  field: string
  before: string
  after: string
}

export interface EntityChange {
  id: string
  name: string
  fields: FieldChange[]
}

export interface EntityDiff {
  added: EntityChange[]
  removed: EntityChange[]
  changed: EntityChange[]
}

export interface ProjectDiff {
  items: EntityDiff
  recipes: EntityDiff
  achievements: EntityDiff
  totals: { items: number; recipes: number; achievements: number }
}

function ingredientSummary(inputs: { itemId: string; qty: number }[], nameOf: (id: string) => string): string {
  if (!inputs.length) return '—'
  return inputs.map((i) => `${nameOf(i.itemId)}×${i.qty}`).join(', ')
}

function emptyDiff(): EntityDiff {
  return { added: [], removed: [], changed: [] }
}

function compare<T extends { id: string; name: string }>(
  before: T[],
  after: T[],
  fields: (entity: T, nameOf: (id: string) => string) => Record<string, string | number>,
): EntityDiff {
  const diff = emptyDiff()
  const beforeMap = new Map(before.map((e) => [e.id, e]))
  const afterMap = new Map(after.map((e) => [e.id, e]))
  const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()])
  const nameOf = (id: string) =>
    afterMap.get(id)?.name ?? beforeMap.get(id)?.name ?? before.find((e) => e.name === id)?.name ?? id

  for (const id of allIds) {
    const a = beforeMap.get(id)
    const b = afterMap.get(id)
    if (!a && b) {
      diff.added.push({ id, name: b.name, fields: [] })
      continue
    }
    if (a && !b) {
      diff.removed.push({ id, name: a.name, fields: [] })
      continue
    }
    if (!a || !b) continue
    const beforeFields = fields(a, nameOf)
    const afterFields = fields(b, nameOf)
    const changes: FieldChange[] = []
    for (const key of Object.keys(afterFields)) {
      const beforeValue = String(beforeFields[key] ?? '—')
      const afterValue = String(afterFields[key] ?? '—')
      if (beforeValue !== afterValue) changes.push({ field: key, before: beforeValue, after: afterValue })
    }
    if (changes.length) diff.changed.push({ id, name: b.name, fields: changes })
  }
  const sortByName = (list: EntityChange[]) => list.sort((x, y) => x.name.localeCompare(y.name))
  sortByName(diff.added)
  sortByName(diff.removed)
  sortByName(diff.changed)
  return diff
}

const itemFields = (item: Item): Record<string, string | number> => ({
  kind: item.kind,
  unit: item.unit || '—',
  nutrition: item.nutrition,
})

const recipeFields = (recipe: Recipe, nameOf: (id: string) => string): Record<string, string | number> => ({
  output: nameOf(recipe.outputItemId),
  outputQty: recipe.outputQty,
  inputs: ingredientSummary(recipe.inputs, nameOf),
  time: recipe.craftTimeSec,
  difficulty: recipe.difficulty,
  station: recipe.station || '—',
  gatedBy: recipe.requires.length ? recipe.requires.join(', ') : '—',
})

const achievementFields = (achievement: Achievement, nameOf: (id: string) => string): Record<string, string | number> => ({
  requires: achievement.requires.length ? achievement.requires.map(nameOf).join(', ') : '—',
  itemCost: ingredientSummary(achievement.itemCost, nameOf),
})

/** Field-level comparison of two project versions, keyed by entity id. */
export function diffProjects(before: Project, after: Project): ProjectDiff {
  return {
    items: compare(before.items, after.items, itemFields),
    recipes: compare(before.recipes, after.recipes, recipeFields),
    achievements: compare(before.achievements, after.achievements, achievementFields),
    totals: {
      items: after.items.length - before.items.length,
      recipes: after.recipes.length - before.recipes.length,
      achievements: after.achievements.length - before.achievements.length,
    },
  }
}
