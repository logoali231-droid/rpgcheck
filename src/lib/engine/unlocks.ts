import type { Project } from '../types'

export interface BlockedEntry {
  id: string
  name: string
  reasons: string[]
}

export interface UnlockAnalysis {
  availableItems: string[]
  unlocked: string[]
  blockedAchievements: BlockedEntry[]
  blockedRecipes: BlockedEntry[]
  cycles: string[][]
  order: { kind: 'achievement' | 'recipe'; id: string; name: string; ok: boolean }[]
  softlockRisk: boolean
}

const MAX_PASSES = 200

/** Finds cycles in the achievement prerequisite graph. */
function findAchievementCycles(project: Project): string[][] {
  const byId = new Map(project.achievements.map((a) => [a.id, a]))
  const state = new Map<string, number>() // 0 = new, 1 = visiting, 2 = done
  const stack: string[] = []
  const cycles: string[][] = []

  const visit = (id: string) => {
    if (state.get(id) === 2) return
    if (state.get(id) === 1) {
      const at = stack.indexOf(id)
      if (at >= 0) cycles.push([...stack.slice(at), id])
      return
    }
    const achievement = byId.get(id)
    if (!achievement) return
    state.set(id, 1)
    stack.push(id)
    for (const req of achievement.requires) visit(req)
    stack.pop()
    state.set(id, 2)
  }

  project.achievements.forEach((a) => visit(a.id))
  return cycles
}

/**
 * Reachability fixpoint: raw items are available from the start, a recipe
 * becomes craftable once its required achievements are unlocked and all of its
 * inputs are available, and an achievement unlocks once its prerequisites and
 * item costs are met. Anything left over is a potential softlock.
 */
export function analyzeUnlocks(project: Project): UnlockAnalysis {
  const itemsById = new Map(project.items.map((i) => [i.id, i]))
  const achievementsById = new Map(project.achievements.map((a) => [a.id, a]))
  const available = new Set(project.items.filter((i) => i.kind === 'raw').map((i) => i.id))
  const unlocked = new Set<string>()
  const recipeUnlockedAt = new Map<string, number>()

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false
    for (const achievement of project.achievements) {
      if (unlocked.has(achievement.id)) continue
      const prereqsMet = achievement.requires.every((id) => unlocked.has(id))
      const costMet = achievement.itemCost.every((c) => available.has(c.itemId))
      if (prereqsMet && costMet) {
        unlocked.add(achievement.id)
        changed = true
      }
    }
    for (const recipe of project.recipes) {
      if (available.has(recipe.outputItemId) || recipeUnlockedAt.has(recipe.id)) continue
      const gateMet = recipe.requires.every((id) => unlocked.has(id))
      const inputsMet = recipe.inputs.every((i) => available.has(i.itemId))
      if (gateMet && inputsMet) {
        available.add(recipe.outputItemId)
        recipeUnlockedAt.set(recipe.id, pass)
        changed = true
      }
    }
    if (!changed) break
  }

  const blockedAchievements: BlockedEntry[] = project.achievements
    .filter((a) => !unlocked.has(a.id))
    .map((a) => {
      const reasons: string[] = []
      for (const req of a.requires) {
        if (!unlocked.has(req)) {
          reasons.push(`Needs achievement “${achievementsById.get(req)?.name ?? req}”`)
        }
      }
      for (const cost of a.itemCost) {
        if (!available.has(cost.itemId)) {
          reasons.push(`Needs ${cost.qty}× ${itemsById.get(cost.itemId)?.name ?? cost.itemId}, which cannot be produced`)
        }
      }
      if (!reasons.length) reasons.push('Unreachable for an unknown reason')
      return { id: a.id, name: a.name, reasons }
    })

  const blockedRecipes: BlockedEntry[] = project.recipes
    .filter((r) => !available.has(r.outputItemId))
    .map((r) => {
      const reasons: string[] = []
      for (const req of r.requires) {
        if (!unlocked.has(req)) {
          reasons.push(`Locked behind “${achievementsById.get(req)?.name ?? req}”`)
        }
      }
      for (const input of r.inputs) {
        if (!available.has(input.itemId)) {
          reasons.push(`Ingredient missing: ${itemsById.get(input.itemId)?.name ?? input.itemId}`)
        }
      }
      if (!reasons.length) reasons.push('No reachable production path')
      return { id: r.id, name: r.name, reasons }
    })

  const cycles = findAchievementCycles(project)
  const order: UnlockAnalysis['order'] = []
  for (const achievement of project.achievements) {
    order.push({
      kind: 'achievement',
      id: achievement.id,
      name: achievement.name,
      ok: unlocked.has(achievement.id),
    })
  }
  for (const recipe of project.recipes) {
    if (!recipe.requires.length) continue
    order.push({
      kind: 'recipe',
      id: recipe.id,
      name: recipe.name,
      ok: available.has(recipe.outputItemId),
    })
  }

  return {
    availableItems: [...available],
    unlocked: [...unlocked],
    blockedAchievements,
    blockedRecipes,
    cycles,
    order,
    softlockRisk: blockedAchievements.length > 0 || blockedRecipes.length > 0 || cycles.length > 0,
  }
}
