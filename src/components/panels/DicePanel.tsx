import { useMemo } from 'react'
import { useProject } from '../../store/project'
import { computeDice } from '../../lib/engine/dice'
import { DIFFICULTIES, difficultyLabel } from '../../lib/pulso'
import { fmtPct } from '../../lib/format'
import { BarChart } from '../charts'
import { Badge, Button, Card, Field, NumberInput, Select, Stat, Toggle } from '../ui'
import type { DiceConfig } from '../../lib/types'

export default function DicePanel() {
  const { project, update } = useProject()
  const cfg = project.dice
  const result = useMemo(() => computeDice(cfg), [cfg])

  const set = (patch: Partial<DiceConfig>) => update((draft) => Object.assign(draft.dice, patch))

  const chart = useMemo(() => {
    const max = Math.max(10, result.max)
    const buckets: { label: string; value: number; sub: string }[] = []
    for (let value = 0; value <= max; value++) {
      const probability = result.support.find((row) => row.value === value)?.prob ?? 0
      buckets.push({ label: String(value), value: probability, sub: `${fmtPct(probability, 2)} exactly ${value}` })
    }
    return buckets
  }, [result])

  const thresholdRows = useMemo(() => {
    const rows: { value: number; prob: number }[] = []
    const max = Math.max(cfg.difficulty + 2, result.max)
    for (let value = 0; value <= max; value++) {
      const probability = result.atLeast.find((row) => row.value >= value)?.prob ?? 0
      rows.push({ value, prob: probability })
    }
    return rows
  }, [result, cfg.difficulty])

  return (
    <div className="stack">
      <div className="layout-split layout-split--dice">
        <Card title="Pulso test" subtitle="Pool of d6 · 4–6 = 1 success · difficulty set by the GM.">
          <div className="field-grid">
            <Field label="Pool" hint="Attribute + skill + specialisation + modifiers.">
              <NumberInput value={cfg.pool} min={1} max={20} onChange={(value) => set({ pool: Math.max(1, Math.round(value)) })} />
            </Field>
            <Field label="Difficulty" hint={`Current: ${difficultyLabel(cfg.difficulty)}`}>
              <Select
                value={String(cfg.difficulty)}
                options={DIFFICULTIES.map((entry) => ({ value: String(entry.value), label: `${entry.value} · ${entry.label}` }))}
                onChange={(value) => set({ difficulty: Number(value) })}
              />
            </Field>
            <Field label="Success on" hint="Pulso default: 4, 5 or 6.">
              <Select
                value={String(cfg.threshold)}
                options={[4, 5, 6].map((value) => ({ value: String(value), label: `${value}–6` }))}
                onChange={(value) => set({ threshold: Number(value) })}
              />
            </Field>
            <Field label="Penalty dice" hint="Subtracted before the cap of 12.">
              <NumberInput value={cfg.penaltyDice} min={0} max={15} onChange={(value) => set({ penaltyDice: Math.max(0, Math.round(value)) })} />
            </Field>
            <Field label="Automatic successes" hint="From modifiers, not dice.">
              <NumberInput value={cfg.bonusSuccesses} onChange={(value) => set({ bonusSuccesses: Math.round(value) })} />
            </Field>
            <Field label="Critical success" hint="Optional rule: 6 = 2 successes.">
              <Toggle checked={cfg.criticalSuccess} onChange={(checked) => set({ criticalSuccess: checked })} label={cfg.criticalSuccess ? 'On' : 'Off'} />
            </Field>
            <Field label="Partial success" hint="Fail by 1 = success with a complication.">
              <Toggle checked={cfg.partialSuccess} onChange={(checked) => set({ partialSuccess: checked })} label={cfg.partialSuccess ? 'On' : 'Off'} />
            </Field>
          </div>

          <div className="callout callout--info">
            <strong>Pool resolution</strong>
            <span>
              {cfg.pool} dice requested → <strong>{result.dice} dice</strong>
              {result.autoSuccesses ? ` + ${result.autoSuccesses} automatic success${result.autoSuccesses > 1 ? 'es' : ''}` : ''} after penalties and the 12-die cap.
            </span>
          </div>

          <div className="btn-row">
            <Button
              small
              onClick={() =>
                set({ pool: 5, threshold: 4, difficulty: 2, criticalSuccess: true, partialSuccess: true, bonusSuccesses: 0, penaltyDice: 0 })
              }
            >
              Preset: starting PC (5 dice, Dif 2)
            </Button>
            <Button
              small
              onClick={() =>
                set({ pool: 7, threshold: 4, difficulty: 3, criticalSuccess: true, partialSuccess: true, bonusSuccesses: 0, penaltyDice: 0 })
              }
            >
              Preset: specialist (7 dice, Dif 3)
            </Button>
            <Button
              small
              onClick={() =>
                set({ pool: 3, threshold: 4, difficulty: 4, criticalSuccess: true, partialSuccess: false, bonusSuccesses: 0, penaltyDice: 0 })
              }
            >
              Preset: capanga vs Def 4
            </Button>
          </div>

          <div className="divider" />
          <h4 className="subhead">Opposed test</h4>
          <div className="field-grid">
            <Field label="Model as opposed roll" hint="Ties go to the defender (§7)." wide>
              <Toggle checked={cfg.opposed} onChange={(checked) => set({ opposed: checked })} label={cfg.opposed ? 'Opposed' : 'Against fixed difficulty'} />
            </Field>
            {cfg.opposed ? (
              <Field label="Defender pool">
                <NumberInput value={cfg.opposedPool} min={1} max={20} onChange={(value) => set({ opposedPool: Math.max(1, Math.round(value)) })} />
              </Field>
            ) : null}
          </div>
        </Card>

        <div className="stack">
          <div className="stats">
            <Stat
              label={`P(≥ ${cfg.difficulty} success${cfg.difficulty === 1 ? '' : 'es'})`}
              value={fmtPct(result.pSuccess, 2)}
              sub={difficultyLabel(cfg.difficulty)}
              tone={result.pSuccess >= 0.65 ? 'good' : result.pSuccess <= 0.3 ? 'bad' : 'warn'}
            />
            <Stat label="Expected successes" value={result.mean.toFixed(2)} sub={`σ ${result.sd.toFixed(2)}`} />
            <Stat
              label="Fail by 1"
              value={fmtPct(result.pPartial, 2)}
              sub={cfg.partialSuccess ? 'success with complication' : 'complication (rule off)'}
              tone="warn"
            />
            <Stat label="Critical failure" value={fmtPct(result.pCritFail, 2)} sub="0 successes + two 1s" tone="bad" />
            <Stat label="Exact" value={fmtPct(result.pExact, 2)} sub={`= ${cfg.difficulty}`} />
          </div>

          {cfg.opposed && result.opposed ? (
            <Card title="Opposed outcome" subtitle="Attacker vs defender pools; ties favour the defender.">
              <div className="stats">
                <Stat label="Attacker wins" value={fmtPct(result.opposed.win)} tone="good" />
                <Stat label="Tie (defender)" value={fmtPct(result.opposed.tie)} />
                <Stat label="Defender wins" value={fmtPct(result.opposed.lose)} tone="bad" />
              </div>
              <div className="winbar">
                <span className="winbar__ally" style={{ width: `${result.opposed.win * 100}%` }} />
                <span className="winbar__draw" style={{ width: `${result.opposed.tie * 100}%` }} />
                <span className="winbar__foe" style={{ width: `${result.opposed.lose * 100}%` }} />
              </div>
            </Card>
          ) : null}

          <Card title="Probability distribution" subtitle="Exact enumeration — no sampling error.">
            <BarChart data={chart} height={210} color="#58a6ff" format={(value) => `${(value * 100).toFixed(0)}%`} />
          </Card>

          <Card title="Threshold table" subtitle="Chance to reach each success count.">
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Successes</th>
                    <th className="right">Chance</th>
                    <th className="right">Odds</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholdRows.map((row) => (
                    <tr key={row.value} className={row.value === cfg.difficulty ? 'row--highlight' : undefined}>
                      <td className="mono">
                        {row.value}
                        {row.value === cfg.difficulty ? <Badge tone="info">difficulty</Badge> : null}
                      </td>
                      <td className="right mono">{fmtPct(row.prob, 2)}</td>
                      <td className="right mono">{row.prob > 0 ? `1 in ${Math.round(1 / row.prob)}` : '—'}</td>
                      <td className="muted">{DIFFICULTIES.find((entry) => entry.value === row.value)?.label ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="hint">
            Partial success is designed for investigation, negotiation and infiltration — not direct combat or resistance
            rolls. Critical failure means zero successes with at least two 1s.
          </p>
        </div>
      </div>
    </div>
  )
}
