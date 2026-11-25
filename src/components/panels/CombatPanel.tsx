import { useMemo, useState } from 'react'
import { useProject } from '../../store/project'
import { matchupMatrix, runCombat, threatReport } from '../../lib/engine/combat'
import { sheetToCombatant } from '../../lib/engine/character'
import {
  ARCHETYPES,
  COMPLICATIONS,
  ENCOUNTER_KINDS,
  SUBTYPES,
  TRICKS,
  ZONES,
  buildEnemy,
  trickLabel,
  zoneLabel,
} from '../../lib/pulso'
import { fmtNum, fmtPct, uid } from '../../lib/format'
import { BarChart } from '../charts'
import { Badge, Button, Card, Empty, Field, NumberInput, Select, Stat, TextInput } from '../ui'
import type {
  Archetype,
  Combatant,
  EncounterKind,
  TrickId,
  Zone,
} from '../../lib/types'

const zoneOptions = ZONES.map((zone) => ({ value: zone.id, label: zone.label }))

function TrickPicker({
  tricks,
  onChange,
  limit,
}: {
  tricks: TrickId[]
  onChange: (tricks: TrickId[]) => void
  limit?: number
}) {
  return (
    <div className="chips">
      <span className="field__label">
        Tricks{limit !== undefined ? ` ${tricks.length}/${limit}` : ''}
      </span>
      {TRICKS.map((trick) => {
        const active = tricks.includes(trick.id)
        return (
          <button
            key={trick.id}
            type="button"
            title={trick.description}
            className={`chip${active ? ' chip--active' : ''}`}
            onClick={() =>
              onChange(active ? tricks.filter((id) => id !== trick.id) : [...tricks, trick.id])
            }
          >
            {trick.label}
          </button>
        )
      })}
    </div>
  )
}

function CombatantCard({
  fighter,
  onChange,
  onRemove,
  onDuplicate,
}: {
  fighter: Combatant
  onChange: (patch: Partial<Combatant>) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  return (
    <div className={`fighter fighter--${fighter.side}`}>
      <div className="fighter__head">
        <TextInput value={fighter.name} onChange={(value) => onChange({ name: value })} />
        {fighter.side === 'foe' ? (
          <Badge tone={fighter.threat >= 3 ? 'bad' : fighter.threat >= 2 ? 'warn' : 'info'}>
            Threat {fighter.threat}
          </Badge>
        ) : null}
        {fighter.sheetId ? <Badge tone="ok">sheet</Badge> : null}
        <button className="icon-btn" title="Duplicate" aria-label={`Duplicate ${fighter.name}`} onClick={onDuplicate}>
          ⧉
        </button>
        <button className="icon-btn" title="Remove" aria-label={`Remove ${fighter.name}`} onClick={onRemove}>
          ×
        </button>
      </div>
      <div className="fighter__grid">
        <Field label="Pool" hint="attack dice">
          <NumberInput value={fighter.pool} min={1} max={20} onChange={(value) => onChange({ pool: Math.max(1, Math.round(value)) })} />
        </Field>
        <Field label="Defense">
          <NumberInput value={fighter.defense} min={0} max={10} onChange={(value) => onChange({ defense: Math.max(0, Math.round(value)) })} />
        </Field>
        <Field label="Vitality">
          <NumberInput value={fighter.vitalityMax} min={1} onChange={(value) => onChange({ vitalityMax: Math.max(1, Math.round(value)) })} />
        </Field>
        <Field label="Reduction">
          <NumberInput value={fighter.reduction} min={0} max={10} onChange={(value) => onChange({ reduction: Math.max(0, Math.round(value)) })} />
        </Field>
        <Field label="Weapon dmg">
          <NumberInput value={fighter.damage} min={0} max={20} onChange={(value) => onChange({ damage: Math.max(0, Math.round(value)) })} />
        </Field>
        <Field label="Initiative">
          <NumberInput value={fighter.initiative} min={0} max={20} onChange={(value) => onChange({ initiative: Math.max(0, Math.round(value)) })} />
        </Field>
        <Field label="Weapon zone">
          <Select value={fighter.zone} options={zoneOptions} onChange={(value) => onChange({ zone: value as Zone })} />
        </Field>
        <Field label="Actions / turn">
          <NumberInput
            value={fighter.actionsPerTurn}
            min={1}
            max={4}
            onChange={(value) => onChange({ actionsPerTurn: Math.max(1, Math.round(value)) })}
          />
        </Field>
        {fighter.side === 'foe' ? (
          <Field label="Threat">
            <NumberInput value={fighter.threat} min={0} step={0.5} onChange={(value) => onChange({ threat: Math.max(0, value) })} />
          </Field>
        ) : null}
        <Field label="Archetype">
          <span className="muted">{fighter.archetype ? ARCHETYPES[fighter.archetype].label : 'PC'}</span>
        </Field>
      </div>
      <TrickPicker
        tricks={fighter.tricks}
        onChange={(tricks) => onChange({ tricks })}
        limit={fighter.archetype ? ARCHETYPES[fighter.archetype].tricks : undefined}
      />
    </div>
  )
}

function PcBuilder({ onAdd }: { onAdd: (fighter: Omit<Combatant, 'id' | 'side'>) => void }) {
  const [name, setName] = useState('New PC')
  const [corpo, setCorpo] = useState(3)
  const [agilidade, setAgilidade] = useState(3)
  const [mente, setMente] = useState(3)
  const [presenca, setPresenca] = useState(2)
  const [skill, setSkill] = useState(2)
  const [style, setStyle] = useState<'luta' | 'atirar'>('atirar')
  const [weapon, setWeapon] = useState(3)

  const attackAttribute = style === 'luta' ? corpo : agilidade
  const derived = {
    pool: attackAttribute + skill,
    defense: agilidade,
    vitalityMax: 5 + corpo * 2,
    initiative: agilidade + mente,
    zone: (style === 'luta' ? 'melee' : 'near') as Zone,
  }

  return (
    <div className="builder">
      <div className="builder__head">
        <h4 className="subhead">PC quick build</h4>
        <span className="hint">Vitalidade = 5 + Corpo×2 · Defesa = Agilidade · Iniciativa = Agi+Mente</span>
      </div>
      <div className="builder__grid">
        <Field label="Name">
          <TextInput value={name} onChange={setName} />
        </Field>
        <Field label="Corpo">
          <NumberInput value={corpo} min={1} max={5} onChange={setCorpo} />
        </Field>
        <Field label="Agilidade">
          <NumberInput value={agilidade} min={1} max={5} onChange={setAgilidade} />
        </Field>
        <Field label="Mente">
          <NumberInput value={mente} min={1} max={5} onChange={setMente} />
        </Field>
        <Field label="Presença">
          <NumberInput value={presenca} min={1} max={5} onChange={setPresenca} />
        </Field>
        <Field label="Skill level">
          <NumberInput value={skill} min={0} max={5} onChange={setSkill} />
        </Field>
        <Field label="Attack skill">
          <Select
            value={style}
            options={[
              { value: 'atirar', label: 'Atirar (Agilidade)' },
              { value: 'luta', label: 'Luta (Corpo)' },
            ]}
            onChange={(value) => setStyle(value === 'luta' ? 'luta' : 'atirar')}
          />
        </Field>
        <Field label="Weapon damage">
          <NumberInput value={weapon} min={1} max={5} onChange={setWeapon} />
        </Field>
      </div>
      <div className="builder__preview">
        <span>Pool <strong>{derived.pool}</strong></span>
        <span>Def <strong>{derived.defense}</strong></span>
        <span>Vit <strong>{derived.vitalityMax}</strong></span>
        <span>Init <strong>{derived.initiative}</strong></span>
        <span>Zone <strong>{zoneLabel(derived.zone)}</strong></span>
        <Button
          small
          variant="primary"
          onClick={() =>
            onAdd({
              name: name || 'New PC',
              pool: derived.pool,
              defense: derived.defense,
              vitalityMax: derived.vitalityMax,
              reduction: 1,
              damage: weapon,
              initiative: derived.initiative,
              actionsPerTurn: 1,
              zone: derived.zone,
              tricks: [],
              threat: 0,
            })
          }
        >
          Add PC
        </Button>
      </div>
      <p className="hint">Presença feeds Willpower / social resistance; it does not change combat numbers.</p>
    </div>
  )
}

function EnemyComposer({ onAdd }: { onAdd: (fighter: Omit<Combatant, 'id' | 'side'>) => void }) {
  const [archetype, setArchetype] = useState<Archetype>('capanga')
  const [subtypeId, setSubtypeId] = useState('none')
  const [name, setName] = useState('')
  const [weak, setWeak] = useState(false)
  const [reinforced, setReinforced] = useState(false)
  const [armor, setArmor] = useState(0)
  const [betterWeapon, setBetterWeapon] = useState(false)
  const [many, setMany] = useState(false)
  const [alone, setAlone] = useState(false)

  const preview = buildEnemy({
    archetype,
    subtypeId,
    name: name || ARCHETYPES[archetype].label,
    weak,
    reinforced,
    armor: armor > 0 ? armor : undefined,
    betterWeapon,
    many,
    alone,
  })

  return (
    <div className="builder">
      <div className="builder__head">
        <h4 className="subhead">Enemy composer</h4>
        <span className="hint">{ARCHETYPES[archetype].note}</span>
      </div>
      <div className="builder__grid">
        <Field label="Archetype">
          <Select
            value={archetype}
            options={(Object.keys(ARCHETYPES) as Archetype[]).map((id) => ({
              value: id,
              label: `${ARCHETYPES[id].label} · Threat ${ARCHETYPES[id].threat}`,
            }))}
            onChange={(value) => {
              setArchetype(value as Archetype)
              setSubtypeId('none')
              setName('')
            }}
          />
        </Field>
        <Field label="Subtype">
          <Select
            value={subtypeId}
            options={SUBTYPES[archetype].map((subtype) => ({ value: subtype.id, label: subtype.label }))}
            onChange={setSubtypeId}
          />
        </Field>
        <Field label="Name">
          <TextInput value={name} onChange={setName} placeholder={ARCHETYPES[archetype].label} />
        </Field>
        <Field label="Armor reduction">
          <NumberInput value={armor} min={0} max={4} onChange={setArmor} />
        </Field>
      </div>
      <div className="chips">
        <button className={`chip${weak ? ' chip--active' : ''}`} onClick={() => setWeak(!weak)}>
          Fraco (−1 Threat)
        </button>
        <button className={`chip${reinforced ? ' chip--active' : ''}`} onClick={() => setReinforced(!reinforced)}>
          Reforçado (+1 Threat)
        </button>
        <button className={`chip${betterWeapon ? ' chip--active' : ''}`} onClick={() => setBetterWeapon(!betterWeapon)}>
          Better weapon (+1 dmg)
        </button>
        <button className={`chip${many ? ' chip--active' : ''}`} onClick={() => setMany(!many)}>
          Many (+1 pool, −1 Def)
        </button>
        <button className={`chip${alone ? ' chip--active' : ''}`} onClick={() => setAlone(!alone)}>
          Alone (+1 Vit, +1 Def)
        </button>
      </div>
      <div className="builder__preview">
        <span>Threat <strong>{preview.threat}</strong></span>
        <span>Pool <strong>{preview.pool}</strong></span>
        <span>Def <strong>{preview.defense}</strong></span>
        <span>Vit <strong>{preview.vitalityMax}</strong></span>
        <span>Red <strong>{preview.reduction}</strong></span>
        <span>Dmg <strong>{preview.damage}</strong></span>
        <span>Zone <strong>{zoneLabel(preview.zone)}</strong></span>
        {preview.tricks.map((trick) => (
          <Badge key={trick} tone="info">
            {trickLabel(trick)}
          </Badge>
        ))}
        <Button small variant="primary" onClick={() => onAdd(preview)}>
          Add enemy
        </Button>
      </div>
    </div>
  )
}

export default function CombatPanel() {
  const { project, update } = useProject()
  const cfg = project.combat
  const result = useMemo(() => runCombat(cfg), [cfg])
  const threat = useMemo(() => threatReport(cfg), [cfg])
  const matchups = useMemo(() => matchupMatrix(cfg), [cfg])

  const allies = cfg.combatants.filter((fighter) => fighter.side === 'ally')
  const foes = cfg.combatants.filter((fighter) => fighter.side === 'foe')
  const alliesUp = allies.filter((fighter) => fighter.vitalityMax > 0)
  const nearestDelta = threat.targets.find((band) => band.id === threat.nearest.id)?.delta ?? 0

  const patchCombat = (mutate: (draft: typeof cfg) => void) => update((draft) => mutate(draft.combat))
  const patchCombatant = (id: string, patch: Partial<Combatant>) =>
    patchCombat((combat) => {
      const fighter = combat.combatants.find((entry) => entry.id === id)
      if (fighter) Object.assign(fighter, patch)
    })

  const addCombatant = (fighter: Omit<Combatant, 'id' | 'side'>, side: 'ally' | 'foe') =>
    patchCombat((combat) => {
      combat.combatants.push({ ...fighter, id: uid('fighter'), side } as Combatant)
    })

  const removeCombatant = (id: string) =>
    patchCombat((combat) => {
      combat.combatants = combat.combatants.filter((entry) => entry.id !== id)
    })

  const partyFromSheets = (mode: 'replace' | 'add') => {
    if (!project.characters.length) return
    if (
      mode === 'replace' &&
      allies.length &&
      !window.confirm('Replace the current party with your character sheets?')
    ) {
      return
    }
    patchCombat((combat) => {
      const fighters = project.characters.map((sheet) => ({
        ...sheetToCombatant(sheet, project.derivedFormulas),
        id: uid('fighter'),
        side: 'ally' as const,
        sheetId: sheet.id,
      }))
      combat.combatants =
        mode === 'replace'
          ? [...fighters, ...combat.combatants.filter((entry) => entry.side === 'foe')]
          : [...combat.combatants, ...fighters]
    })
  }

  const duplicateCombatant = (id: string) =>
    patchCombat((combat) => {
      const source = combat.combatants.find((entry) => entry.id === id)
      if (source) {
        combat.combatants.push({ ...structuredClone(source), id: uid('fighter'), name: `${source.name} copy` })
      }
    })

  const rollComplication = () => {
    const complication = COMPLICATIONS[Math.floor(Math.random() * COMPLICATIONS.length)]
    patchCombat((combat) => {
      combat.meta.complication = complication
    })
  }

  const matrix = (attackers: Combatant[], defenders: Combatant[]) => (
    <div className="table-wrap">
      <table className="table table--compact matrix">
        <thead>
          <tr>
            <th>Attacker</th>
            {defenders.map((target) => (
              <th key={target.id} className="right">
                {target.name}
                <span className="muted"> · Def {target.defense}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attackers.map((attacker) => (
            <tr key={attacker.id}>
              <td>
                {attacker.name}
                <span className="muted"> · pool {attacker.pool}{attacker.zone !== 'near' ? ` · ${zoneLabel(attacker.zone)}` : ''}</span>
              </td>
              {defenders.map((target) => {
                const row = matchups.find(
                  (entry) => entry.attackerId === attacker.id && entry.targetId === target.id,
                )
                return (
                  <td key={target.id} className="right mono">
                    {row ? (
                      <>
                        {fmtPct(row.hitChance, 0)}
                        <span className="muted"> · {row.avgDamage.toFixed(1)} dmg</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="stack">
      <Card
        title="Encounter brief"
        subtitle="Every encounter needs an objective, an obstacle and a consequence."
        actions={
          <>
            <Button
              small
              onClick={() =>
                patchCombat((combat) => {
                  combat.seed = Math.floor(Math.random() * 100000)
                })
              }
            >
              Randomize seed
            </Button>
            <Button small onClick={rollComplication}>
              Roll escalation (d6)
            </Button>
          </>
        }
      >
        <div className="field-grid">
          <Field label="Title">
            <TextInput
              value={cfg.meta.title}
              onChange={(value) =>
                patchCombat((combat) => {
                  combat.meta.title = value
                })
              }
            />
          </Field>
          <Field label="Encounter type">
            <Select
              value={cfg.meta.kind}
              options={ENCOUNTER_KINDS.map((kind) => ({ value: kind.id, label: kind.label }))}
              onChange={(value) =>
                patchCombat((combat) => {
                  combat.meta.kind = value as EncounterKind
                })
              }
            />
          </Field>
          <Field label="Starting zone">
            <Select
              value={cfg.meta.startZone}
              options={zoneOptions}
              onChange={(value) =>
                patchCombat((combat) => {
                  combat.meta.startZone = value as Zone
                })
              }
            />
          </Field>
          <Field label="Iterations">
            <NumberInput
              value={cfg.iterations}
              min={10}
              max={20000}
              step={100}
              onChange={(value) => patchCombat((combat) => { combat.iterations = Math.max(10, Math.round(value)) })}
            />
          </Field>
          <Field label="Max rounds" hint="3–6 is the system target">
            <NumberInput
              value={cfg.maxRounds}
              min={1}
              max={100}
              onChange={(value) => patchCombat((combat) => { combat.maxRounds = Math.max(1, Math.round(value)) })}
            />
          </Field>
          <Field label="Seed">
            <NumberInput
              value={cfg.seed}
              onChange={(value) => patchCombat((combat) => { combat.seed = Math.round(value) })}
            />
          </Field>
          <Field label="Critical success" hint="6 counts as 2 successes">
            <Select
              value={cfg.criticalSuccess ? 'on' : 'off'}
              options={[
                { value: 'on', label: 'On (optional rule)' },
                { value: 'off', label: 'Off' },
              ]}
              onChange={(value) => patchCombat((combat) => { combat.criticalSuccess = value === 'on' })}
            />
          </Field>
          <Field label="Attack downed foes" hint="Caído can be hit again → Morrendo">
            <Select
              value={cfg.finishDowned ? 'on' : 'off'}
              options={[
                { value: 'off', label: 'No — stop at Caído' },
                { value: 'on', label: 'Yes — finish them' },
              ]}
              onChange={(value) => patchCombat((combat) => { combat.finishDowned = value === 'on' })}
            />
          </Field>
        </div>
        <div className="field-grid">
          <Field label="Objective" wide>
            <TextInput
              value={cfg.meta.objective}
              onChange={(value) => patchCombat((combat) => { combat.meta.objective = value })}
            />
          </Field>
          <Field label="Obstacle" wide>
            <TextInput
              value={cfg.meta.obstacle}
              onChange={(value) => patchCombat((combat) => { combat.meta.obstacle = value })}
            />
          </Field>
          <Field label="Consequence of failure" wide>
            <TextInput
              value={cfg.meta.consequence}
              onChange={(value) => patchCombat((combat) => { combat.meta.consequence = value })}
            />
          </Field>
        </div>
        <div className="callout callout--info">
          <strong>Escalation (d6)</strong>
          <span>{cfg.meta.complication || 'No complication rolled yet — roll one for the start of Act 2.'}</span>
        </div>
      </Card>

      <div className="split-2">
        <Card title="Threat budget" subtitle="Total threat of the opposition against party size.">
          <div className="stats">
            <Stat label="Party size" value={threat.partySize} sub="PCs in the encounter" />
            <Stat label="Total threat" value={fmtNum(threat.totalThreat, 1)} sub={`${foes.length} enemies`} />
            <Stat
              label="Nearest band"
              value={threat.nearest.label}
              sub={`target ${fmtNum(threat.nearest.target, 1)}`}
              tone={threat.nearest.id === 'lethal' || threat.nearest.id === 'terror' ? 'bad' : undefined}
            />
            <Stat label="Verdict" value={nearestDelta === 0 ? 'On target' : nearestDelta > 0 ? `+${fmtNum(nearestDelta, 1)} over` : `${fmtNum(nearestDelta, 1)} under`} sub="vs nearest band" />
          </div>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Difficulty</th>
                  <th className="right">Target</th>
                  <th className="right">Delta</th>
                </tr>
              </thead>
              <tbody>
                {threat.targets.map((band) => (
                  <tr key={band.id} className={band.id === threat.nearest.id ? 'row--highlight' : undefined}>
                    <td>{band.label}</td>
                    <td className="right mono">{fmtNum(band.target, 1)}</td>
                    <td className={`right mono ${band.delta > 0 ? 'text--warn' : band.delta < 0 ? 'text--muted' : ''}`}>
                      {band.delta === 0 ? 'on target' : `${band.delta > 0 ? '+' : ''}${fmtNum(band.delta, 1)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {threat.warnings.length ? (
            <ul className="bullets">
              {threat.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">No calibration warnings.</p>
          )}
        </Card>

        <Card title="How the simulation reads Pulso" subtitle="Assumptions baked into the Monte Carlo run.">
          <ul className="bullets">
            <li>Pool = dice rolled; 4–6 = 1 success, optional 6 = 2 successes, cap 12 dice with +1 auto success per 2 extra.</li>
            <li>Attack: successes ≥ Defense hits; excess successes add to weapon damage.</li>
            <li>Damage: weapon + excess − single highest Reduction (min 0), then Vitality.</li>
            <li>States: 0 Vitality = Caído; a further hit = Morrendo; Vigor (3) at the start of its turn or death.</li>
            <li>Instant death: final damage ≥ Max Vitality + current Vitality (or ≥ Max Vitality at 0).</li>
            <li>Initiative is fixed (Agi+Mente) with a d6 tie-break; targets are chosen randomly.</li>
            <li>Zones: the melee line closes one zone per round; attacking outside the weapon's ideal zone costs −1/−2 dice.</li>
            <li>No healing or stabilization is modeled, so victory means the other side is down.</li>
            <li>With “attack downed foes” on, Caído targets can be hit again and become Morrendo; otherwise enemies only attack standing characters.</li>
          </ul>
        </Card>
      </div>

      {result.error ? <p className="callout callout--bad">{result.error}</p> : null}

      {!result.error ? (
        <>
          <div className="stats">
            <Stat
              label="Party win rate"
              value={fmtPct(result.allyWinRate)}
              sub={`${fmtNum(result.allyWins)} / ${fmtNum(result.iterations)}`}
              tone={result.allyWinRate > 0.5 ? 'good' : 'bad'}
            />
            <Stat
              label="Enemy win rate"
              value={fmtPct(result.foeWinRate)}
              sub={`${fmtNum(result.foeWins)} / ${fmtNum(result.iterations)}`}
              tone={result.foeWinRate > 0.5 ? 'bad' : undefined}
            />
            <Stat label="Avg rounds" value={result.avgRounds.toFixed(1)} sub={`target 3–6 · limit ${cfg.maxRounds}`} tone={result.avgRounds > 6 ? 'warn' : 'good'} />
            <Stat label="Party deaths" value={fmtNum(result.avgAllyDeaths, 2)} sub="per battle" tone={result.avgAllyDeaths > 0.5 ? 'bad' : undefined} />
            <Stat label="Enemy deaths" value={fmtNum(result.avgFoeDeaths, 2)} sub="per battle" />
            <Stat label="Timeouts" value={fmtPct(result.drawRate)} sub="hit round limit" />
          </div>

          <div className="winbar" aria-label="Win distribution">
            <span className="winbar__ally" style={{ width: `${result.allyWinRate * 100}%` }} title={`Party ${fmtPct(result.allyWinRate)}`} />
            <span className="winbar__draw" style={{ width: `${result.drawRate * 100}%` }} title={`Timeout ${fmtPct(result.drawRate)}`} />
            <span className="winbar__foe" style={{ width: `${result.foeWinRate * 100}%` }} title={`Enemies ${fmtPct(result.foeWinRate)}`} />
          </div>
          <div className="winbar__legend">
            <span><i className="dot dot--ally" /> Party {fmtPct(result.allyWinRate)}</span>
            <span><i className="dot dot--draw" /> Timeout {fmtPct(result.drawRate)}</span>
            <span><i className="dot dot--foe" /> Enemies {fmtPct(result.foeWinRate)}</span>
          </div>
        </>
      ) : null}

      <Card
        title="Party from character sheets"
        subtitle="Simulate the real sheets, including their edited derived formulas."
        actions={
          project.characters.length ? (
            <>
              <Button small onClick={() => partyFromSheets('add')}>Add sheets</Button>
              <Button small variant="primary" onClick={() => partyFromSheets('replace')}>Replace party</Button>
            </>
          ) : undefined
        }
      >
        {project.characters.length ? (
          <>
            <p className="hint">
              {project.characters.length} sheet{project.characters.length === 1 ? '' : 's'} available. Syncing a sheet sends its best combat skill, Defense, Vitality, Initiative, weapon and armor here; replacing keeps the opposition intact.
            </p>
            <div className="sheet-party">
              {project.characters.map((sheet) => {
                const fighter = sheetToCombatant(sheet, project.derivedFormulas)
                return (
                  <span key={sheet.id} className="sheet-party__item">
                    <strong>{sheet.name}</strong>
                    <span>pool {fighter.pool} · Def {fighter.defense} · Vit {fighter.vitalityMax}</span>
                  </span>
                )
              })}
            </div>
          </>
        ) : (
          <Empty>No character sheets yet — create one in the Characters module.</Empty>
        )}
      </Card>

      <div className="combat-teams">
        <div className="team">
          <div className="team__head">
            <h4>
              Party <Badge tone="ok">{allies.length}</Badge>
            </h4>
            <span className="hint">Vitality 5 + Corpo×2 · Defense = Agility</span>
          </div>
          <PcBuilder onAdd={(fighter) => addCombatant(fighter, 'ally')} />
          {allies.map((fighter) => (
            <CombatantCard
              key={fighter.id}
              fighter={fighter}
              onChange={(patch) => patchCombatant(fighter.id, patch)}
              onRemove={() => removeCombatant(fighter.id)}
              onDuplicate={() => duplicateCombatant(fighter.id)}
            />
          ))}
          {!allies.length ? <Empty>No party members — build one above.</Empty> : null}
        </div>

        <div className="team">
          <div className="team__head">
            <h4>
              Opposition <Badge tone="bad">{foes.length}</Badge>
            </h4>
            <span className="hint">Threat {fmtNum(threat.totalThreat, 1)} · band {threat.nearest.label}</span>
          </div>
          <EnemyComposer onAdd={(fighter) => addCombatant(fighter, 'foe')} />
          {foes.map((fighter) => (
            <CombatantCard
              key={fighter.id}
              fighter={fighter}
              onChange={(patch) => patchCombatant(fighter.id, patch)}
              onRemove={() => removeCombatant(fighter.id)}
              onDuplicate={() => duplicateCombatant(fighter.id)}
            />
          ))}
          {!foes.length ? <Empty>No opposition — compose one above.</Empty> : null}
        </div>
      </div>

      {!result.error ? (
        <>
          <Card title="Attack matchups" subtitle="Chance to hit and expected final damage at the starting distance (no situational tricks).">
            <h4 className="subhead">Party → Opposition</h4>
            {allies.length && foes.length ? matrix(alliesUp, foes) : <Empty>Need both sides.</Empty>}
            <h4 className="subhead">Opposition → Party</h4>
            {allies.length && foes.length ? matrix(foes, alliesUp) : <Empty>Need both sides.</Empty>}
          </Card>

          <div className="split-2">
            <Card title="Rounds to resolve" subtitle="Run-length distribution.">
              <BarChart
                data={result.roundHistogram.map((row) => ({
                  label: String(row.round),
                  value: row.count,
                  sub: `${row.count} battles`,
                }))}
                height={200}
                color="#58a6ff"
                format={(value) => fmtNum(value, 0)}
              />
            </Card>

            <Card title="Combatant performance" subtitle="Averages across every iteration.">
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Combatant</th>
                      <th className="right">Dmg dealt</th>
                      <th className="right">Dmg taken</th>
                      <th className="right">Survives</th>
                      <th className="right">Dies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stats.map((stat) => (
                      <tr key={stat.id}>
                        <td>
                          {stat.name}{' '}
                          <Badge tone={stat.side === 'ally' ? 'ok' : 'bad'}>{stat.side === 'ally' ? 'party' : 'foe'}</Badge>
                        </td>
                        <td className="right mono">{fmtNum(stat.avgDamageDealt, 1)}</td>
                        <td className="right mono">{fmtNum(stat.avgDamageTaken, 1)}</td>
                        <td className="right mono">{fmtPct(stat.survivalRate)}</td>
                        <td className="right mono">{fmtPct(stat.deathRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card title="Sample battle log" subtitle="First iteration of this seed — shows the opening rounds.">
            {result.log.length ? <pre className="log">{result.log.join('\n')}</pre> : <Empty>The battle ended immediately.</Empty>}
          </Card>
        </>
      ) : null}
    </div>
  )
}
