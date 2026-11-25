import { useMemo } from 'react'
import { useProject } from '../../store/project'
import { analyzeUnlocks } from '../../lib/engine/unlocks'
import { uid } from '../../lib/format'
import { Badge, Button, Card, Callout, Empty, Field, NumberInput, Select, Stat, TextInput } from '../ui'

export default function UnlocksPanel() {
  const { project, update } = useProject()
  const analysis = useMemo(() => analyzeUnlocks(project), [project])

  const achievementOptions = project.achievements.map((achievement) => ({
    value: achievement.id,
    label: achievement.name,
  }))

  const addAchievement = () => {
    const id = uid('ach')
    update((draft) => {
      draft.achievements.push({
        id,
        name: `New Milestone ${draft.achievements.length + 1}`,
        requires: [],
        itemCost: [],
      })
    })
  }

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Reachable items" value={analysis.availableItems.length} sub={`of ${project.items.length} total`} />
        <Stat label="Unlocked achievements" value={`${analysis.unlocked.length}/${project.achievements.length}`} />
        <Stat
          label="Blocked recipes"
          value={analysis.blockedRecipes.length}
          tone={analysis.blockedRecipes.length ? 'bad' : 'good'}
        />
        <Stat
          label="Softlock risk"
          value={analysis.softlockRisk ? 'Detected' : 'None'}
          tone={analysis.softlockRisk ? 'bad' : 'good'}
          sub={analysis.cycles.length ? `${analysis.cycles.length} dependency cycle(s)` : 'all gates satisfiable'}
        />
      </div>

      {analysis.softlockRisk ? (
        <Callout tone="bad" title="Progression problem found">
          Some content can never be reached from raw materials. Fix the listed gates below so players cannot get stuck.
        </Callout>
      ) : (
        <Callout tone="good" title="No dead ends">
          Every gated recipe can be unlocked from the available resource graph.
        </Callout>
      )}

      <div className="layout-split layout-split--unlocks">
        <div className="stack">
          <Card
            title="Achievements / questbook"
            subtitle="Gate recipes behind milestones with optional delivery costs."
            actions={
              <Button small variant="primary" onClick={addAchievement}>
                + Achievement
              </Button>
            }
          >
            {project.achievements.length === 0 ? <Empty>No achievements yet.</Empty> : null}
            <div className="stack">
              {project.achievements.map((achievement) => (
                <div key={achievement.id} className="achievement">
                  <div className="achievement__head">
                    <TextInput
                      value={achievement.name}
                      onChange={(value) =>
                        update((draft) => {
                          const entry = draft.achievements.find((a) => a.id === achievement.id)
                          if (entry) entry.name = value
                        })
                      }
                    />
                    <Badge tone={analysis.unlocked.includes(achievement.id) ? 'ok' : 'bad'}>
                      {analysis.unlocked.includes(achievement.id) ? 'reachable' : 'blocked'}
                    </Badge>
                    <button
                      className="icon-btn"
                      title="Delete achievement"
                      aria-label={`Delete ${achievement.name}`}
                      onClick={() =>
                        update((draft) => {
                          draft.achievements = draft.achievements.filter((a) => a.id !== achievement.id)
                          draft.recipes = draft.recipes.map((recipe) => ({
                            ...recipe,
                            requires: recipe.requires.filter((id) => id !== achievement.id),
                          }))
                        })
                      }
                    >
                      ×
                    </button>
                  </div>

                  <div className="chips">
                    <span className="field__label">Requires</span>
                    {project.achievements
                      .filter((other) => other.id !== achievement.id)
                      .map((other) => {
                        const active = achievement.requires.includes(other.id)
                        return (
                          <button
                            key={other.id}
                            className={`chip${active ? ' chip--active' : ''}`}
                            onClick={() =>
                              update((draft) => {
                                const entry = draft.achievements.find((a) => a.id === achievement.id)
                                if (!entry) return
                                entry.requires = active
                                  ? entry.requires.filter((id) => id !== other.id)
                                  : [...entry.requires, other.id]
                              })
                            }
                          >
                            {other.name}
                          </button>
                        )
                      })}
                    {project.achievements.length <= 1 ? <span className="muted">No other milestones</span> : null}
                  </div>

                  <div className="chips chips--column">
                    <span className="field__label">Delivery cost</span>
                    {achievement.itemCost.map((cost, index) => (
                      <div key={`${achievement.id}-${index}`} className="cost-row">
                        <Select
                          value={cost.itemId}
                          options={project.items.map((item) => ({ value: item.id, label: item.name }))}
                          small
                          onChange={(value) =>
                            update((draft) => {
                              const entry = draft.achievements.find((a) => a.id === achievement.id)
                              if (entry && entry.itemCost[index]) entry.itemCost[index].itemId = value
                            })
                          }
                        />
                        <NumberInput
                          value={cost.qty}
                          min={1}
                          onChange={(value) =>
                            update((draft) => {
                              const entry = draft.achievements.find((a) => a.id === achievement.id)
                              if (entry && entry.itemCost[index]) entry.itemCost[index].qty = Math.max(1, value)
                            })
                          }
                        />
                        <button
                          className="icon-btn"
                          aria-label="Remove cost"
                          onClick={() =>
                            update((draft) => {
                              const entry = draft.achievements.find((a) => a.id === achievement.id)
                              if (entry) entry.itemCost.splice(index, 1)
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <Button
                      small
                      disabled={!project.items.length}
                      onClick={() =>
                        update((draft) => {
                          const entry = draft.achievements.find((a) => a.id === achievement.id)
                          if (entry && draft.items[0]) entry.itemCost.push({ itemId: draft.items[0].id, qty: 1 })
                        })
                      }
                    >
                      + Cost
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Reachability report" subtitle="Iterative fixpoint over recipes and gates.">
            {analysis.blockedAchievements.length === 0 && analysis.blockedRecipes.length === 0 ? (
              <Empty>Everything is reachable.</Empty>
            ) : (
              <div className="stack">
                {analysis.blockedAchievements.length ? (
                  <div>
                    <h4 className="subhead">Blocked achievements</h4>
                    <ul className="bullets">
                      {analysis.blockedAchievements.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.name}</strong>
                          <ul className="bullets bullets--nested">
                            {entry.reasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analysis.blockedRecipes.length ? (
                  <div>
                    <h4 className="subhead">Blocked recipes</h4>
                    <ul className="bullets">
                      {analysis.blockedRecipes.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.name}</strong>
                          <ul className="bullets bullets--nested">
                            {entry.reasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          {analysis.cycles.length ? (
            <Card title="Dependency cycles" subtitle="Circular achievement prerequisites.">
              <ul className="bullets">
                {analysis.cycles.map((cycle, index) => (
                  <li key={index} className="mono">
                    {cycle
                      .map((id) => project.achievements.find((a) => a.id === id)?.name ?? id)
                      .join(' → ')}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Unlock order" subtitle="Milestones and gated recipes in dependency order.">
            {analysis.order.length === 0 ? <Empty>No gated content.</Empty> : null}
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th className="right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.order.map((entry) => (
                    <tr key={`${entry.kind}-${entry.id}`}>
                      <td>
                        <Badge tone={entry.kind === 'achievement' ? 'info' : 'crafted'}>{entry.kind}</Badge>
                      </td>
                      <td>{entry.name}</td>
                      <td className="right">
                        <Badge tone={entry.ok ? 'ok' : 'bad'}>{entry.ok ? 'unlocks' : 'blocked'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Available items">
            <div className="chips">
              {analysis.availableItems.map((id) => (
                <Badge key={id} tone="ok">
                  {project.items.find((item) => item.id === id)?.name ?? id}
                </Badge>
              ))}
              {project.items
                .filter((item) => !analysis.availableItems.includes(item.id))
                .map((item) => (
                  <Badge key={item.id} tone="bad">
                    {item.name}
                  </Badge>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
