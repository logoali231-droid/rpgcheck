import { useMemo, useState } from 'react'
import { useProject } from '../../store/project'
import {
  ATTRIBUTE_KEYS,
  CREATION_ATTRIBUTE_POINTS,
  CREATION_SKILL_POINTS,
  attributeCost,
  attributePointsSpent,
  conditionReport,
  derivedFor,
  loadTotal,
  sheetToCombatant,
  skillPointsSpent,
  specializationFor,
  testPool,
  type TestSource,
} from '../../lib/engine/character'
import { DEFAULT_FORMULAS, FORMULA_FUNCTIONS, FORMULA_VARIABLES } from '../../lib/engine/formula'
import { rollDetailed, successDistribution } from '../../lib/engine/dice'
import { ATTRIBUTE_LABELS, DIFFICULTIES, SKILLS, ZONES } from '../../lib/pulso'
import { fmtNum, fmtPct, slugify, uid } from '../../lib/format'
import { download } from '../../lib/io/download'
import { Badge, Button, Card, Callout, Empty, Field, NumberInput, Select, TextInput } from '../ui'
import type { AttributeKey, CharacterSheet, DerivedFormula, Zone } from '../../lib/types'

const wealthLabels = ['Miserável', 'Pobre', 'Médio', 'Rico', 'Abastado']

function emptySheet(name: string): CharacterSheet {
  return {
    id: uid('char'),
    name,
    concept: '',
    scenario: '',
    wealth: 2,
    modules: { magic: false, cyber: false, sanity: false, bonds: false, base: false },
    attributes: { corpo: 2, agilidade: 2, mente: 2, presenca: 2 },
    skills: Object.fromEntries(SKILLS.map((skill) => [skill.id, 0])) as Record<string, number>,
    saberArea: '',
    specializations: [],
    currentVitality: 9,
    fatigue: 0,
    stress: 0,
    conditions: { unconscious: false, stabilized: false, overloaded: false },
    weapon: { name: 'Unarmed', damage: 1, zone: 'melee' },
    armor: { name: 'None', reduction: 0 },
    kit: '',
    otherGear: '',
    load: { weapon: 0, armor: 0, kit: 0, other: 0 },
    advantages: [],
    disadvantages: [],
    tempWealth: 0,
    leverage: '',
    contracts: '',
    mysticLevel: 0,
    implantsUsed: 0,
    bonds: [],
    baseLevel: 0,
    domainLevel: 0,
    foodReserve: 0,
    notes: '',
  }
}

interface RollEntry {
  id: string
  label: string
  pool: number
  difficulty: number
  faces: number[]
  successes: number
  ones: number
  crit: boolean
  outcome: 'success' | 'partial' | 'failure' | 'blocked'
  excess: number
  damage: number | null
  targetName?: string
  targetSheetId?: string
  applied?: boolean
  notes: string[]
  time: number
}

export default function CharactersPanel({ onOpenEncounter }: { onOpenEncounter: () => void }) {
  const { project, update } = useProject()
  const [selectedId, setSelectedId] = useState(project.characters[0]?.id ?? '')
  const [tab, setTab] = useState<'sheet' | 'rolls' | 'formulas'>('sheet')
  const [sourceKind, setSourceKind] = useState<'skill' | 'attribute' | 'willpower'>('skill')
  const [skillId, setSkillId] = useState('atirar')
  const [attribute, setAttribute] = useState<AttributeKey>('corpo')
  const [difficulty, setDifficulty] = useState(2)
  const [modifier, setModifier] = useState(0)
  const [lastRoll, setLastRoll] = useState<RollEntry | null>(null)
  const [history, setHistory] = useState<RollEntry[]>([])
  const [copied, setCopied] = useState(false)
  const [targetId, setTargetId] = useState('none')
  const [damageAmount, setDamageAmount] = useState(0)

  const character = project.characters.find((entry) => entry.id === selectedId) ?? project.characters[0]
  const formulas = project.derivedFormulas
  const derived = useMemo(
    () => (character ? derivedFor(character, formulas) : null),
    [character, formulas],
  )

  const maxVitality = character && derived
    ? Math.max(1, Math.round(derived.values.vitalityMax ?? 5 + character.attributes.corpo * 2))
    : 1
  const condition = character ? conditionReport(character, maxVitality, 'corpo') : null
  const inventory = character && derived ? Math.floor(derived.values.inventory ?? character.attributes.corpo + 3) : 0
  const load = character ? loadTotal(character) : 0

  const patch = (mutate: (draft: CharacterSheet) => void) => {
    if (!character) return
    update((draft) => {
      const target = draft.characters.find((entry) => entry.id === character.id)
      if (target) mutate(target)
    })
  }

  const source: TestSource =
    sourceKind === 'skill'
      ? { kind: 'skill', id: skillId }
      : sourceKind === 'attribute'
        ? { kind: 'attribute', id: attribute }
        : { kind: 'willpower' }

  const poolInfo = character ? testPool(character, formulas, source, modifier) : null
  const target = project.combat.combatants.find((entry) => entry.id === targetId)
  const attackSource = (test: TestSource) =>
    test.kind === 'skill' && (test.id === 'luta' || test.id === 'atirar')
  const selectedDifficulty = attackSource(source) && target ? target.defense : difficulty

  const rollWith = (testSource: TestSource, label?: string) => {
    if (!character) return
    const info = testPool(character, formulas, testSource, modifier)
    const testDifficulty = attackSource(testSource) && target ? target.defense : difficulty
    if (!info.condition.canAct) {
      const entry: RollEntry = {
        id: uid('roll'), label: label ?? info.sourceLabel, pool: info.pool, difficulty: testDifficulty,
        faces: [], successes: 0, ones: 0, crit: false, outcome: 'blocked', excess: 0, damage: null,
        notes: info.condition.notes, time: Date.now(),
      }
      setLastRoll(entry)
      setHistory((current) => [entry, ...current].slice(0, 10))
      return
    }
    const rolled = rollDetailed(Math.random, info.pool, project.dice.criticalSuccess, project.dice.threshold)
    const isAttack = attackSource(testSource)
    const excess = rolled.successes - testDifficulty
    let outcome: RollEntry['outcome'] =
      rolled.successes >= testDifficulty
        ? 'success'
        : excess === -1 && project.dice.partialSuccess && !isAttack && testSource.kind !== 'willpower'
          ? 'partial'
          : 'failure'
    if (rolled.successes === 0 && rolled.ones >= 2) outcome = 'failure'
    const damage = isAttack && excess >= 0
      ? Math.max(0, character.weapon.damage + Math.max(0, excess) - (target?.reduction ?? 0))
      : null
    const entry: RollEntry = {
      id: uid('roll'),
      label: label ?? info.sourceLabel,
      pool: info.pool,
      difficulty: testDifficulty,
      faces: rolled.faces,
      successes: rolled.successes,
      ones: rolled.ones,
      crit: rolled.successes === 0 && rolled.ones >= 2,
      outcome,
      excess,
      damage,
      targetName: target?.name,
      targetSheetId: target?.sheetId,
      notes: info.condition.notes,
      time: Date.now(),
    }
    setLastRoll(entry)
    setHistory((current) => [entry, ...current].slice(0, 10))
  }

  const applyRollDamage = () => {
    if (!lastRoll?.targetSheetId || lastRoll.damage === null) return
    const damage = lastRoll.damage
    const targetSheetId = lastRoll.targetSheetId
    update((draft) => {
      const sheet = draft.characters.find((entry) => entry.id === targetSheetId)
      if (sheet) sheet.currentVitality = Math.max(0, sheet.currentVitality - damage)
    })
    setLastRoll({ ...lastRoll, applied: true })
    setHistory((current) =>
      current.map((entry) => (entry.id === lastRoll.id ? { ...entry, applied: true } : entry)),
    )
  }

  const odds = poolInfo
    ? (() => {
        const distribution = successDistribution(
          poolInfo.pool,
          project.dice.criticalSuccess,
          project.dice.threshold,
        )
        const allowPartial =
          project.dice.partialSuccess && !attackSource(source) && source.kind !== 'willpower'
        let success = 0
        let partial = 0
        for (const [successes, probability] of distribution.dist) {
          if (successes >= selectedDifficulty) success += probability
          else if (allowPartial && successes === selectedDifficulty - 1) partial += probability
        }
        return { success, partial }
      })()
    : null

  const netDamage = Math.max(0, Math.round(damageAmount) - (character?.armor.reduction ?? 0))
  const applySheetDamage = () =>
    patch((draft) => {
      draft.currentVitality = Math.max(0, draft.currentVitality - netDamage)
    })
  const healSheet = () =>
    patch((draft) => {
      draft.currentVitality = Math.min(maxVitality, draft.currentVitality + Math.abs(Math.round(damageAmount)))
    })
  const restSheet = () =>
    patch((draft) => {
      draft.currentVitality = maxVitality
      draft.fatigue = 0
      draft.stress = Math.max(0, draft.stress - 1)
    })

  const createCharacter = () => {
    const sheet = emptySheet(`New Character ${project.characters.length + 1}`)
    update((draft) => {
      draft.characters.push(sheet)
    })
    setSelectedId(sheet.id)
    setTab('sheet')
  }

  const duplicateCharacter = () => {
    if (!character) return
    const copy = structuredClone(character)
    copy.id = uid('char')
    copy.name = `${character.name} copy`
    update((draft) => {
      draft.characters.push(copy)
    })
    setSelectedId(copy.id)
  }

  const deleteCharacter = () => {
    if (!character) return
    if (!window.confirm(`Delete the character sheet “${character.name}”?`)) return
    const remaining = project.characters.filter((entry) => entry.id !== character.id)
    update((draft) => {
      draft.characters = draft.characters.filter((entry) => entry.id !== character.id)
    })
    setSelectedId(remaining[0]?.id ?? '')
  }

  const exportSheet = async () => {
    if (!character) return
    download(`${slugify(character.name)}-sheet.json`, JSON.stringify({ sheet: character, derived: derived?.values }, null, 2), 'application/json')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const syncToEncounter = () => {
    if (!character) return
    const fighter = sheetToCombatant(character, formulas)
    update((draft) => {
      const existing = draft.combat.combatants.find(
        (entry) =>
          entry.side === 'ally' &&
          (entry.sheetId === character.id ||
            entry.name.trim().toLowerCase() === fighter.name.trim().toLowerCase()),
      )
      if (existing) {
        Object.assign(existing, fighter, { sheetId: character.id })
      } else {
        draft.combat.combatants.push({ ...fighter, id: uid('pc'), side: 'ally', sheetId: character.id })
      }
    })
    onOpenEncounter()
  }

  const updateFormula = (id: string, patchFormula: Partial<DerivedFormula>) =>
    update((draft) => {
      const formula = draft.derivedFormulas.find((entry) => entry.id === id)
      if (formula) Object.assign(formula, patchFormula)
    })

  const resetFormulas = () => {
    update((draft) => {
      draft.derivedFormulas = DEFAULT_FORMULAS.map((formula) => ({ ...formula }))
    })
  }

  if (!character) {
    return (
      <Card title="No character sheets yet" subtitle="Create a sheet based on the official Pulso d6 layout.">
        <Button variant="primary" onClick={createCharacter}>
          Create character
        </Button>
      </Card>
    )
  }

  const evaluation = derived ?? derivedFor(character, formulas)
  const formulasById = new Map(formulas.map((formula) => [formula.id, formula]))

  return (
    <div className="chars-layout">
      <aside className="chars-sidebar">
        <Card
          title="Sheets"
          subtitle={`${project.characters.length} characters`}
          actions={
            <Button small variant="primary" onClick={createCharacter}>
              + New
            </Button>
          }
        >
          <div className="list">
            {project.characters.map((entry) => (
              <div key={entry.id} className={`char-item${entry.id === character.id ? ' char-item--active' : ''}`}>
                <button className="char-item__main" onClick={() => setSelectedId(entry.id)}>
                  <span className="char-item__name">{entry.name}</span>
                  <span className="char-item__meta">{entry.concept || 'No concept yet'}</span>
                </button>
              </div>
            ))}
          </div>
          <div className="chars-sidebar__actions">
            <Button small onClick={duplicateCharacter}>Duplicate</Button>
            <Button small onClick={exportSheet}>{copied ? 'Exported ✓' : 'Export JSON'}</Button>
            <Button small variant="danger" onClick={deleteCharacter}>Delete</Button>
          </div>
        </Card>

        <Card title="Derived values" subtitle="From the editable formulas">
          <div className="derived-mini">
            {formulas.map((formula) => (
              <div key={formula.id} className="derived-mini__row">
                <span>{formula.label}</span>
                <strong>{evaluation.errors[formula.id] ? '⚠' : fmtNum(evaluation.values[formula.id] ?? 0)}</strong>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <Button small onClick={syncToEncounter}>Sync to encounter</Button>
            <Button small variant="subtle" onClick={() => setTab('formulas')}>Edit formulas</Button>
          </div>
          <p className="hint">Defense, Vitality, Initiative and Willpower feed the roll console and the Encounter Lab.</p>
        </Card>
      </aside>

      <div className="chars-main">
        <div className="tabs">
          <button className={`tab${tab === 'sheet' ? ' tab--active' : ''}`} onClick={() => setTab('sheet')}>Character sheet</button>
          <button className={`tab${tab === 'rolls' ? ' tab--active' : ''}`} onClick={() => setTab('rolls')}>Roll tests</button>
          <button className={`tab${tab === 'formulas' ? ' tab--active' : ''}`} onClick={() => setTab('formulas')}>Derived formulas</button>
        </div>

        {tab === 'sheet' ? (
          <div className="sheet-columns">
            <div className="stack">
              <Card title="Identity" subtitle="Official sheet · page 1">
                <div className="field-grid">
                  <Field label="Name">
                    <TextInput value={character.name} onChange={(value) => patch((draft) => { draft.name = value })} />
                  </Field>
                  <Field label="Wealth" hint="0–4">
                    <Select
                      value={String(character.wealth)}
                      options={wealthLabels.map((label, value) => ({ value: String(value), label: `${value} · ${label}` }))}
                      onChange={(value) => patch((draft) => { draft.wealth = Number(value) })}
                    />
                  </Field>
                  <Field label="Concept" wide>
                    <TextInput value={character.concept} onChange={(value) => patch((draft) => { draft.concept = value })} placeholder="One sentence: who they are and what they want." />
                  </Field>
                  <Field label="Scenario" wide>
                    <TextInput value={character.scenario} onChange={(value) => patch((draft) => { draft.scenario = value })} placeholder="World or campaign" />
                  </Field>
                </div>
                <div className="chips">
                  <span className="field__label">Active modules</span>
                  {(
                    [
                      ['magic', 'Magia'],
                      ['cyber', 'Cyber'],
                      ['sanity', 'Sanidade'],
                      ['bonds', 'Laços'],
                      ['base', 'Base'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={`chip${character.modules[key] ? ' chip--active' : ''}`}
                      onClick={() => patch((draft) => { draft.modules[key] = !draft.modules[key] })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Attributes" subtitle="8 points · cost 1 / 3 / 6 (2→3, 2→4, 2→5)">
                <div className="attr-grid">
                  {ATTRIBUTE_KEYS.map((key) => (
                    <div key={key} className="attr-card">
                      <span className="attr-card__label">{ATTRIBUTE_LABELS[key]}</span>
                      <NumberInput
                        value={character.attributes[key]}
                        min={1}
                        max={5}
                        onChange={(value) =>
                          patch((draft) => {
                            draft.attributes[key] = Math.min(5, Math.max(1, Math.round(value)))
                          })
                        }
                      />
                      <span className="attr-card__cost">{attributeCost(character.attributes[key])} pt</span>
                    </div>
                  ))}
                </div>
                <div className={`budget${attributePointsSpent(character) > CREATION_ATTRIBUTE_POINTS ? ' budget--over' : ''}`}>
                  <span>Attribute points: {attributePointsSpent(character)} / {CREATION_ATTRIBUTE_POINTS}</span>
                  <div className="budget__bar">
                    <span style={{ width: `${Math.min(100, (attributePointsSpent(character) / CREATION_ATTRIBUTE_POINTS) * 100)}%` }} />
                  </div>
                </div>

                <div className="derived-grid">
                  {formulas.map((formula) => (
                    <div key={formula.id} className="derived-card">
                      <span className="derived-card__label">{formula.label}</span>
                      <strong className="derived-card__value">{evaluation.errors[formula.id] ? '⚠' : fmtNum(evaluation.values[formula.id] ?? 0)}</strong>
                      <span className="derived-card__formula mono">{formula.expression}</span>
                    </div>
                  ))}
                </div>
                {Object.keys(evaluation.errors).length ? (
                  <Callout tone="bad" title="Formula errors">
                    <ul className="bullets">
                      {Object.entries(evaluation.errors).map(([id, message]) => (
                        <li key={id}>{formulasById.get(id)?.label ?? id}: {message}</li>
                      ))}
                    </ul>
                  </Callout>
                ) : null}
              </Card>

              <Card title="Vitality, fatigue and stress" subtitle="Combat state · automatically applied to tests">
                <div className="tracker-grid">
                  <Field label="Current Vitality" hint={`max ${maxVitality}`}>
                    <NumberInput
                      value={character.currentVitality}
                      min={0}
                      max={999}
                      onChange={(value) => patch((draft) => { draft.currentVitality = Math.max(0, Math.round(value)) })}
                    />
                  </Field>
                  <Field label="Fatigue" hint="0–3">
                    <NumberInput value={character.fatigue} min={0} max={3} onChange={(value) => patch((draft) => { draft.fatigue = Math.min(3, Math.max(0, Math.round(value))) })} />
                  </Field>
                  <Field label="Stress" hint="0–5">
                    <NumberInput value={character.stress} min={0} max={5} onChange={(value) => patch((draft) => { draft.stress = Math.min(5, Math.max(0, Math.round(value))) })} />
                  </Field>
                  <Field label="State">
                    <span className="state-pill">
                      <Badge tone={condition?.state === 'Ileso' ? 'ok' : condition?.state === 'Ferido' ? 'warn' : 'bad'}>
                        {condition?.state}
                      </Badge>
                      <Button small variant="subtle" onClick={() => patch((draft) => { draft.currentVitality = maxVitality })}>
                        Full
                      </Button>
                    </span>
                  </Field>
                </div>
                <div className="chips">
                  <button className={`chip${character.conditions.unconscious ? ' chip--active' : ''}`} onClick={() => patch((draft) => { draft.conditions.unconscious = !draft.conditions.unconscious })}>Inconsciente</button>
                  <button className={`chip${character.conditions.stabilized ? ' chip--active' : ''}`} onClick={() => patch((draft) => { draft.conditions.stabilized = !draft.conditions.stabilized })}>Estabilizado</button>
                  <button className={`chip${character.conditions.overloaded ? ' chip--active' : ''}`} onClick={() => patch((draft) => { draft.conditions.overloaded = !draft.conditions.overloaded })}>Sobrecarregado</button>
                </div>
                {condition?.notes.length ? (
                  <p className="hint">Penalties on a Corpo test now: {condition.notes.join(' · ')}</p>
                ) : (
                  <p className="hint">No condition penalties on a Corpo test.</p>
                )}
              </Card>

              <Card title="Damage & recovery" subtitle="Quick bookkeeping; armor reduction applies to incoming damage.">
                <div className="field-grid">
                  <Field label="Amount">
                    <NumberInput
                      value={damageAmount}
                      min={0}
                      max={99}
                      onChange={(value) => setDamageAmount(Math.max(0, Math.round(value)))}
                    />
                  </Field>
                  <Field label="Armor reduction">
                    <span className="mono">{character.armor.reduction}</span>
                  </Field>
                  <Field label="Damage taken">
                    <strong className="mono">{netDamage}</strong>
                  </Field>
                </div>
                <div className="btn-row">
                  <Button variant="danger" onClick={applySheetDamage}>Take {netDamage} damage</Button>
                  <Button onClick={healSheet}>Heal {Math.abs(Math.round(damageAmount))}</Button>
                  <Button onClick={restSheet}>Rest</Button>
                  <Button variant="subtle" onClick={() => patch((draft) => { draft.currentVitality = maxVitality })}>
                    Full heal
                  </Button>
                </div>
                <p className="hint">Rest restores Vitality, clears Fatigue and reduces Stress by 1.</p>
              </Card>

              <Card title="Skills" subtitle={`${CREATION_SKILL_POINTS} creation points · max 3 at creation`}>
                <div className={`budget${skillPointsSpent(character) > CREATION_SKILL_POINTS ? ' budget--over' : ''}`}>
                  <span>Skill points: {skillPointsSpent(character)} / {CREATION_SKILL_POINTS}</span>
                  <div className="budget__bar">
                    <span style={{ width: `${Math.min(100, (skillPointsSpent(character) / CREATION_SKILL_POINTS) * 100)}%` }} />
                  </div>
                </div>
                <div className="skill-table">
                  <div className="skill-row skill-row--head">
                    <span>Skill</span><span>Attr</span><span>Level</span><span>Pool</span><span />
                  </div>
                  {SKILLS.map((skill) => {
                    const level = character.skills[skill.id] ?? 0
                    const spec = specializationFor(character, skill.id)
                    const pool = character.attributes[skill.attribute] + level + (spec ? 1 : 0)
                    return (
                      <div key={skill.id} className="skill-row">
                        <span className="skill-name" title={skill.hint}>
                          {skill.name}
                          {spec ? <Badge tone="info">+1</Badge> : null}
                        </span>
                        <span className="mono muted">{ATTRIBUTE_LABELS[skill.attribute].slice(0, 3).toUpperCase()}</span>
                        <span className="skill-level">
                          <NumberInput
                            value={level}
                            min={0}
                            max={5}
                            onChange={(value) =>
                              patch((draft) => {
                                draft.skills[skill.id] = Math.min(5, Math.max(0, Math.round(value)))
                              })
                            }
                          />
                        </span>
                        <span className="mono">{pool}</span>
                        <Button
                          small
                          onClick={() => {
                            setSourceKind('skill')
                            setSkillId(skill.id)
                            setTab('rolls')
                            rollWith({ kind: 'skill', id: skill.id }, skill.name)
                          }}
                        >
                          Roll
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <Field label="Saber area" hint="Ciências, Humanas or Técnica">
                  <TextInput value={character.saberArea} onChange={(value) => patch((draft) => { draft.saberArea = value })} />
                </Field>
              </Card>

              <Card title="Specializations" subtitle="+1 die when the specialization applies">
                {character.specializations.length === 0 ? <Empty>No specializations.</Empty> : null}
                <div className="stack">
                  {character.specializations.map((spec, index) => (
                    <div key={spec.id} className="spec-row">
                      <Select
                        value={spec.skillId}
                        options={SKILLS.map((skill) => ({ value: skill.id, label: skill.name }))}
                        onChange={(value) =>
                          patch((draft) => {
                            const entry = draft.specializations[index]
                            if (entry) entry.skillId = value
                          })
                        }
                      />
                      <TextInput
                        value={spec.name}
                        onChange={(value) =>
                          patch((draft) => {
                            const entry = draft.specializations[index]
                            if (entry) entry.name = value
                          })
                        }
                        placeholder="e.g. Pistolas"
                      />
                      <button
                        className="icon-btn"
                        aria-label="Remove specialization"
                        onClick={() => patch((draft) => { draft.specializations.splice(index, 1) })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  small
                  onClick={() =>
                    patch((draft) => {
                      draft.specializations.push({ id: uid('spec'), skillId: 'luta', name: '' })
                    })
                  }
                >
                  + Specialization
                </Button>
              </Card>
            </div>

            <div className="stack">
              <Card title="Combat gear" subtitle="Weapon, armor, kit and load">
                <div className="field-grid">
                  <Field label="Weapon">
                    <TextInput value={character.weapon.name} onChange={(value) => patch((draft) => { draft.weapon.name = value })} />
                  </Field>
                  <Field label="Damage" hint="1–5">
                    <NumberInput value={character.weapon.damage} min={0} max={5} onChange={(value) => patch((draft) => { draft.weapon.damage = Math.min(5, Math.max(0, Math.round(value))) })} />
                  </Field>
                  <Field label="Weapon zone">
                    <Select
                      value={character.weapon.zone}
                      options={ZONES.map((zone) => ({ value: zone.id, label: zone.label }))}
                      onChange={(value) => patch((draft) => { draft.weapon.zone = value as Zone })}
                    />
                  </Field>
                  <Field label="Armor">
                    <TextInput value={character.armor.name} onChange={(value) => patch((draft) => { draft.armor.name = value })} />
                  </Field>
                  <Field label="Reduction" hint="0–4">
                    <NumberInput value={character.armor.reduction} min={0} max={4} onChange={(value) => patch((draft) => { draft.armor.reduction = Math.min(4, Math.max(0, Math.round(value))) })} />
                  </Field>
                </div>
                <div className="field-grid">
                  <Field label="Kit">
                    <TextInput value={character.kit} onChange={(value) => patch((draft) => { draft.kit = value })} />
                  </Field>
                  <Field label="Other gear" wide>
                    <TextInput value={character.otherGear} onChange={(value) => patch((draft) => { draft.otherGear = value })} />
                  </Field>
                </div>
                <div className="load-grid">
                  {(['weapon', 'armor', 'kit', 'other'] as const).map((key) => (
                    <Field key={key} label={`${key} spaces`}>
                      <NumberInput
                        value={character.load[key]}
                        min={0}
                        max={20}
                        onChange={(value) =>
                          patch((draft) => {
                            draft.load[key] = Math.max(0, Math.round(value))
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
                <div className={`callout ${load > inventory ? 'callout--warn' : 'callout--info'}`}>
                  Load <strong>{fmtNum(load)}</strong> / {fmtNum(inventory)} spaces
                  {load > inventory ? ' — over capacity, mark Sobrecarregado for −1 physical dice.' : ''}
                </div>
              </Card>

              <Card title="Traits" subtitle="Advantages (cap 5) and disadvantages (max 3)">
                <div className="trait-columns">
                  <div>
                    <h4 className="subhead">Vantagens · {character.advantages.length} / 5</h4>
                    {character.advantages.map((advantage, index) => (
                      <div key={index} className="trait-row">
                        <TextInput
                          value={advantage}
                          onChange={(value) => patch((draft) => { draft.advantages[index] = value })}
                        />
                        <button className="icon-btn" aria-label="Remove advantage" onClick={() => patch((draft) => { draft.advantages.splice(index, 1) })}>×</button>
                      </div>
                    ))}
                    <Button small onClick={() => patch((draft) => { draft.advantages.push('') })}>+ Advantage</Button>
                  </div>
                  <div>
                    <h4 className="subhead">Desvantagens · {character.disadvantages.length} / 3</h4>
                    {character.disadvantages.map((disadvantage, index) => (
                      <div key={index} className="trait-row">
                        <TextInput
                          value={disadvantage}
                          onChange={(value) => patch((draft) => { draft.disadvantages[index] = value })}
                        />
                        <button className="icon-btn" aria-label="Remove disadvantage" onClick={() => patch((draft) => { draft.disadvantages.splice(index, 1) })}>×</button>
                      </div>
                    ))}
                    <Button small onClick={() => patch((draft) => { draft.disadvantages.push('') })}>+ Disadvantage</Button>
                  </div>
                </div>
                <p className="hint">
                  3 free advantage points; each disadvantage grants +1 more, up to 5 advantages. {character.disadvantages.length > 3 ? 'Too many disadvantages.' : ''}
                </p>
              </Card>

              <Card title="Social resources" subtitle="Official sheet · page 2">
                <div className="field-grid">
                  <Field label="Temporary wealth" hint="0–4">
                    <NumberInput value={character.tempWealth} min={0} max={4} onChange={(value) => patch((draft) => { draft.tempWealth = Math.min(4, Math.max(0, Math.round(value))) })} />
                  </Field>
                  <Field label="Leverage / dossier" wide>
                    <TextInput value={character.leverage} onChange={(value) => patch((draft) => { draft.leverage = value })} />
                  </Field>
                  <Field label="Contracts / promises" wide>
                    <TextInput value={character.contracts} onChange={(value) => patch((draft) => { draft.contracts = value })} />
                  </Field>
                </div>
              </Card>

              <Card title="Modules & campaign" subtitle="Magic, cybernetics, bonds, base and domain">
                <div className="field-grid">
                  <Field label="Mística level">
                    <NumberInput value={character.mysticLevel} min={0} max={5} onChange={(value) => patch((draft) => { draft.mysticLevel = Math.min(5, Math.max(0, Math.round(value))) })} />
                  </Field>
                  <Field label="Implants used" hint={`limit ${Math.max(0, character.attributes.corpo - 1)}`}>
                    <NumberInput value={character.implantsUsed} min={0} max={10} onChange={(value) => patch((draft) => { draft.implantsUsed = Math.max(0, Math.round(value)) })} />
                  </Field>
                  <Field label="Base level" hint="0–3">
                    <NumberInput value={character.baseLevel} min={0} max={3} onChange={(value) => patch((draft) => { draft.baseLevel = Math.min(3, Math.max(0, Math.round(value))) })} />
                  </Field>
                  <Field label="Domain power" hint="0–4">
                    <NumberInput value={character.domainLevel} min={0} max={4} onChange={(value) => patch((draft) => { draft.domainLevel = Math.min(4, Math.max(0, Math.round(value))) })} />
                  </Field>
                  <Field label="Food reserve" hint="0–4 · 0 = +1 Fatigue/day">
                    <NumberInput value={character.foodReserve} min={0} max={4} onChange={(value) => patch((draft) => { draft.foodReserve = Math.min(4, Math.max(0, Math.round(value))) })} />
                  </Field>
                </div>
                {character.implantsUsed > Math.max(0, character.attributes.corpo - 1) ? (
                  <p className="callout callout--warn">Implant limit exceeded: maximum is Corpo − 1 ({Math.max(0, character.attributes.corpo - 1)}).</p>
                ) : null}

                <h4 className="subhead">Laços · max {character.attributes.presenca + 1}</h4>
                {character.bonds.map((bond, index) => (
                  <div key={bond.id} className="bond-row">
                    <TextInput
                      value={bond.name}
                      placeholder="Bond name"
                      onChange={(value) => patch((draft) => { const entry = draft.bonds[index]; if (entry) entry.name = value })}
                    />
                    <NumberInput
                      value={bond.value}
                      min={0}
                      max={3}
                      onChange={(value) => patch((draft) => { const entry = draft.bonds[index]; if (entry) entry.value = Math.min(3, Math.max(0, Math.round(value))) })}
                    />
                    <TextInput
                      value={bond.note}
                      placeholder="Favor / debt"
                      onChange={(value) => patch((draft) => { const entry = draft.bonds[index]; if (entry) entry.note = value })}
                    />
                    <button className="icon-btn" aria-label="Remove bond" onClick={() => patch((draft) => { draft.bonds.splice(index, 1) })}>×</button>
                  </div>
                ))}
                <Button
                  small
                  onClick={() =>
                    patch((draft) => {
                      draft.bonds.push({ id: uid('bond'), name: '', value: 1, note: '' })
                    })
                  }
                >
                  + Bond
                </Button>
              </Card>

              <Card title="Notes">
                <textarea
                  className="textarea"
                  rows={4}
                  value={character.notes}
                  onChange={(event) => patch((draft) => { draft.notes = event.target.value })}
                />
              </Card>
            </div>
          </div>
        ) : null}

        {tab === 'rolls' ? (
          <div className="stack">
            <Card
              title="Roll a Pulso test"
              subtitle="Uses this sheet's pool and applies conditions, fatigue, stress and specializations automatically."
              actions={<Badge tone={project.dice.criticalSuccess ? 'ok' : 'raw'}>{project.dice.criticalSuccess ? '6 = 2 successes' : 'critical success off'}</Badge>}
            >
              <div className="field-grid">
                <Field label="Test source">
                  <Select
                    value={sourceKind}
                    options={[
                      { value: 'skill', label: 'Skill' },
                      { value: 'attribute', label: 'Raw attribute' },
                      { value: 'willpower', label: 'Vontade (derived)' },
                    ]}
                    onChange={(value) => setSourceKind(value as typeof sourceKind)}
                  />
                </Field>
                {sourceKind === 'skill' ? (
                  <Field label="Skill">
                    <Select
                      value={skillId}
                      options={SKILLS.map((skill) => ({ value: skill.id, label: `${skill.name} · ${ATTRIBUTE_LABELS[skill.attribute]}` }))}
                      onChange={setSkillId}
                    />
                  </Field>
                ) : null}
                {sourceKind === 'attribute' ? (
                  <Field label="Attribute">
                    <Select
                      value={attribute}
                      options={ATTRIBUTE_KEYS.map((key) => ({ value: key, label: ATTRIBUTE_LABELS[key] }))}
                      onChange={(value) => setAttribute(value as AttributeKey)}
                    />
                  </Field>
                ) : null}
                <Field
                  label="Difficulty"
                  hint={
                    target && attackSource(source)
                      ? `auto: ${target.defense} (target Defense)`
                      : DIFFICULTIES.find((entry) => entry.value === difficulty)?.label
                  }
                >
                  <Select
                    value={String(difficulty)}
                    options={DIFFICULTIES.map((entry) => ({ value: String(entry.value), label: `${entry.value} · ${entry.label}` }))}
                    onChange={(value) => setDifficulty(Number(value))}
                  />
                </Field>
                <Field
                  label="Target"
                  hint={target ? `Def ${target.defense} · red ${target.reduction}` : 'optional — auto-sets attack difficulty'}
                >
                  <Select
                    value={targetId}
                    options={[
                      { value: 'none', label: 'No target' },
                      ...project.combat.combatants.map((entry) => ({
                        value: entry.id,
                        label: `${entry.name} · Def ${entry.defense}`,
                      })),
                    ]}
                    onChange={setTargetId}
                  />
                </Field>
                <Field label="Situational dice" hint="Aim +2, cover −1, fatigue is automatic">
                  <NumberInput value={modifier} min={-5} max={5} onChange={(value) => setModifier(Math.max(-5, Math.min(5, Math.round(value))))} />
                </Field>
              </div>

              {poolInfo ? (
                <div className="pool-preview">
                  <div>
                    <span className="field__label">Pool</span>
                    <strong>{poolInfo.pool} dice</strong>
                  </div>
                  <div className="pool-breakdown">
                    {poolInfo.breakdown.map((row, index) => (
                      <span key={index} className={row.value < 0 ? 'text--warn' : undefined}>
                        {row.label} {row.value >= 0 ? '+' : ''}{row.value}
                      </span>
                    ))}
                  </div>
                  {odds ? (
                    <div className="pool-odds">
                      <span>Success <strong>{fmtPct(odds.success)}</strong></span>
                      {odds.partial > 0.0005 ? <span>Partial <strong>{fmtPct(odds.partial)}</strong></span> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="btn-row">
                <Button variant="primary" onClick={() => rollWith(source)}>Roll test</Button>
                <Button
                  small
                  onClick={() => {
                    setSourceKind('willpower')
                    rollWith({ kind: 'willpower' }, 'Vontade')
                  }}
                >
                  Roll Vontade
                </Button>
                <Button
                  small
                  onClick={() => {
                    setSourceKind('attribute')
                    setAttribute('corpo')
                    rollWith({ kind: 'attribute', id: 'corpo' }, 'Corpo')
                  }}
                >
                  Roll Corpo
                </Button>
              </div>

              {lastRoll ? (
                <div className={`roll-result roll-result--${lastRoll.outcome}`}>
                  <div className="roll-result__head">
                    <div>
                      <span className="field__label">{lastRoll.label}</span>
                      <h3>
                        {lastRoll.outcome === 'success' ? 'Success' : lastRoll.outcome === 'partial' ? 'Partial success' : lastRoll.outcome === 'blocked' ? 'Cannot act' : lastRoll.crit ? 'Critical failure' : 'Failure'}
                      </h3>
                    </div>
                    <Badge tone={lastRoll.outcome === 'success' ? 'ok' : lastRoll.outcome === 'partial' ? 'warn' : 'bad'}>
                      {lastRoll.successes} vs {lastRoll.difficulty}
                    </Badge>
                  </div>
                  <div className="dice-faces">
                    {lastRoll.faces.map((face, index) => (
                      <span
                        key={index}
                        className={`die${face >= 4 ? ' die--success' : ''}${face === 1 ? ' die--one' : ''}`}
                        title={face === 6 ? '6 — critical (2 successes)' : face >= 4 ? 'success' : 'failure'}
                      >
                        {face}
                      </span>
                    ))}
                    {lastRoll.faces.length === 0 ? <span className="muted">No dice rolled.</span> : null}
                  </div>
                  <div className="roll-result__meta">
                    <span>Pool {lastRoll.pool}</span>
                    <span>
                      {lastRoll.excess >= 0
                        ? `${lastRoll.excess} excess success${lastRoll.excess === 1 ? '' : 'es'}`
                        : `${Math.abs(lastRoll.excess)} short`}
                    </span>
                    {lastRoll.crit ? <span className="text--warn">Two 1s — critical failure</span> : null}
                    {lastRoll.damage !== null ? (
                      <span>
                        Damage {lastRoll.damage} {lastRoll.targetName ? 'after reduction' : 'before reduction'}
                      </span>
                    ) : null}
                    {lastRoll.targetName ? <span>Target: {lastRoll.targetName}</span> : null}
                  </div>
                  {lastRoll.targetSheetId && lastRoll.damage !== null ? (
                    lastRoll.applied ? (
                      <Badge tone="warn">Damage applied to {lastRoll.targetName}</Badge>
                    ) : (
                      <div className="btn-row" style={{ marginTop: 8 }}>
                        <Button small variant="danger" onClick={applyRollDamage}>
                          Apply {lastRoll.damage} damage to {lastRoll.targetName}
                        </Button>
                      </div>
                    )
                  ) : null}
                  {lastRoll.outcome === 'partial' ? (
                    <p className="hint">Fail by one: the GM grants success with a complication.</p>
                  ) : null}
                  {lastRoll.notes.length ? <p className="hint">Applied: {lastRoll.notes.join(' · ')}</p> : null}
                </div>
              ) : (
                <Empty>Pick a source and roll. Results show every die face and the exact margin.</Empty>
              )}
            </Card>

            <Card title="Roll history" subtitle="Last 10 tests in this session">
              {history.length === 0 ? <Empty>No rolls yet.</Empty> : null}
              <div className="table-wrap">
                <table className="table table--compact">
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.label}</td>
                        <td className="mono">pool {entry.pool}</td>
                        <td className="mono">{entry.successes} vs {entry.difficulty}</td>
                        <td>
                          <Badge tone={entry.outcome === 'success' ? 'ok' : entry.outcome === 'partial' ? 'warn' : 'bad'}>
                            {entry.outcome === 'blocked' ? 'blocked' : entry.outcome}
                          </Badge>
                        </td>
                        <td className="mono muted">{new Date(entry.time).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="What is applied automatically">
              <ul className="bullets">
                <li>Attribute + skill level from this sheet, plus +1 when a matching specialization exists.</li>
                <li>Condition: Ferido −1, Grave −2, Caído cannot act; Fatigue and Stress penalties stack by their rules.</li>
                <li>Sobrecarregado −1 on Corpo/Agilidade tests.</li>
                <li>Table resolution from the Resolution panel: success faces, critical success and partial success.</li>
                <li>Attack rolls (Luta/Atirar) also report weapon damage plus excess successes before reduction.</li>
              </ul>
            </Card>
          </div>
        ) : null}

        {tab === 'formulas' ? (
          <div className="stack">
            <Card
              title="Derived formulas"
              subtitle="Edit the math directly — no code changes. Formulas are saved with the project."
              actions={<Button small variant="danger" onClick={resetFormulas}>Reset all to official</Button>}
            >
              <div className="formula-table">
                <div className="formula-row formula-row--head">
                  <span>Value</span><span>Formula</span><span>Preview</span><span />
                </div>
                {formulas.map((formula) => {
                  const error = evaluation.errors[formula.id]
                  return (
                    <div key={formula.id} className="formula-row">
                      <TextInput
                        value={formula.label}
                        onChange={(value) => updateFormula(formula.id, { label: value })}
                      />
                      <TextInput
                        value={formula.expression}
                        mono
                        onChange={(value) => updateFormula(formula.id, { expression: value })}
                      />
                      <span className={`mono ${error ? 'text--warn' : ''}`} title={error ?? ''}>
                        {error ? '⚠ invalid' : fmtNum(evaluation.values[formula.id] ?? 0)}
                      </span>
                      <span className="formula-actions">
                        <span className="mono muted">{formula.id}</span>
                        {!formula.builtin ? (
                          <button
                            className="icon-btn"
                            aria-label={`Delete ${formula.label}`}
                            onClick={() =>
                              update((draft) => {
                                draft.derivedFormulas = draft.derivedFormulas.filter((entry) => entry.id !== formula.id)
                              })
                            }
                          >
                            ×
                          </button>
                        ) : null}
                      </span>
                    </div>
                  )
                })}
              </div>
              {Object.entries(evaluation.errors).map(([id, message]) => (
                <p key={id} className="callout callout--bad">
                  {formulasById.get(id)?.label ?? id}: {message}
                </p>
              ))}
              <Button
                small
                onClick={() =>
                  update((draft) => {
                    let index = draft.derivedFormulas.length + 1
                    while (draft.derivedFormulas.some((formula) => formula.id === `custom_${index}`)) index++
                    draft.derivedFormulas.push({
                      id: `custom_${index}`,
                      label: `Custom value ${index}`,
                      expression: 'corpo',
                      builtin: false,
                    })
                  })
                }
              >
                + Custom derived value
              </Button>
            </Card>

            <Card title="Formula reference">
              <div className="split-2">
                <div>
                  <h4 className="subhead">Variables</h4>
                  <div className="chips">
                    {FORMULA_VARIABLES.map((variable) => (
                      <Badge key={variable} tone="raw">{variable}</Badge>
                    ))}
                    {formulas.map((formula) => (
                      <Badge key={formula.id} tone="info">{formula.id}</Badge>
                    ))}
                  </div>
                  <p className="hint">Formulas can reference other derived values; dependency order is resolved automatically.</p>
                </div>
                <div>
                  <h4 className="subhead">Functions</h4>
                  <div className="chips">
                    {FORMULA_FUNCTIONS.map((fn) => (
                      <Badge key={fn} tone="crafted">{fn}()</Badge>
                    ))}
                  </div>
                  <p className="hint">Operators: + − * / % ^ and parentheses. Example: <code>5 + corpo * 2</code> or <code>floor(agilidade / 2) + 2</code>.</p>
                </div>
              </div>
              <Callout tone="info" title="Official defaults">
                Vitalidade = 5 + Corpo×2 · Iniciativa = Agi+Mente · Defesa = Agilidade · Vontade = Presença+Mente · Espaços = Corpo+3.
                Edit any of them here; the sheet, rolls and encounter sync all read the current expressions.
              </Callout>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}
