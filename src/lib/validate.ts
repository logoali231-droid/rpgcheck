import type {
  Achievement,
  AdvancementConfig,
  Archetype,
  CharacterSheet,
  Combatant,
  CombatConfig,
  DerivedFormula,
  DiceConfig,
  EncounterKind,
  Item,
  ItemKind,
  Project,
  Recipe,
  SurvivalConfig,
  TrickId,
  Zone,
} from './types'
import { sampleProject } from './sample'
import { clamp } from './format'
import { ARCHETYPES, SKILLS, TRICKS, ZONES } from './pulso'
import { DEFAULT_FORMULAS } from './engine/formula'

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeItem(raw: any, index: number): Item {
  const kind: ItemKind = raw?.kind === 'crafted' ? 'crafted' : 'raw'
  return {
    id: str(raw?.id) || `item_${index}`,
    name: str(raw?.name) || `Item ${index + 1}`,
    kind,
    unit: str(raw?.unit),
    nutrition: Math.max(0, num(raw?.nutrition)),
    notes: str(raw?.notes),
  }
}

function normalizeIngredient(raw: any): { itemId: string; qty: number } | null {
  const itemId = str(raw?.itemId ?? raw?.item ?? raw?.id)
  if (!itemId) return null
  return { itemId, qty: Math.max(1, Math.round(num(raw?.qty ?? raw?.amount, 1))) }
}

function normalizeRecipe(raw: any, index: number): Recipe {
  const inputs = Array.isArray(raw?.inputs)
    ? (raw.inputs.map(normalizeIngredient).filter(Boolean) as { itemId: string; qty: number }[])
    : []
  return {
    id: str(raw?.id) || `recipe_${index}`,
    name: str(raw?.name) || `Recipe ${index + 1}`,
    outputItemId: str(raw?.outputItemId ?? raw?.output),
    outputQty: Math.max(1, num(raw?.outputQty, 1)),
    inputs,
    craftTimeSec: Math.max(0, num(raw?.craftTimeSec ?? raw?.time)),
    difficulty: clamp(Math.round(num(raw?.difficulty, 2)), 1, 6),
    station: str(raw?.station),
    requires: Array.isArray(raw?.requires) ? raw.requires.filter((r: unknown) => typeof r === 'string') : [],
  }
}

function normalizeAchievement(raw: any, index: number): Achievement {
  const itemCost = Array.isArray(raw?.itemCost)
    ? (raw.itemCost.map(normalizeIngredient).filter(Boolean) as { itemId: string; qty: number }[])
    : []
  return {
    id: str(raw?.id) || `ach_${index}`,
    name: str(raw?.name) || `Achievement ${index + 1}`,
    requires: Array.isArray(raw?.requires) ? raw.requires.filter((r: unknown) => typeof r === 'string') : [],
    itemCost,
  }
}

function normalizeDice(raw: any, base: DiceConfig): DiceConfig {
  return {
    pool: clamp(Math.round(num(raw?.pool ?? raw?.count, base.pool)), 1, 20),
    threshold: clamp(Math.round(num(raw?.threshold ?? raw?.successThreshold, base.threshold)), 2, 6),
    difficulty: clamp(Math.round(num(raw?.difficulty, base.difficulty)), 0, 12),
    criticalSuccess: bool(raw?.criticalSuccess, base.criticalSuccess),
    partialSuccess: bool(raw?.partialSuccess, base.partialSuccess),
    bonusSuccesses: Math.round(num(raw?.bonusSuccesses, base.bonusSuccesses)),
    penaltyDice: clamp(Math.round(num(raw?.penaltyDice, base.penaltyDice)), 0, 20),
    opposed: bool(raw?.opposed, base.opposed),
    opposedPool: clamp(Math.round(num(raw?.opposedPool, base.opposedPool)), 1, 20),
  }
}

function normalizeAdvancement(raw: any, base: AdvancementConfig): AdvancementConfig {
  const entries = Array.isArray(raw?.entries)
    ? raw.entries
        .filter((entry: any) => typeof entry?.name === 'string')
        .map((entry: any, index: number) => ({
          id: str(entry.id) || `adv_${index}`,
          name: entry.name as string,
          cost: Math.max(0, Math.round(num(entry.cost, 2))),
          qty: Math.max(0, Math.round(num(entry.qty, 1))),
        }))
    : base.entries
  return {
    xpPerSession: clamp(Math.round(num(raw?.xpPerSession, base.xpPerSession)), 1, 20),
    bonusXpPerSession: clamp(Math.round(num(raw?.bonusXpPerSession, base.bonusXpPerSession)), 0, 20),
    entries,
  }
}

const VALID_ZONES = new Set<Zone>(ZONES.map((zone) => zone.id))
const VALID_TRICKS = new Set<TrickId>(TRICKS.map((trick) => trick.id))
const VALID_ARCHETYPES = new Set<Archetype>(Object.keys(ARCHETYPES) as Archetype[])

function normalizeCombatant(raw: any, index: number): Combatant {
  const side = raw?.side === 'foe' ? 'foe' : 'ally'
  const zone: Zone = VALID_ZONES.has(raw?.zone) ? raw.zone : 'melee'
  const tricks = Array.isArray(raw?.tricks)
    ? raw.tricks.filter((trick: unknown): trick is TrickId => VALID_TRICKS.has(trick as TrickId))
    : []
  const archetype: Archetype | undefined = VALID_ARCHETYPES.has(raw?.archetype) ? raw.archetype : undefined
  return {
    id: str(raw?.id) || `combatant_${index}`,
    name: str(raw?.name) || `Combatant ${index + 1}`,
    side,
    pool: clamp(Math.round(num(raw?.pool, 3)), 1, 20),
    defense: clamp(Math.round(num(raw?.defense, 2)), 0, 10),
    vitalityMax: clamp(Math.round(num(raw?.vitalityMax ?? raw?.hp, 9)), 1, 200),
    reduction: clamp(Math.round(num(raw?.reduction, 0)), 0, 10),
    damage: clamp(Math.round(num(raw?.damage, 2)), 0, 20),
    initiative: clamp(Math.round(num(raw?.initiative, 3)), 0, 20),
    actionsPerTurn: clamp(Math.round(num(raw?.actionsPerTurn, 1)), 1, 5),
    zone,
    tricks,
    archetype,
    threat: Math.max(0, num(raw?.threat, archetype ? ARCHETYPES[archetype].threat : 0)),
    sheetId: typeof raw?.sheetId === 'string' && raw.sheetId ? raw.sheetId : undefined,
  }
}

function normalizeCombat(raw: any, base: CombatConfig): CombatConfig {
  const combatants = Array.isArray(raw?.combatants)
    ? raw.combatants.map(normalizeCombatant)
    : base.combatants
  const meta = raw?.meta ?? {}
  const kind: EncounterKind = ['combat', 'pursuit', 'negotiation', 'exploration', 'puzzle'].includes(meta.kind)
    ? meta.kind
    : base.meta.kind
  const startZone: Zone = VALID_ZONES.has(meta.startZone) ? meta.startZone : base.meta.startZone
  return {
    iterations: clamp(Math.round(num(raw?.iterations, base.iterations)), 10, 20000),
    maxRounds: clamp(Math.round(num(raw?.maxRounds, base.maxRounds)), 1, 100),
    seed: Math.round(num(raw?.seed, base.seed)),
    criticalSuccess: bool(raw?.criticalSuccess, base.criticalSuccess),
    finishDowned: bool(raw?.finishDowned, base.finishDowned),
    meta: {
      title: str(meta.title, base.meta.title),
      kind,
      objective: str(meta.objective, base.meta.objective),
      obstacle: str(meta.obstacle, base.meta.obstacle),
      consequence: str(meta.consequence, base.meta.consequence),
      complication: str(meta.complication, base.meta.complication),
      startZone,
    },
    combatants,
  }
}

function normalizeFormulas(raw: any, base: DerivedFormula[]): DerivedFormula[] {
  const incoming: DerivedFormula[] = Array.isArray(raw)
    ? raw
        .filter((entry: any) => typeof entry?.id === 'string' && typeof entry?.expression === 'string')
        .map((entry: any) => ({
          id: String(entry.id).replace(/[^A-Za-z0-9_]/g, '_'),
          label: str(entry.label) || String(entry.id),
          expression: String(entry.expression),
          builtin: bool(entry.builtin, false),
        }))
    : []
  const byId = new Map(incoming.map((formula) => [formula.id, formula]))
  const merged = base.map((formula) => {
    const override = byId.get(formula.id)
    return override
      ? { ...formula, label: override.label, expression: override.expression }
      : { ...formula }
  })
  const extras = incoming.filter(
    (formula) => !base.some((builtin) => builtin.id === formula.id) && !formula.builtin,
  )
  return [...merged, ...extras]
}

function normalizeCharacter(raw: any, index: number): CharacterSheet {
  const skills: Record<string, number> = {}
  for (const skill of SKILLS) {
    skills[skill.id] = clamp(Math.round(num(raw?.skills?.[skill.id], 0)), 0, 5)
  }
  const specializations = Array.isArray(raw?.specializations)
    ? raw.specializations
        .filter((entry: any) => typeof entry?.skillId === 'string' && typeof entry?.name === 'string')
        .map((entry: any, specIndex: number) => ({
          id: str(entry.id) || `spec_${index}_${specIndex}`,
          skillId: entry.skillId as string,
          name: entry.name as string,
        }))
    : []
  const bonds = Array.isArray(raw?.bonds)
    ? raw.bonds
        .filter((entry: any) => typeof entry?.name === 'string')
        .map((entry: any, bondIndex: number) => ({
          id: str(entry.id) || `bond_${index}_${bondIndex}`,
          name: entry.name as string,
          value: clamp(Math.round(num(entry.value, 0)), 0, 3),
          note: str(entry.note),
        }))
    : []

  return {
    id: str(raw?.id) || `character_${index}`,
    name: str(raw?.name) || `Character ${index + 1}`,
    concept: str(raw?.concept),
    scenario: str(raw?.scenario),
    wealth: clamp(Math.round(num(raw?.wealth, 2)), 0, 4),
    modules: {
      magic: bool(raw?.modules?.magic),
      cyber: bool(raw?.modules?.cyber),
      sanity: bool(raw?.modules?.sanity),
      bonds: bool(raw?.modules?.bonds),
      base: bool(raw?.modules?.base),
    },
    attributes: {
      corpo: clamp(Math.round(num(raw?.attributes?.corpo, 2)), 1, 5),
      agilidade: clamp(Math.round(num(raw?.attributes?.agilidade, 2)), 1, 5),
      mente: clamp(Math.round(num(raw?.attributes?.mente, 2)), 1, 5),
      presenca: clamp(Math.round(num(raw?.attributes?.presenca, 2)), 1, 5),
    },
    skills,
    saberArea: str(raw?.saberArea),
    specializations,
    currentVitality: clamp(Math.round(num(raw?.currentVitality, 10)), 0, 999),
    fatigue: clamp(Math.round(num(raw?.fatigue, 0)), 0, 3),
    stress: clamp(Math.round(num(raw?.stress, 0)), 0, 5),
    conditions: {
      unconscious: bool(raw?.conditions?.unconscious),
      stabilized: bool(raw?.conditions?.stabilized),
      overloaded: bool(raw?.conditions?.overloaded),
    },
    weapon: {
      name: str(raw?.weapon?.name, 'Unarmed'),
      damage: clamp(Math.round(num(raw?.weapon?.damage, 1)), 0, 20),
      zone: VALID_ZONES.has(raw?.weapon?.zone) ? raw.weapon.zone : 'melee',
    },
    armor: {
      name: str(raw?.armor?.name, 'None'),
      reduction: clamp(Math.round(num(raw?.armor?.reduction, 0)), 0, 10),
    },
    kit: str(raw?.kit),
    otherGear: str(raw?.otherGear),
    load: {
      weapon: Math.max(0, num(raw?.load?.weapon, 1)),
      armor: Math.max(0, num(raw?.load?.armor, 1)),
      kit: Math.max(0, num(raw?.load?.kit, 0)),
      other: Math.max(0, num(raw?.load?.other, 0)),
    },
    advantages: Array.isArray(raw?.advantages) ? raw.advantages.filter((x: unknown) => typeof x === 'string') : [],
    disadvantages: Array.isArray(raw?.disadvantages) ? raw.disadvantages.filter((x: unknown) => typeof x === 'string') : [],
    tempWealth: clamp(Math.round(num(raw?.tempWealth, 0)), 0, 4),
    leverage: str(raw?.leverage),
    contracts: str(raw?.contracts),
    mysticLevel: clamp(Math.round(num(raw?.mysticLevel, 0)), 0, 5),
    implantsUsed: clamp(Math.round(num(raw?.implantsUsed, 0)), 0, 10),
    bonds,
    baseLevel: clamp(Math.round(num(raw?.baseLevel, 0)), 0, 3),
    domainLevel: clamp(Math.round(num(raw?.domainLevel, 0)), 0, 4),
    foodReserve: clamp(Math.round(num(raw?.foodReserve, 0)), 0, 4),
    notes: str(raw?.notes),
  }
}

function normalizeSurvival(raw: any, base: SurvivalConfig): SurvivalConfig {
  const sources = Array.isArray(raw?.sources)
    ? raw.sources
        .filter((s: any) => typeof s?.itemId === 'string')
        .map((s: any) => ({
          itemId: s.itemId as string,
          gatherMinutes: Math.max(0, num(s.gatherMinutes, 10)),
          stock: Math.max(0, Math.round(num(s.stock, 0))),
        }))
    : base.sources
  return {
    days: clamp(Math.round(num(raw?.days, base.days)), 1, 365),
    dayMinutes: clamp(num(raw?.dayMinutes, base.dayMinutes), 60, 1440),
    workMinutes: clamp(num(raw?.workMinutes, base.workMinutes), 0, 1440),
    startHealth: clamp(num(raw?.startHealth, base.startHealth), 1, 100000),
    hungerPerDay: Math.max(1, num(raw?.hungerPerDay, base.hungerPerDay)),
    hungerGrowthPct: num(raw?.hungerGrowthPct, base.hungerGrowthPct),
    healthLossPerMissingNutrition: Math.max(0, num(raw?.healthLossPerMissingNutrition, base.healthLossPerMissingNutrition)),
    fatiguePerHour: Math.max(0, num(raw?.fatiguePerHour, base.fatiguePerHour)),
    sources,
  }
}

/**
 * Coerces arbitrarily shaped imported JSON (including v1 projects) into a valid
 * Pulso d6 project. Unknown fields are dropped and invalid rows repaired.
 */
export function sanitizeProject(raw: unknown): Project {
  const base = sampleProject()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as any
  const items = Array.isArray(r.items) ? r.items.map(normalizeItem) : base.items
  const ids = new Set(items.map((i: Item) => i.id))
  const recipes = Array.isArray(r.recipes) ? r.recipes.map(normalizeRecipe) : base.recipes
  const achievements = Array.isArray(r.achievements)
    ? r.achievements.map(normalizeAchievement)
    : base.achievements
  return {
    version: 3,
    name: str(r.name) || base.name,
    items,
    recipes: recipes.filter((rec: Recipe) => ids.has(rec.outputItemId)),
    achievements: achievements.filter((a: Achievement) =>
      a.requires.every((req) => achievements.some((other: Achievement) => other.id === req)),
    ),
    dice: normalizeDice(r.dice, base.dice),
    advancement: normalizeAdvancement(r.advancement ?? r.grind, base.advancement),
    combat: normalizeCombat(r.combat, base.combat),
    survival: normalizeSurvival(r.survival, base.survival),
    characters: Array.isArray(r.characters)
      ? r.characters.map(normalizeCharacter)
      : base.characters,
    derivedFormulas: normalizeFormulas(r.derivedFormulas, base.derivedFormulas ?? DEFAULT_FORMULAS),
    updatedAt: Date.now(),
  }
}
