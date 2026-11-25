import { useMemo, useState } from 'react'
import { useProject } from '../../store/project'
import { simulateSurvival, type SurvivalSourceView } from '../../lib/engine/survival'
import { fmtMinutes, fmtNum } from '../../lib/format'
import { BarChart, LineChart } from '../charts'
import { Badge, Button, Card, Empty, Field, NumberInput, Select, Stat } from '../ui'

export default function SurvivalPanel() {
  const { project, update } = useProject()
  const [addSourceId, setAddSourceId] = useState('')

  const sources: SurvivalSourceView[] = useMemo(
    () =>
      project.survival.sources.map((source) => {
        const item = project.items.find((entry) => entry.id === source.itemId)
        return {
          itemId: source.itemId,
          name: item?.name ?? source.itemId,
          nutrition: item?.nutrition ?? 0,
          gatherMinutes: source.gatherMinutes,
          stock: source.stock,
        }
      }),
    [project],
  )

  const result = useMemo(() => simulateSurvival(project.survival, sources), [project.survival, sources])
  const missingSources = project.items.filter(
    (item) => !project.survival.sources.some((source) => source.itemId === item.id),
  )

  const patchSurvival = (mutate: (draft: typeof project.survival) => void) =>
    update((draft) => mutate(draft.survival))

  return (
    <div className="stack">
      <Card title="Survival cycle" subtitle="Repeatable days of hunger, gathering and fatigue.">
        <div className="field-grid">
          <Field label="Days">
            <NumberInput value={project.survival.days} min={1} max={365} onChange={(value) => patchSurvival((s) => { s.days = Math.max(1, Math.round(value)) })} />
          </Field>
          <Field label="Minutes per day">
            <NumberInput value={project.survival.dayMinutes} min={60} max={1440} onChange={(value) => patchSurvival((s) => { s.dayMinutes = Math.max(60, value) })} />
          </Field>
          <Field label="Fixed work / day" hint="minutes">
            <NumberInput value={project.survival.workMinutes} min={0} max={1440} onChange={(value) => patchSurvival((s) => { s.workMinutes = Math.max(0, value) })} />
          </Field>
          <Field label="Start health">
            <NumberInput value={project.survival.startHealth} min={1} onChange={(value) => patchSurvival((s) => { s.startHealth = Math.max(1, value) })} />
          </Field>
          <Field label="Hunger / day">
            <NumberInput value={project.survival.hungerPerDay} min={1} onChange={(value) => patchSurvival((s) => { s.hungerPerDay = Math.max(1, value) })} />
          </Field>
          <Field label="Hunger growth" hint="% per day">
            <NumberInput value={project.survival.hungerGrowthPct} onChange={(value) => patchSurvival((s) => { s.hungerGrowthPct = value })} />
          </Field>
          <Field label="HP lost / missing nutrition">
            <NumberInput value={project.survival.healthLossPerMissingNutrition} min={0} step={0.01} onChange={(value) => patchSurvival((s) => { s.healthLossPerMissingNutrition = Math.max(0, value) })} />
          </Field>
          <Field label="Fatigue" hint="extra hunger per hour over the day budget">
            <NumberInput value={project.survival.fatiguePerHour} min={0} onChange={(value) => patchSurvival((s) => { s.fatiguePerHour = Math.max(0, value) })} />
          </Field>
        </div>
      </Card>

      <div className="stats">
        <Stat
          label="Outcome"
          value={result.firstDeathDay ? `Day ${result.firstDeathDay}` : `${result.daysSurvived} days`}
          sub={result.firstDeathDay ? 'collapsed' : 'survived'}
          tone={result.firstDeathDay ? 'bad' : 'good'}
        />
        <Stat label="Gathering time" value={fmtMinutes(result.totalGatherMinutes)} sub={`${fmtMinutes(result.avgGatherMinutes)} / day avg`} />
        <Stat label="Food gathered" value={fmtNum(result.totalGathered)} sub="nutrition" />
        <Stat label="Health left" value={fmtNum(result.rows[result.rows.length - 1]?.health ?? project.survival.startHealth, 0)} sub="end of run" />
      </div>

      <p className={`callout ${result.firstDeathDay ? 'callout--bad' : 'callout--good'}`}>{result.verdict}</p>

      <div className="layout-split layout-split--survival">
        <Card title="Food sources" subtitle="Nutrition comes from item definitions.">
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Food</th>
                  <th className="right">Nutrition</th>
                  <th className="right">Gather</th>
                  <th className="right">Stock</th>
                  <th className="right">Efficiency</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.itemId}>
                    <td>{source.name}</td>
                    <td className="right">
                      <span className="inline-num">
                        <NumberInput
                          value={source.nutrition}
                          min={0}
                          onChange={(value) =>
                            update((draft) => {
                              const item = draft.items.find((entry) => entry.id === source.itemId)
                              if (item) item.nutrition = Math.max(0, value)
                            })
                          }
                        />
                      </span>
                    </td>
                    <td className="right">
                      <span className="inline-num">
                        <NumberInput
                          value={source.gatherMinutes}
                          min={0}
                          onChange={(value) =>
                            patchSurvival((s) => {
                              const entry = s.sources.find((row) => row.itemId === source.itemId)
                              if (entry) entry.gatherMinutes = Math.max(0, value)
                            })
                          }
                        />
                      </span>
                      <span className="muted"> min</span>
                    </td>
                    <td className="right">
                      <span className="inline-num">
                        <NumberInput
                          value={source.stock}
                          min={0}
                          onChange={(value) =>
                            patchSurvival((s) => {
                              const entry = s.sources.find((row) => row.itemId === source.itemId)
                              if (entry) entry.stock = Math.max(0, Math.round(value))
                            })
                          }
                        />
                      </span>
                    </td>
                    <td className="right mono">
                      {source.gatherMinutes > 0 ? `${(source.nutrition / source.gatherMinutes).toFixed(1)}/min` : '—'}
                    </td>
                    <td className="right">
                      <button
                        className="icon-btn"
                        title="Remove source"
                        aria-label={`Remove ${source.name}`}
                        onClick={() =>
                          patchSurvival((s) => {
                            s.sources = s.sources.filter((row) => row.itemId !== source.itemId)
                          })
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="inline-form">
            <Select
              value={addSourceId}
              options={[{ value: '', label: 'Add food source…' }, ...missingSources.map((item) => ({ value: item.id, label: item.name }))]}
              onChange={setAddSourceId}
            />
            <Button
              small
              disabled={!addSourceId}
              onClick={() => {
                const itemId = addSourceId
                patchSurvival((s) => {
                  s.sources.push({ itemId, gatherMinutes: 10, stock: 0 })
                })
                setAddSourceId('')
              }}
            >
              Add
            </Button>
          </div>
          <p className="hint">Sources with 0 nutrition are ignored by the simulation. Stock is eaten before gathering.</p>
        </Card>

        <Card title="Daily ledger" subtitle="Demand, intake, gathering and health.">
          {result.rows.length === 0 ? (
            <Empty>No food sources configured.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="right">Demand</th>
                    <th className="right">Eaten</th>
                    <th className="right">Gathered</th>
                    <th className="right">Gather time</th>
                    <th className="right">Overwork</th>
                    <th className="right">Health</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.day}>
                      <td className="mono">{row.day}</td>
                      <td className="right mono">{fmtNum(row.demand)}</td>
                      <td className="right mono">{fmtNum(row.eaten)}</td>
                      <td className="right mono">
                        {row.gathered ? `${fmtNum(row.gathered)} (${row.gatheredUnits}×)` : '—'}
                      </td>
                      <td className="right mono">{fmtMinutes(row.gatherMinutes)}</td>
                      <td className="right mono">{row.overworkMinutes ? `${Math.round(row.overworkMinutes)}m` : '—'}</td>
                      <td className="right mono">{fmtNum(row.health, 0)}</td>
                      <td>
                        <Badge tone={row.status === 'ok' ? 'ok' : row.status === 'scraping' ? 'warn' : 'bad'}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="split-2">
        <Card title="Health over time">
          <LineChart
            points={result.rows.map((row) => ({ label: `D${row.day}`, value: row.health }))}
            color="#7ee787"
            format={(value) => value.toFixed(0)}
          />
        </Card>
        <Card title="Gathering minutes per day">
          <BarChart
            data={result.rows.map((row) => ({
              label: `D${row.day}`,
              value: row.gatherMinutes,
              sub: `${Math.round(row.gatherMinutes)} min`,
            }))}
            color="#f0b429"
            format={(value) => `${Math.round(value)}m`}
          />
        </Card>
      </div>

      {result.warnings.length ? (
        <Card title="Warnings">
          <ul className="bullets">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
