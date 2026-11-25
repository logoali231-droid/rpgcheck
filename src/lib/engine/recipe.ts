import type { CraftPlan, Project, Recipe, TreeNode } from '../types'

const MAX_DEPTH = 40

/** All recipes that produce a given item. */
export function recipesForItem(project: Project, itemId: string): Recipe[] {
  return project.recipes.filter((r) => r.outputItemId === itemId)
}

/**
 * Expands a target item into its full dependency tree and aggregates the exact
 * raw materials, craft counts and time needed.
 *
 * Craft batches are whole numbers: needing 3 of an item whose recipe yields 2
 * runs the recipe twice and reports the surplus.
 */
export function planCraft(
  project: Project,
  itemId: string,
  qty: number,
  choices: Record<string, string> = {},
): CraftPlan {
  const items = new Map(project.items.map((i) => [i.id, i]))
  const recipes = new Map(project.recipes.map((r) => [r.id, r]))
  const byOutput = new Map<string, Recipe[]>()
  for (const recipe of project.recipes) {
    const list = byOutput.get(recipe.outputItemId) ?? []
    list.push(recipe)
    byOutput.set(recipe.outputItemId, list)
  }

  const expand = (id: string, need: number, depth: number, path: string[]): TreeNode => {
    const item = items.get(id)
    const available = byOutput.get(id) ?? []
    const chosen = choices[id]
    const recipe = (chosen ? available.find((r) => r.id === chosen) : undefined) ?? available[0]
    const node: TreeNode = {
      key: `${path.join('/')}/${id}:${depth}`,
      itemId: id,
      name: item?.name ?? `Missing: ${id}`,
      unit: item?.unit ?? '',
      qty: need,
      recipesAvailable: available.length,
      crafts: 0,
      produced: 0,
      surplus: 0,
      children: [],
      isBase: !recipe,
      cycle: false,
      depth,
    }
    if (!recipe) return node
    if (path.includes(id) || depth >= MAX_DEPTH) {
      node.cycle = true
      return node
    }
    node.recipeId = recipe.id
    node.recipeName = recipe.name
    const crafts = Math.max(1, Math.ceil(need / Math.max(1, recipe.outputQty)))
    node.crafts = crafts
    node.produced = crafts * recipe.outputQty
    node.surplus = node.produced - need
    node.children = recipe.inputs
      .filter((ing) => ing.qty > 0)
      .map((ing) => expand(ing.itemId, ing.qty * crafts, depth + 1, [...path, id]))
    return node
  }

  const root = expand(itemId, Math.max(1, Math.round(qty)), 0, [])
  const baseMap = new Map<string, number>()
  const craftMap = new Map<string, number>()
  let totalSeconds = 0
  let hasCycle = false
  let maxDepthHit = false

  const walk = (node: TreeNode) => {
    if (node.cycle) {
      hasCycle = true
      if (node.depth >= MAX_DEPTH) maxDepthHit = true
      baseMap.set(node.itemId, (baseMap.get(node.itemId) ?? 0) + node.qty)
      return
    }
    if (node.recipeId && node.crafts > 0) {
      const recipe = recipes.get(node.recipeId)
      if (recipe) {
        craftMap.set(recipe.id, (craftMap.get(recipe.id) ?? 0) + node.crafts)
        totalSeconds += recipe.craftTimeSec * node.crafts
      }
    } else {
      baseMap.set(node.itemId, (baseMap.get(node.itemId) ?? 0) + node.qty)
    }
    node.children.forEach(walk)
  }
  walk(root)

  const baseResources = [...baseMap.entries()]
    .map(([id, amount]) => ({
      itemId: id,
      name: items.get(id)?.name ?? `Missing: ${id}`,
      unit: items.get(id)?.unit ?? '',
      qty: amount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const crafts = [...craftMap.entries()]
    .map(([id, count]) => {
      const recipe = recipes.get(id)!
      return {
        recipeId: id,
        name: recipe.name,
        outputName: items.get(recipe.outputItemId)?.name ?? recipe.outputItemId,
        count,
        seconds: recipe.craftTimeSec * count,
        difficulty: recipe.difficulty,
      }
    })
    .sort((a, b) => b.difficulty - a.difficulty || b.seconds - a.seconds)

  return {
    root,
    baseResources,
    crafts,
    totalSeconds,
    totalCrafts: crafts.reduce((sum, c) => sum + c.count, 0),
    maxDifficulty: crafts.reduce((max, c) => Math.max(max, c.difficulty), 0),
    hasCycle,
    maxDepthHit,
  }
}

/** Flat list of nodes in render order, for compact dependency tables. */
export function flattenTree(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
  out.push(node)
  node.children.forEach((child) => flattenTree(child, out))
  return out
}
