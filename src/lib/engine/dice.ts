import type { DiceConfig, DiceResult } from '../types'
import { clamp } from '../format'

export interface PoolResolution {
  dice: number
  autoSuccesses: number
}

/**
 * Pulso pool limits: minimum 1 die, maximum 12. Every 2 dice above 12 become
 * 1 automatic success.
 */
export function resolvePool(pool: number, penaltyDice = 0): PoolResolution {
  const effective = Math.max(1, Math.round(pool) - Math.max(0, Math.round(penaltyDice)))
  if (effective <= 12) return { dice: effective, autoSuccesses: 0 }
  return { dice: 12, autoSuccesses: Math.floor((effective - 12) / 2) }
}

export interface SuccessDistribution {
  dist: Map<number, number>
  mean: number
  dice: number
  autoSuccesses: number
  critFail: number
}

/**
 * Exact distribution of successes for a pool.
 * Faces 1–3 fail, 4–6 succeed. Optionally a 6 counts as two successes.
 * Critical failure = zero successes AND at least two 1s.
 */
export function successDistribution(
  pool: number,
  criticalSuccess: boolean,
  threshold = 4,
  penaltyDice = 0,
): SuccessDistribution {
  const { dice, autoSuccesses } = resolvePool(pool, penaltyDice)
  const target = clamp(Math.round(threshold), 2, 6)

  const faces = Array.from({ length: 6 }, (_, index) => {
    const face = index + 1
    const successes = face >= target ? (face === 6 && criticalSuccess ? 2 : 1) : 0
    return { successes, ones: face === 1 ? 1 : 0, p: 1 / 6 }
  })

  let states = new Map<string, number>([['0|0', 1]])
  for (let die = 0; die < dice; die++) {
    const next = new Map<string, number>()
    for (const [key, probability] of states) {
      const [successKey, oneKey] = key.split('|')
      const baseSuccesses = Number(successKey)
      const baseOnes = Number(oneKey)
      for (const face of faces) {
        const key2 = `${baseSuccesses + face.successes}|${Math.min(2, baseOnes + face.ones)}`
        next.set(key2, (next.get(key2) ?? 0) + probability * face.p)
      }
    }
    states = next
  }

  const dist = new Map<number, number>()
  let critFail = 0
  let mean = 0
  for (const [key, probability] of states) {
    const [successKey, oneKey] = key.split('|')
    const successes = Number(successKey)
    const ones = Number(oneKey)
    const total = successes + autoSuccesses
    dist.set(total, (dist.get(total) ?? 0) + probability)
    mean += total * probability
    if (successes === 0 && ones >= 2) critFail += probability
  }

  return { dist, mean, dice, autoSuccesses, critFail }
}

export interface DetailedRoll {
  faces: number[]
  successes: number
  ones: number
  hadSix: boolean
  dice: number
  autoSuccesses: number
}

/** Rolls a pool and returns the individual faces, for player-facing dice. */
export function rollDetailed(
  rng: () => number,
  pool: number,
  criticalSuccess: boolean,
  threshold = 4,
  penaltyDice = 0,
): DetailedRoll {
  const { dice, autoSuccesses } = resolvePool(pool, penaltyDice)
  const faces: number[] = []
  let successes = autoSuccesses
  let ones = 0
  let hadSix = false
  for (let die = 0; die < dice; die++) {
    const face = 1 + Math.floor(rng() * 6)
    faces.push(face)
    if (face === 1) ones++
    else if (face >= threshold) {
      successes += face === 6 && criticalSuccess ? 2 : 1
      if (face === 6) hadSix = true
    }
  }
  return { faces, successes, ones, hadSix, dice, autoSuccesses }
}

export function rollSuccesses(
  rng: () => number,
  pool: number,
  criticalSuccess: boolean,
  threshold = 4,
  penaltyDice = 0,
): { successes: number; ones: number; hadSix: boolean; dice: number } {
  const { dice, autoSuccesses } = resolvePool(pool, penaltyDice)
  let successes = autoSuccesses
  let ones = 0
  let hadSix = false
  for (let die = 0; die < dice; die++) {
    const face = 1 + Math.floor(rng() * 6)
    if (face === 1) ones++
    else if (face >= threshold) {
      successes += face === 6 && criticalSuccess ? 2 : 1
      if (face === 6) hadSix = true
    }
  }
  return { successes, ones, hadSix, dice }
}

export function computeDice(cfg: DiceConfig): DiceResult {
  const base = successDistribution(cfg.pool, cfg.criticalSuccess, cfg.threshold, cfg.penaltyDice)
  const bonus = Math.round(cfg.bonusSuccesses)

  const shifted = new Map<number, number>()
  for (const [value, probability] of base.dist) {
    shifted.set(value + bonus, (shifted.get(value + bonus) ?? 0) + probability)
  }

  const values = [...shifted.keys()].sort((a, b) => a - b)
  const support = values.map((value) => ({ value, prob: shifted.get(value) ?? 0 }))
  const atLeast: { value: number; prob: number }[] = new Array(support.length)
  let cumulative = 0
  for (let index = support.length - 1; index >= 0; index--) {
    cumulative += support[index].prob
    atLeast[index] = { value: support[index].value, prob: cumulative }
  }

  const mean = support.reduce((sum, row) => sum + row.value * row.prob, 0)
  const variance = support.reduce((sum, row) => sum + (row.value - mean) ** 2 * row.prob, 0)
  const difficulty = Math.round(cfg.difficulty)

  const result: DiceResult = {
    support,
    atLeast,
    mean,
    sd: Math.sqrt(Math.max(0, variance)),
    pSuccess: atLeast.find((row) => row.value >= difficulty)?.prob ?? 0,
    pExact: shifted.get(difficulty) ?? 0,
    pCritFail: bonus === 0 && base.autoSuccesses === 0 ? base.critFail : 0,
    pPartial: shifted.get(difficulty - 1) ?? 0,
    dice: base.dice,
    autoSuccesses: base.autoSuccesses,
    min: support[0]?.value ?? 0,
    max: support[support.length - 1]?.value ?? 0,
  }

  if (cfg.opposed) {
    const defender = successDistribution(cfg.opposedPool, cfg.criticalSuccess, cfg.threshold)
    let win = 0
    let tie = 0
    for (const [attackerValue, attackerProb] of shifted) {
      for (const [defenderValue, defenderProb] of defender.dist) {
        if (attackerValue > defenderValue) win += attackerProb * defenderProb
        else if (attackerValue === defenderValue) tie += attackerProb * defenderProb
      }
    }
    result.opposed = { win, tie, lose: Math.max(0, 1 - win - tie) }
  }

  return result
}
