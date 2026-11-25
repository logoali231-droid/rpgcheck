export type ItemKind = 'raw' | 'crafted'
export type Side = 'ally' | 'foe'
export type Zone = 'melee' | 'near' | 'far'
export type Archetype = 'horda' | 'capanga' | 'elite' | 'chefe' | 'lendario'
export type TrickId = 'forte' | 'rapido' | 'resistente' | 'blindado' | 'tatico' | 'regenera'
export type EncounterKind = 'combat' | 'pursuit' | 'negotiation' | 'exploration' | 'puzzle'
export type AttributeKey = 'corpo' | 'agilidade' | 'mente' | 'presenca'

export interface Item {
  id: string
  name: string
  kind: ItemKind
  unit: string
  nutrition: number
  notes: string
}

export interface Ingredient {
  itemId: string
  qty: number
}

export interface Recipe {
  id: string
  name: string
  outputItemId: string
  outputQty: number
  inputs: Ingredient[]
  craftTimeSec: number
  difficulty: number
  station: string
  requires: string[]
}

export interface Achievement {
  id: string
  name: string
  requires: string[]
  itemCost: Ingredient[]
}

export interface TreeNode {
  key: string
  itemId: string
  name: string
  unit: string
  qty: number
  recipeId?: string
  recipeName?: string
  recipesAvailable: number
  crafts: number
  produced: number
  surplus: number
  children: TreeNode[]
  isBase: boolean
  cycle: boolean
  depth: number
}

export interface CraftPlan {
  root: TreeNode
  baseResources: { itemId: string; name: string; unit: string; qty: number }[]
  crafts: {
    recipeId: string
    name: string
    outputName: string
    count: number
    seconds: number
    difficulty: number
  }[]
  totalSeconds: number
  totalCrafts: number
  maxDifficulty: number
  hasCycle: boolean
  maxDepthHit: boolean
}

export interface DiceConfig {
  pool: number
  threshold: number
  difficulty: number
  criticalSuccess: boolean
  partialSuccess: boolean
  bonusSuccesses: number
  penaltyDice: number
  opposed: boolean
  opposedPool: number
}

export interface DiceResult {
  support: { value: number; prob: number }[]
  atLeast: { value: number; prob: number }[]
  mean: number
  sd: number
  pSuccess: number
  pExact: number
  pCritFail: number
  pPartial: number
  dice: number
  autoSuccesses: number
  min: number
  max: number
  opposed?: { win: number; tie: number; lose: number }
}

export interface AdvancementEntry {
  id: string
  name: string
  cost: number
  qty: number
}

export interface AdvancementConfig {
  xpPerSession: number
  bonusXpPerSession: number
  entries: AdvancementEntry[]
}

export interface Combatant {
  id: string
  name: string
  side: Side
  pool: number
  defense: number
  vitalityMax: number
  reduction: number
  damage: number
  initiative: number
  actionsPerTurn: number
  zone: Zone
  tricks: TrickId[]
  archetype?: Archetype
  threat: number
  /** Links this statblock to a character sheet, for two-way updates. */
  sheetId?: string
}

export interface EncounterMeta {
  title: string
  kind: EncounterKind
  objective: string
  obstacle: string
  consequence: string
  complication: string
  startZone: Zone
}

export interface CombatConfig {
  combatants: Combatant[]
  iterations: number
  maxRounds: number
  seed: number
  criticalSuccess: boolean
  finishDowned: boolean
  meta: EncounterMeta
}

export interface SurvivalSource {
  itemId: string
  gatherMinutes: number
  stock: number
}

export interface SurvivalConfig {
  days: number
  dayMinutes: number
  workMinutes: number
  startHealth: number
  hungerPerDay: number
  hungerGrowthPct: number
  healthLossPerMissingNutrition: number
  fatiguePerHour: number
  sources: SurvivalSource[]
}

export interface CharacterAttributes {
  corpo: number
  agilidade: number
  mente: number
  presenca: number
}

/** Editable derived-stat formula; `id` is also the variable name. */
export interface DerivedFormula {
  id: string
  label: string
  expression: string
  builtin: boolean
}

export interface CharacterBond {
  id: string
  name: string
  value: number
  note: string
}

export interface CharacterSheet {
  id: string
  name: string
  concept: string
  scenario: string
  wealth: number
  modules: { magic: boolean; cyber: boolean; sanity: boolean; bonds: boolean; base: boolean }
  attributes: CharacterAttributes
  skills: Record<string, number>
  saberArea: string
  specializations: { id: string; skillId: string; name: string }[]
  currentVitality: number
  fatigue: number
  stress: number
  conditions: { unconscious: boolean; stabilized: boolean; overloaded: boolean }
  weapon: { name: string; damage: number; zone: Zone }
  armor: { name: string; reduction: number }
  kit: string
  otherGear: string
  load: { weapon: number; armor: number; kit: number; other: number }
  advantages: string[]
  disadvantages: string[]
  tempWealth: number
  leverage: string
  contracts: string
  mysticLevel: number
  implantsUsed: number
  bonds: CharacterBond[]
  baseLevel: number
  domainLevel: number
  foodReserve: number
  notes: string
}

export interface Project {
  version: number
  name: string
  items: Item[]
  recipes: Recipe[]
  achievements: Achievement[]
  dice: DiceConfig
  advancement: AdvancementConfig
  combat: CombatConfig
  survival: SurvivalConfig
  characters: CharacterSheet[]
  derivedFormulas: DerivedFormula[]
  updatedAt: number
}
