import type { AdvancementConfig } from '../types'

export interface AdvancementRow {
  id: string
  name: string
  cost: number
  qty: number
  subtotal: number
  cumulative: number
  sessionStart: number
  sessionEnd: number
}

export interface AdvancementResult {
  totalXp: number
  xpPerSession: number
  sessions: number
  rows: AdvancementRow[]
  bottleneck?: AdvancementRow
  warnings: string[]
}

/**
 * Pulso progression is bought with XP at 2–3 XP per session (no levels).
 * The planner converts a shopping list of improvements into sessions of play.
 */
export function planAdvancement(config: AdvancementConfig): AdvancementResult {
  const xpPerSession = Math.max(1, config.xpPerSession + config.bonusXpPerSession)
  const entries = config.entries.filter((entry) => entry.qty > 0 && entry.cost >= 0)
  const rows: AdvancementRow[] = []
  let cumulative = 0

  for (const entry of entries) {
    const subtotal = entry.cost * entry.qty
    const before = cumulative
    cumulative += subtotal
    const sessionStart = Math.floor(before / xpPerSession) + 1
    const sessionEnd = subtotal > 0 ? Math.max(sessionStart, Math.ceil(cumulative / xpPerSession)) : sessionStart
    rows.push({
      id: entry.id,
      name: entry.name,
      cost: entry.cost,
      qty: entry.qty,
      subtotal,
      cumulative,
      sessionStart,
      sessionEnd,
    })
  }

  const totalXp = cumulative
  const sessions = Math.ceil(totalXp / xpPerSession)
  const bottleneck = rows.reduce<AdvancementRow | undefined>(
    (worst, row) => (!worst || row.subtotal > worst.subtotal ? row : worst),
    undefined,
  )

  const warnings: string[] = []
  if (!rows.length) warnings.push('Add at least one improvement to plan progression.')
  if (config.xpPerSession > 3) warnings.push('Pulso awards 1–3 XP per session; above 3 is a deliberate fast campaign.')
  if (sessions > 32) warnings.push('This plan runs longer than the 28–32 session reference campaign.')
  if (config.bonusXpPerSession > 0) {
    warnings.push('Combat XP is optional: 1× per antagonist per session (Elite +1, Chefe +2).')
  }

  return { totalXp, xpPerSession, sessions, rows, bottleneck, warnings }
}
