import type { CharacterSheet, Combatant, DerivedFormula, Side } from '../types'
import { SKILLS } from '../pulso'
import { evaluateFormulas, type FormulaEvaluation } from './formula'

export const ATTRIBUTE_KEYS = ['corpo', 'agilidade', 'mente', 'presenca'] as const
export const CREATION_ATTRIBUTE_POINTS = 8
export const CREATION_SKILL_POINTS = 10
export const CREATION_SKILL_MAX = 3

/** Cumulative creation cost of an attribute (2 is the free baseline). */
export function attributeCost(value: number): number {
  if (value <= 2) return 0
  if (value === 3) return 1
  if (value === 4) return 3
  return 6
}

export function attributePointsSpent(sheet: CharacterSheet): number {
  return ATTRIBUTE_KEYS.reduce((sum, key) => sum + attributeCost(sheet.attributes[key]), 0)
}

export function skillPointsSpent(sheet: CharacterSheet): number {
  return SKILLS.reduce((sum, skill) => sum + (sheet.skills[skill.id] ?? 0), 0)
}

export function specializationFor(sheet: CharacterSheet, skillId: string): boolean {
  return sheet.specializations.some((spec) => spec.skillId === skillId && spec.name.trim() !== '')
}

export function derivedFor(sheet: CharacterSheet, formulas: DerivedFormula[]): FormulaEvaluation {
  return evaluateFormulas(formulas, {
    corpo: sheet.attributes.corpo,
    agilidade: sheet.attributes.agilidade,
    mente: sheet.attributes.mente,
    presenca: sheet.attributes.presenca,
  })
}

export function derivedNumber(sheet: CharacterSheet, formulas: DerivedFormula[], id: string, fallback: number): number {
  const evaluation = derivedFor(sheet, formulas)
  const value = evaluation.values[id]
  return Number.isFinite(value) ? value : fallback
}

export interface ConditionReport {
  state: string
  penalty: number
  notes: string[]
  canAct: boolean
}

/**
 * Applies Pulso's state, fatigue, stress and overload penalties to a test.
 * `attribute` matters because Fatigue 1 only hurts Corpo and Stress 1 only
 * hurts social (Presença) tests.
 */
export function conditionReport(
  sheet: CharacterSheet,
  maxVitality: number,
  attribute: 'corpo' | 'agilidade' | 'mente' | 'presenca',
): ConditionReport {
  const notes: string[] = []
  let penalty = 0
  let state = 'Ileso'

  const max = Math.max(1, maxVitality)
  const vitality = sheet.currentVitality

  if (vitality <= 0) state = 'Caído'
  else if (vitality <= 2) state = 'Grave'
  else if (vitality <= max / 2) state = 'Ferido'

  if (state === 'Grave') {
    penalty += 2
    notes.push('Grave −2 dice')
  } else if (state === 'Ferido') {
    penalty += 1
    notes.push('Ferido −1 die')
  } else if (state === 'Caído') {
    notes.push('Caído — cannot act')
  }

  if (sheet.fatigue >= 1) {
    if (sheet.fatigue === 1) {
      if (attribute === 'corpo') {
        penalty += 1
        notes.push('Fadiga 1: −1 Corpo test')
      }
    } else {
      const amount = sheet.fatigue >= 3 ? 2 : 1
      penalty += amount
      notes.push(`Fadiga ${sheet.fatigue}: −${amount} all tests`)
    }
  }

  if (sheet.stress >= 1) {
    if (attribute === 'presenca') {
      penalty += 1
      notes.push(`Estresse ${sheet.stress}: −1 social`)
    }
    if (sheet.stress >= 2) {
      const amount = sheet.stress >= 4 ? 2 : 1
      penalty += amount
      notes.push(`Estresse ${sheet.stress}: −${amount} all tests`)
    }
  }

  if (sheet.conditions.overloaded && (attribute === 'corpo' || attribute === 'agilidade')) {
    penalty += 1
    notes.push('Sobrecarregado −1 physical test')
  }

  return {
    state,
    penalty,
    notes,
    canAct: !sheet.conditions.unconscious && state !== 'Caído' && sheet.stress < 5,
  }
}

export type TestSource =
  | { kind: 'skill'; id: string }
  | { kind: 'attribute'; id: 'corpo' | 'agilidade' | 'mente' | 'presenca' }
  | { kind: 'willpower' }

export interface TestPool {
  pool: number
  attribute: 'corpo' | 'agilidade' | 'mente' | 'presenca'
  base: number
  breakdown: { label: string; value: number }[]
  condition: ConditionReport
  maxVitality: number
  sourceLabel: string
}

export function testPool(
  sheet: CharacterSheet,
  formulas: DerivedFormula[],
  source: TestSource,
  situational = 0,
): TestPool {
  const derived = derivedFor(sheet, formulas)
  const maxVitality = Math.max(1, Math.round(derived.values.vitalityMax ?? 5 + sheet.attributes.corpo * 2))
  const breakdown: { label: string; value: number }[] = []

  let attribute: TestPool['attribute'] = 'corpo'
  let base = 0
  let sourceLabel = ''

  if (source.kind === 'skill') {
    const skill = SKILLS.find((entry) => entry.id === source.id) ?? SKILLS[0]
    attribute = skill.attribute
    const level = sheet.skills[skill.id] ?? 0
    base = sheet.attributes[attribute] + level
    sourceLabel = `${skill.name} · ${skill.attribute} ${sheet.attributes[attribute]} + skill ${level}`
    breakdown.push({ label: `${skill.name} attribute`, value: sheet.attributes[attribute] })
    breakdown.push({ label: `${skill.name} skill`, value: level })
    if (specializationFor(sheet, skill.id)) {
      base += 1
      breakdown.push({ label: 'Specialization', value: 1 })
    }
  } else if (source.kind === 'willpower') {
    attribute = 'presenca'
    base = Math.round(derived.values.willpower ?? sheet.attributes.presenca + sheet.attributes.mente)
    sourceLabel = 'Vontade (Presença + Mente)'
    breakdown.push({ label: 'Willpower', value: base })
  } else {
    attribute = source.id
    base = sheet.attributes[attribute]
    sourceLabel = attribute
    breakdown.push({ label: attribute, value: base })
  }

  if (situational !== 0) breakdown.push({ label: 'Situational', value: situational })

  const condition = conditionReport(sheet, maxVitality, attribute)
  if (condition.penalty) breakdown.push({ label: 'Condition / fatigue / stress', value: -condition.penalty })

  return {
    pool: Math.max(1, base + situational - condition.penalty),
    attribute,
    base,
    breakdown,
    condition,
    maxVitality,
    sourceLabel,
  }
}

/** Builds an ally statblock from the sheet, applying all derived formulas. */
export function sheetToCombatant(
  sheet: CharacterSheet,
  formulas: DerivedFormula[],
  side: Side = 'ally',
): Omit<Combatant, 'id' | 'side'> {
  const derived = derivedFor(sheet, formulas)
  const combatSkills = ['luta', 'atirar']
    .map((id) => {
      const skill = SKILLS.find((entry) => entry.id === id)!
      const specialization = specializationFor(sheet, id) ? 1 : 0
      return {
        id,
        pool: sheet.attributes[skill.attribute] + (sheet.skills[id] ?? 0) + specialization,
        attribute: skill.attribute,
      }
    })
    .sort((a, b) => b.pool - a.pool)

  return {
    name: sheet.name || 'Unnamed character',
    pool: Math.max(1, combatSkills[0].pool),
    defense: Math.max(0, Math.round(derived.values.defense ?? sheet.attributes.agilidade)),
    vitalityMax: Math.max(1, Math.round(derived.values.vitalityMax ?? 5 + sheet.attributes.corpo * 2)),
    reduction: Math.max(0, Math.round(sheet.armor.reduction)),
    damage: Math.max(0, Math.round(sheet.weapon.damage)),
    initiative: Math.max(0, Math.round(derived.values.initiative ?? sheet.attributes.agilidade + sheet.attributes.mente)),
    actionsPerTurn: 1,
    zone: sheet.weapon.zone,
    tricks: [],
    threat: 0,
  }
}

export function loadTotal(sheet: CharacterSheet): number {
  return sheet.load.weapon + sheet.load.armor + sheet.load.kit + sheet.load.other
}
