import type { Achievement, Item, Project, Recipe } from '../types'

function snbtString(value: string): string {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function snbtNumber(value: number, suffix = 'd'): string {
  if (!Number.isFinite(value)) return `0${suffix}`
  return Number.isInteger(value) ? `${value}${suffix}` : `${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}${suffix}`
}

function itemTag(item: Item): string {
  return [
    `{Id:${snbtString(item.id)}`,
    `Name:${snbtString(item.name)}`,
    `Kind:${snbtString(item.kind)}`,
    `Unit:${snbtString(item.unit)}`,
    `Nutrition:${snbtNumber(item.nutrition)}`,
    `Notes:${snbtString(item.notes)}}`,
  ].join(',')
}

function ingredientTag(ing: { itemId: string; qty: number }): string {
  return `{Item:${snbtString(ing.itemId)},Count:${Math.round(ing.qty)}b}`
}

function recipeTag(recipe: Recipe): string {
  return [
    `{Id:${snbtString(recipe.id)}`,
    `Name:${snbtString(recipe.name)}`,
    `Output:${snbtString(recipe.outputItemId)}`,
    `OutputQty:${Math.round(recipe.outputQty)}b`,
    `Inputs:[${recipe.inputs.map(ingredientTag).join(',')}]`,
    `CraftTime:${snbtNumber(recipe.craftTimeSec)}`,
    `Difficulty:${Math.round(recipe.difficulty)}b`,
    `Station:${snbtString(recipe.station)}`,
    `Requires:[${recipe.requires.map(snbtString).join(',')}]}`,
  ].join(',')
}

function achievementTag(achievement: Achievement): string {
  return [
    `{Id:${snbtString(achievement.id)}`,
    `Name:${snbtString(achievement.name)}`,
    `Requires:[${achievement.requires.map(snbtString).join(',')}]`,
    `ItemCost:[${achievement.itemCost.map(ingredientTag).join(',')}]}`,
  ].join(',')
}

/** Full project export in SNBT (Minecraft-style NBT text) form. */
export function projectToSnbt(project: Project): string {
  return [
    '{',
    `  Name:${snbtString(project.name)},`,
    `  Version:${project.version}b,`,
    `  Items:[`,
    ...project.items.map((item, i) => `    ${itemTag(item)}${i < project.items.length - 1 ? ',' : ''}`),
    '  ],',
    '  Recipes:[',
    ...project.recipes.map((recipe, i) => `    ${recipeTag(recipe)}${i < project.recipes.length - 1 ? ',' : ''}`),
    '  ],',
    '  Achievements:[',
    ...project.achievements.map(
      (achievement, i) => `    ${achievementTag(achievement)}${i < project.achievements.length - 1 ? ',' : ''}`,
    ),
    '  ]',
    '}',
  ].join('\n')
}

/** Questbook-style export: unlock gates and their item requirements. */
export function questbookToSnbt(project: Project): string {
  const lines: string[] = ['{', `  Questbook:${snbtString(project.name)},`, '  Chapters:[']
  project.achievements.forEach((achievement, index) => {
    const gateRecipes = project.recipes.filter((r) => r.requires.includes(achievement.id))
    const chapter = [
      '    {',
      `      Id:${snbtString(achievement.id)},`,
      `      Title:${snbtString(achievement.name)},`,
      `      Requires:[${achievement.requires.map(snbtString).join(',')}],`,
      `      Deliver:[${achievement.itemCost.map(ingredientTag).join(',')}],`,
      `      UnlocksRecipes:[${gateRecipes.map((r) => snbtString(r.id)).join(',')}]`,
      '    }' + (index < project.achievements.length - 1 ? ',' : ''),
    ].join('\n')
    lines.push(chapter)
  })
  lines.push('  ]', '}')
  return lines.join('\n')
}

/** Items + recipes as spreadsheet-friendly CSV. */
export function projectToItemsCsv(project: Project): string {
  const header = ['id', 'name', 'kind', 'unit', 'nutrition', 'notes']
  const rows = project.items.map((i) => [i.id, i.name, i.kind, i.unit, i.nutrition, i.notes])
  return toCsvLocal([header, ...rows])
}

export function projectToRecipesCsv(project: Project): string {
  const names = new Map(project.items.map((i) => [i.id, i.name]))
  const header = ['id', 'name', 'output', 'outputQty', 'inputs', 'time', 'difficulty', 'station', 'requires']
  const rows = project.recipes.map((r) => [
    r.id,
    r.name,
    names.get(r.outputItemId) ?? r.outputItemId,
    r.outputQty,
    r.inputs.map((i) => `${names.get(i.itemId) ?? i.itemId}:${i.qty}`).join(';'),
    r.craftTimeSec,
    r.difficulty,
    r.station,
    r.requires.join(';'),
  ])
  return toCsvLocal([header, ...rows])
}

function toCsvLocal(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(','),
    )
    .join('\n')
}
