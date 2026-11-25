import { useMemo, useState } from 'react'
import { useProject } from '../../store/project'
import { planAdvancement } from '../../lib/engine/advancement'
import { XP_COSTS } from '../../lib/pulso'
import { fmtNum, uid } from '../../lib/format'
import { BarChart } from '../charts'
import { Badge, Button, Card, Empty, Field, NumberInput, Select, Stat, TextInput } from '../ui'

export default function AdvancementPanel() {
  const { project, update } = useProject()
  const cfg = project.advancement
  const result = useMemo(() => planAdvancement(cfg), [cfg])
  const [catalogId, setCatalogId] = useState(XP_COSTS[0].id)

  const patch = (mutate: (draft: typeof cfg) => void) => update((draft) => mutate(draft.advancement))

  const addFromCatalog = () => {
    const entry = XP_COSTS.find((item) => item.id === catalogId)
    if (!entry) return
    patch((draft) => {
      draft.entries.push({ id: uid('adv'), name: entry.label, cost: entry.cost, qty: 1 })
    })
  }

  return (
    <div className="stack">
      <div className="layout-split layout-split--grind">
        <div className="stack">
          <Card title="Session economy" subtitle="Pulso awards XP per session, not per kill or craft.">
            <div className="field-grid">
              <Field label="XP per session" hint="3 triggers, 1 XP each.">
                <NumberInput value={cfg.xpPerSession} min={1} max={6} onChange={(value) => patch((draft) => { draft.xpPerSession = Math.max(1, Math.round(value)) })} />
              </Field>
              <Field label="Bonus XP / session" hint="Optional combat XP: Elite +1, Chefe +2.">
                <NumberInput value={cfg.bonusXpPerSession} min={0} max={6} onChange={(value) => patch((draft) => { draft.bonusXpPerSession = Math.max(0, Math.round(value)) })} />
              </Field>
            </div>
            <div className="callout callout--info">
              <strong>Effective rate: {result.xpPerSession} XP per session</strong>
              <span>A reference campaign runs 28–32 sessions at 2–3 XP each.</span>
            </div>
          </Card>

          <Card
            title="Improvement plan"
            subtitle="Costs come straight from the progression table."
            actions={
              <Badge tone="info">
                {fmtNum(result.totalXp)} XP · {result.sessions} sessions
              </Badge>
            }
          >
            <div className="inline-form">
              <Select
                value={catalogId}
                options={XP_COSTS.map((entry) => ({ value: entry.id, label: `${entry.label} · ${entry.cost} XP` }))}
                onChange={setCatalogId}
              />
              <Button small variant="primary" onClick={addFromCatalog}>
                Add
              </Button>
              <Button
                small
                onClick={() =>
                  patch((draft) => {
                    draft.entries.push({ id: uid('adv'), name: 'Custom improvement', cost: 2, qty: 1 })
                  })
                }
              >
                Custom
              </Button>
            </div>

            {cfg.entries.length === 0 ? <Empty>No improvements planned yet.</Empty> : null}
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Improvement</th>
                    <th className="right">Cost</th>
                    <th className="right">Qty</th>
                    <th className="right">Sessions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cfg.entries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td>
                        <TextInput
                          value={entry.name}
                          onChange={(value) =>
                            patch((draft) => {
                              const row = draft.entries[index]
                              if (row) row.name = value
                            })
                          }
                        />
                      </td>
                      <td className="right">
                        <span className="inline-num">
                          <NumberInput
                            value={entry.cost}
                            min={0}
                            max={30}
                            onChange={(value) =>
                              patch((draft) => {
                                const row = draft.entries[index]
                                if (row) row.cost = Math.max(0, Math.round(value))
                              })
                            }
                          />
                        </span>
                      </td>
                      <td className="right">
                        <span className="inline-num">
                          <NumberInput
                            value={entry.qty}
                            min={0}
                            max={20}
                            onChange={(value) =>
                              patch((draft) => {
                                const row = draft.entries[index]
                                if (row) row.qty = Math.max(0, Math.round(value))
                              })
                            }
                          />
                        </span>
                      </td>
                      <td className="right mono">
                        {result.rows.find((row) => row.id === entry.id)
                          ? `${result.rows.find((row) => row.id === entry.id)!.sessionStart}–${result.rows.find((row) => row.id === entry.id)!.sessionEnd}`
                          : '—'}
                      </td>
                      <td className="right">
                        <button
                          className="icon-btn"
                          title="Remove"
                          aria-label={`Remove ${entry.name}`}
                          onClick={() =>
                            patch((draft) => {
                              draft.entries = draft.entries.filter((row) => row.id !== entry.id)
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
          </Card>

          <Card title="XP costs reference" subtitle="Core and module progression.">
            <div className="chips">
              {XP_COSTS.map((entry) => (
                <Badge key={entry.id} tone="raw">
                  {entry.label} · {entry.cost} XP
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <div className="stats">
            <Stat label="Total XP" value={fmtNum(result.totalXp)} sub="whole plan" />
            <Stat label="Sessions" value={result.sessions} sub={`at ${result.xpPerSession} XP each`} />
            <Stat
              label="Biggest step"
              value={result.bottleneck ? `${result.bottleneck.subtotal} XP` : '—'}
              sub={result.bottleneck?.name}
              tone="warn"
            />
            <Stat label="Rate" value={`${result.xpPerSession}/session`} sub={cfg.bonusXpPerSession ? 'incl. combat XP' : 'standard'} />
          </div>

          {result.warnings.map((warning, index) => (
            <p key={index} className="callout callout--warn">
              {warning}
            </p>
          ))}

          <Card title="XP by improvement" subtitle="Where the campaign time goes.">
            {result.rows.length === 0 ? (
              <Empty>Add improvements to see the curve.</Empty>
            ) : (
              <BarChart
                data={result.rows.map((row) => ({
                  label: row.name.length > 14 ? `${row.name.slice(0, 13)}…` : row.name,
                  value: row.subtotal,
                  sub: `${row.subtotal} XP · sessions ${row.sessionStart}–${row.sessionEnd}`,
                }))}
                height={200}
                color="#bc8cff"
                format={(value) => `${Math.round(value)}`}
              />
            )}
          </Card>

          <Card title="Session timeline" subtitle="Cumulative cost and when each purchase lands.">
            {result.rows.length === 0 ? (
              <Empty>Nothing planned.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Improvement</th>
                      <th className="right">XP</th>
                      <th className="right">Cumulative</th>
                      <th className="right">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td className="right mono">{row.subtotal}</td>
                        <td className="right mono">{row.cumulative}</td>
                        <td className="right mono">
                          {row.sessionStart}
                          {row.sessionEnd !== row.sessionStart ? `–${row.sessionEnd}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Milestones">
            <ul className="bullets">
              <li>3 XP per session maximum: attendance, advancing the objective, good roleplay or using a disadvantage.</li>
              <li>Attributes cost 6 / 8 / 12 XP; skills and advantages stay cheap at 2–3 XP.</li>
              <li>Modules share the same XP pool — rituals, implants, base and domain levels all compete with attributes.</li>
              <li>A finished plan at {result.sessions} sessions {result.sessions <= 32 ? 'fits the reference campaign length.' : 'exceeds the 28–32 session reference campaign.'}</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
