import type { Archetype, Combatant, TrickId, Zone } from './types'

/* ----------------------------- resolution ----------------------------- */

export const ZONES: { id: Zone; label: string; index: number }[] = [
  { id: 'melee', label: 'Corpo a Corpo', index: 0 },
  { id: 'near', label: 'Perto', index: 1 },
  { id: 'far', label: 'Longe', index: 2 },
]

export function zoneIndex(zone: Zone): number {
  return ZONES.find((entry) => entry.id === zone)?.index ?? 0
}

export const DIFFICULTIES = [
  { value: 1, label: 'Rotina' },
  { value: 2, label: 'Média' },
  { value: 3, label: 'Difícil' },
  { value: 4, label: 'Muito Difícil' },
  { value: 5, label: 'Heroico' },
  { value: 6, label: 'Sobre-humano' },
] as const

export function difficultyLabel(value: number): string {
  const exact = DIFFICULTIES.find((entry) => entry.value === value)
  if (exact) return exact.label
  if (value > 6) return 'Sobre-humano'
  return 'Rotina'
}

export interface SkillDefinition {
  id: string
  name: string
  attribute: 'corpo' | 'agilidade' | 'mente' | 'presenca'
  hint: string
}

/** The 15 skills from the official sheet. */
export const SKILLS: SkillDefinition[] = [
  { id: 'luta', name: 'Luta', attribute: 'corpo', hint: 'Melee, blades and brawling' },
  { id: 'vigor', name: 'Vigor', attribute: 'corpo', hint: 'Endurance, pain, poison and raw athletics' },
  { id: 'atirar', name: 'Atirar', attribute: 'agilidade', hint: 'Any ranged weapon' },
  { id: 'acrobacia', name: 'Acrobacia', attribute: 'agilidade', hint: 'Balance, dodge, climb and contortion' },
  { id: 'furtividade', name: 'Furtividade', attribute: 'agilidade', hint: 'Hide, move silently and surprise' },
  { id: 'conduzir', name: 'Conduzir', attribute: 'agilidade', hint: 'Vehicles, mounts and piloting' },
  { id: 'percepcao', name: 'Percepção', attribute: 'mente', hint: 'Notice, investigate, smell and hear' },
  { id: 'saber', name: 'Saber', attribute: 'mente', hint: 'History, science, culture and law' },
  { id: 'tecnologia', name: 'Tecnologia', attribute: 'mente', hint: 'Repair, build, hack and operate machines' },
  { id: 'medicina', name: 'Medicina', attribute: 'mente', hint: 'First aid, treatment and diagnosis' },
  { id: 'sobrevivencia', name: 'Sobrevivência', attribute: 'mente', hint: 'Track, navigate, hunt and forage' },
  { id: 'persuasao', name: 'Persuasão', attribute: 'presenca', hint: 'Convince, negotiate, lead and inspire' },
  { id: 'enganacao', name: 'Enganação', attribute: 'presenca', hint: 'Lie, disguise, bluff and cheat' },
  { id: 'intimidacao', name: 'Intimidação', attribute: 'presenca', hint: 'Threaten, coerce and instil fear' },
  { id: 'empatia', name: 'Empatia', attribute: 'presenca', hint: 'Read intentions, emotions and lies' },
]

export const ATTRIBUTE_LABELS: Record<'corpo' | 'agilidade' | 'mente' | 'presenca', string> = {
  corpo: 'Corpo',
  agilidade: 'Agilidade',
  mente: 'Mente',
  presenca: 'Presença',
}

export const CRAFT_DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Trivial',
  2: 'Comum',
  3: 'Incomum',
  4: 'Raro',
  5: 'Único',
}

/* ------------------------------ antagonists --------------------------- */

export interface ArchetypeBase {
  label: string
  pool: number
  defense: number
  vitality: number
  threat: number
  tricks: number
  actions: number
  initiative: number
  damage: number
  reduction: number
  zone: Zone
  note: string
}

export const ARCHETYPES: Record<Archetype, ArchetypeBase> = {
  horda: {
    label: 'Horda', pool: 2, defense: 1, vitality: 3, threat: 0.5, tricks: 0,
    actions: 1, initiative: 2, damage: 1, reduction: 0, zone: 'melee',
    note: 'Crowd or swarm. Two Hordas equal one Capanga of threat.',
  },
  capanga: {
    label: 'Capanga', pool: 3, defense: 2, vitality: 5, threat: 1, tricks: 1,
    actions: 1, initiative: 3, damage: 2, reduction: 1, zone: 'melee',
    note: 'Common obstacle. Pool 3 cannot beat Defense 4 without criticals.',
  },
  elite: {
    label: 'Elite', pool: 5, defense: 3, vitality: 9, threat: 2, tricks: 2,
    actions: 1, initiative: 4, damage: 3, reduction: 2, zone: 'near',
    note: 'A real challenge for a starting group.',
  },
  chefe: {
    label: 'Chefe', pool: 7, defense: 4, vitality: 14, threat: 3, tricks: 3,
    actions: 1, initiative: 5, damage: 4, reduction: 2, zone: 'near',
    note: 'Closes an arc. Presence at the table.',
  },
  lendario: {
    label: 'Lendário', pool: 8, defense: 5, vitality: 20, threat: 4, tricks: 4,
    actions: 2, initiative: 6, damage: 4, reduction: 3, zone: 'near',
    note: 'Acts twice per round. Only real damage can kill it.',
  },
}

export interface SubtypeMod {
  id: string
  label: string
  pool?: number
  defense?: number
  vitality?: number
  damage?: number
  reduction?: number
  trick?: TrickId
}

export const SUBTYPES: Record<Archetype, SubtypeMod[]> = {
  horda: [
    { id: 'none', label: 'Plain' },
    { id: 'enxame', label: 'Enxame (+1 Pool, −1 Vit)', pool: 1, vitality: -1 },
    { id: 'multidao', label: 'Multidão (+1 Vit, −1 Pool)', vitality: 1, pool: -1 },
  ],
  capanga: [
    { id: 'none', label: 'Plain' },
    { id: 'bruto', label: 'Bruto (+1 Pool, −1 Def)', pool: 1, defense: -1 },
    { id: 'astuto', label: 'Astuto (+1 Def, −1 Pool)', defense: 1, pool: -1 },
    { id: 'resistente', label: 'Resistente (+2 Vit, −1 Pool)', vitality: 2, pool: -1, trick: 'resistente' },
  ],
  elite: [
    { id: 'none', label: 'Plain' },
    { id: 'assassino', label: 'Assassino (+1 Pool, −1 Vit)', pool: 1, vitality: -1 },
    { id: 'muralha', label: 'Muralha (+1 Def, +1 Vit, −1 Pool)', defense: 1, vitality: 1, pool: -1 },
    { id: 'comandante', label: 'Comandante (+1 die to allies)', trick: 'tatico' },
  ],
  chefe: [
    { id: 'none', label: 'Plain' },
    { id: 'general', label: 'General (+1 Pool)', pool: 1 },
    { id: 'mago', label: 'Mago (+1 Pool, Mística)', pool: 1 },
    { id: 'mercador', label: 'Mercador (social focus)' },
  ],
  lendario: [
    { id: 'none', label: 'Plain' },
    { id: 'dragao', label: 'Dragão (+2 Vit, +1 Def, Forte)', vitality: 2, defense: 1, trick: 'forte' },
    { id: 'imperador', label: 'Imperador (+1 Pool, Tático)', pool: 1, trick: 'tatico' },
    { id: 'horror', label: 'Horror (+1 Pool, presence)', pool: 1 },
  ],
}

export interface TrickInfo {
  id: TrickId
  label: string
  description: string
  simulated: boolean
}

export const TRICKS: TrickInfo[] = [
  { id: 'forte', label: 'Forte', description: '+2 damage when the attack rolls a 6.', simulated: true },
  { id: 'rapido', label: 'Rápido', description: 'One extra action each turn.', simulated: true },
  { id: 'resistente', label: 'Resistente', description: 'Reroll a failed Vigor death save.', simulated: true },
  { id: 'blindado', label: 'Blindado', description: 'Reduction +1 (applied to the single highest reduction).', simulated: true },
  { id: 'tatico', label: 'Tático', description: 'Allies still standing gain +1 die on attacks.', simulated: true },
  { id: 'regenera', label: 'Regenera', description: 'Recovers 2 Vitality at the start of its turn.', simulated: true },
]

export const ENCOUNTER_KINDS: { id: 'combat' | 'pursuit' | 'negotiation' | 'exploration' | 'puzzle'; label: string; note: string }[] = [
  { id: 'combat', label: 'Combat', note: 'Attack vs Defense, 3–6 rounds.' },
  { id: 'pursuit', label: 'Pursuit', note: 'Opposed extended tests, 5 markers to escape.' },
  { id: 'negotiation', label: 'Negotiation', note: 'Social rules: move attitude two steps.' },
  { id: 'exploration', label: 'Exploration', note: '3–5 tests; failures cause Fatigue or combat.' },
  { id: 'puzzle', label: 'Puzzle', note: 'Extended test, total difficulty 6–10.' },
]

export const COMPLICATIONS = [
  'Reinforcement: another enemy joins the fight.',
  'Terrain: the ground shifts, breaks or catches fire.',
  'Hostage: someone the party must protect is exposed.',
  'Objective changes: the goal moves or becomes harder.',
  'Environment: darkness, smoke, alarms or collapsing structure.',
  'Enemy ally: a neutral party sides with the opposition.',
]

/* ------------------------------- threat ------------------------------- */

export interface ThreatBand {
  id: string
  label: string
  target: number
}

export function threatTargets(partySize: number): ThreatBand[] {
  return [
    { id: 'trivial', label: 'Trivial', target: Math.max(0.5, partySize / 2) },
    { id: 'easy', label: 'Fácil', target: Math.max(0.5, partySize - 1) },
    { id: 'medium', label: 'Médio', target: Math.max(0.5, partySize) },
    { id: 'hard', label: 'Difícil', target: partySize + 2 },
    { id: 'lethal', label: 'Letal', target: partySize + 4 },
    { id: 'terror', label: 'Terror', target: partySize + 6 },
  ]
}

export function nearestBand(total: number, partySize: number): ThreatBand {
  return threatTargets(partySize).reduce((best, band) =>
    Math.abs(band.target - total) < Math.abs(best.target - total) ? band : best,
  )
}

/* ------------------------------ advancement --------------------------- */

export const XP_COSTS: { id: string; label: string; cost: number }[] = [
  { id: 'skill', label: 'Skill +1', cost: 2 },
  { id: 'advantage', label: 'New advantage', cost: 3 },
  { id: 'remove', label: 'Remove a disadvantage', cost: 3 },
  { id: 'attr23', label: 'Attribute 2 → 3', cost: 6 },
  { id: 'attr34', label: 'Attribute 3 → 4', cost: 8 },
  { id: 'attr45', label: 'Attribute 4 → 5', cost: 12 },
  { id: 'mystic', label: 'Mystic skill +1 (module)', cost: 2 },
  { id: 'ritual', label: 'Learn a new ritual (module)', cost: 3 },
  { id: 'chassis', label: 'Expand chassis (module)', cost: 4 },
  { id: 'implant', label: 'Upgrade an implant (module)', cost: 3 },
  { id: 'humanity', label: 'Recover 1 Presence (module)', cost: 5 },
  { id: 'base', label: 'Base level +1 (module)', cost: 3 },
  { id: 'domain', label: 'Domain power +1 (module)', cost: 4 },
]

/* -------------------------------- builds ------------------------------ */

export interface EnemyOptions {
  archetype: Archetype
  subtypeId?: string
  name: string
  weak?: boolean
  reinforced?: boolean
  armor?: number
  betterWeapon?: boolean
  many?: boolean
  alone?: boolean
  tricks?: TrickId[]
}

export function buildEnemy(options: EnemyOptions): Omit<Combatant, 'id' | 'side'> {
  const base = ARCHETYPES[options.archetype]
  const subtype = (SUBTYPES[options.archetype] ?? []).find((entry) => entry.id === options.subtypeId)
  let pool = base.pool + (subtype?.pool ?? 0)
  let defense = base.defense + (subtype?.defense ?? 0)
  let vitality = base.vitality + (subtype?.vitality ?? 0)
  let damage = base.damage + (subtype?.damage ?? 0)
  let reduction = base.reduction + (subtype?.reduction ?? 0)
  let threat = base.threat + (options.weak ? -1 : 0) + (options.reinforced ? 1 : 0)

  if (options.many) {
    pool += 1
    defense -= 1
  }
  if (options.alone) {
    vitality += 1
    defense += 1
  }
  if (options.armor !== undefined) reduction = options.armor
  if (options.betterWeapon) damage += 1

  const tricks = new Set<TrickId>(options.tricks ?? [])
  if (subtype?.trick) tricks.add(subtype.trick)

  return {
    name: options.name || base.label,
    pool: Math.max(1, pool),
    defense: Math.max(0, defense),
    vitalityMax: Math.max(1, vitality),
    reduction: Math.max(0, reduction),
    damage: Math.max(0, damage),
    initiative: base.initiative,
    actionsPerTurn: base.actions,
    zone: base.zone,
    tricks: [...tricks],
    archetype: options.archetype,
    threat: Math.max(0.5, threat),
  }
}

export function trickLabel(id: TrickId): string {
  return TRICKS.find((trick) => trick.id === id)?.label ?? id
}

export function zoneLabel(zone: Zone): string {
  return ZONES.find((entry) => entry.id === zone)?.label ?? zone
}
