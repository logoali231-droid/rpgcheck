import type { SurvivalConfig } from '../types'

export interface SurvivalSourceView {
  itemId: string
  name: string
  nutrition: number
  gatherMinutes: number
  stock: number
}

export interface SurvivalDay {
  day: number
  demand: number
  eaten: number
  gathered: number
  gatheredUnits: number
  gatherMinutes: number
  fromStock: number
  overworkMinutes: number
  fatigueCarry: number
  health: number
  deficit: number
  status: 'ok' | 'scraping' | 'starving' | 'collapsed'
}

export interface SurvivalResult {
  rows: SurvivalDay[]
  daysSurvived: number
  firstDeathDay: number | null
  totalGatherMinutes: number
  totalGathered: number
  avgGatherMinutes: number
  verdict: string
  warnings: string[]
}

/**
 * Day-by-day survival model.
 * Each day has a nutrition demand that grows over time. Stocked food is eaten
 * first; any shortfall is gathered from the most time-efficient source.
 * Gathering plus fixed work over the day budget causes fatigue, which raises the
 * next day's demand. Missing nutrition damages health.
 */
export function simulateSurvival(cfg: SurvivalConfig, sources: SurvivalSourceView[]): SurvivalResult {
  const rows: SurvivalDay[] = []
  const usable = sources
    .filter((s) => s.nutrition > 0)
    .map((s) => ({ ...s, efficiency: s.gatherMinutes > 0 ? s.nutrition / s.gatherMinutes : Infinity }))
    .sort((a, b) => b.efficiency - a.efficiency)

  if (!usable.length) {
    return {
      rows: [],
      daysSurvived: 0,
      firstDeathDay: null,
      totalGatherMinutes: 0,
      totalGathered: 0,
      avgGatherMinutes: 0,
      verdict: 'No food sources configured.',
      warnings: ['Add an item with nutrition above zero to run a survival cycle.'],
    }
  }

  const stock = new Map(usable.map((s) => [s.itemId, s.stock]))
  let health = cfg.startHealth
  let fatigueCarry = 0
  let totalGatherMinutes = 0
  let totalGathered = 0
  let firstDeathDay: number | null = null
  const warnings: string[] = []

  for (let day = 1; day <= cfg.days; day++) {
    const growth = Math.pow(1 + cfg.hungerGrowthPct / 100, day - 1)
    const demand = Math.round(cfg.hungerPerDay * growth + fatigueCarry)
    let eaten = 0
    let fromStock = 0

    // Eat the most filling stock first to minimise waste.
    for (const source of [...usable].sort((a, b) => b.nutrition - a.nutrition)) {
      while (eaten < demand) {
        const available = stock.get(source.itemId) ?? 0
        if (available <= 0) break
        stock.set(source.itemId, available - 1)
        eaten += source.nutrition
        fromStock += source.nutrition
      }
      if (eaten >= demand) break
    }

    let gathered = 0
    let gatheredUnits = 0
    let gatherMinutes = 0
    if (eaten < demand) {
      const best = usable[0]
      const units = Math.max(1, Math.ceil((demand - eaten) / best.nutrition))
      gatheredUnits = units
      gathered = units * best.nutrition
      gatherMinutes = units * best.gatherMinutes
      eaten += gathered
    }

    totalGatherMinutes += gatherMinutes
    totalGathered += gathered

    const overworkMinutes = Math.max(0, gatherMinutes + cfg.workMinutes - cfg.dayMinutes)
    const nextFatigue = (overworkMinutes / 60) * cfg.fatiguePerHour

    const deficit = Math.max(0, demand - eaten)
    if (deficit > 0) health -= deficit * cfg.healthLossPerMissingNutrition
    health = Math.max(0, health)

    let status: SurvivalDay['status'] = 'ok'
    if (deficit > 0) status = 'starving'
    else if (eaten - demand < demand * 0.1) status = 'scraping'
    if (health <= 0) {
      status = 'collapsed'
      firstDeathDay = day
      rows.push({
        day,
        demand,
        eaten,
        gathered,
        gatheredUnits,
        gatherMinutes,
        fromStock,
        overworkMinutes,
        fatigueCarry: nextFatigue,
        health,
        deficit,
        status,
      })
      break
    }

    rows.push({
      day,
      demand,
      eaten,
      gathered,
      gatheredUnits,
      gatherMinutes,
      fromStock,
      overworkMinutes,
      fatigueCarry: nextFatigue,
      health,
      deficit,
      status,
    })

    fatigueCarry = nextFatigue
  }

  for (const row of rows) {
    if (row.overworkMinutes > 0) {
      warnings.push(`Day ${row.day}: ${Math.round(row.overworkMinutes)} min over the day budget — demand rises tomorrow.`)
    }
    if (row.status === 'starving') {
      warnings.push(`Day ${row.day}: nutrition deficit of ${Math.round(row.deficit)}.`)
    }
  }

  const daysSurvived = firstDeathDay ? firstDeathDay - 1 : rows.length
  const bestSource = usable[0]
  const verdict =
    firstDeathDay === null
      ? `Survived all ${rows.length} days with ${Math.round(health)} health.`
      : `Collapsed on day ${firstDeathDay} after surviving ${daysSurvived} day${daysSurvived === 1 ? '' : 's'}.`

  return {
    rows,
    daysSurvived,
    firstDeathDay,
    totalGatherMinutes,
    totalGathered,
    avgGatherMinutes: rows.length ? totalGatherMinutes / rows.length : 0,
    verdict,
    warnings: [
      `Gathering ${bestSource.name} yields ${bestSource.nutrition} nutrition per ${bestSource.gatherMinutes} min.`,
      ...warnings.slice(0, 8),
    ],
  }
}
