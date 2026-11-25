import type { CombatConfig, Combatant } from '../types'
import { clamp } from '../format'
import { nearestBand, threatTargets, zoneIndex, type ThreatBand } from '../pulso'
import { rollSuccesses, successDistribution } from './dice'

/** Deterministic, seedable PRNG so every run is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface CombatantStats {
  id: string
  name: string
  side: 'ally' | 'foe'
  maxVitality: number
  avgDamageDealt: number
  avgDamageTaken: number
  survivalRate: number
  deathRate: number
}

export interface CombatResult {
  iterations: number
  allyWins: number
  foeWins: number
  draws: number
  allyWinRate: number
  foeWinRate: number
  drawRate: number
  avgRounds: number
  avgWinRounds: number
  avgLoseRounds: number
  roundHistogram: { round: number; count: number }[]
  avgAllyVitalityLeft: number
  avgAllyDeaths: number
  avgFoeDeaths: number
  stats: CombatantStats[]
  log: string[]
  error?: string
}

interface Fighter {
  source: Combatant
  vitality: number
  maxVitality: number
  downed: boolean
  dying: boolean
  dead: boolean
}

interface BattleOutcome {
  winner: 'ally' | 'foe' | 'draw'
  rounds: number
  allyVitalityLeft: number
  allyDeaths: number
  foeDeaths: number
  damageDealt: Map<string, number>
  damageTaken: Map<string, number>
  survivors: Set<string>
  deaths: Set<string>
  log: string[]
}

const reductionOf = (fighter: Fighter): number =>
  fighter.source.reduction + (fighter.source.tricks.includes('blindado') ? 1 : 0)

function simulateBattle(cfg: CombatConfig, rng: () => number, logEnabled: boolean): BattleOutcome {
  const log: string[] = []
  const fighters: Fighter[] = cfg.combatants.map((source) => ({
    source,
    vitality: source.vitalityMax,
    maxVitality: source.vitalityMax,
    downed: false,
    dying: false,
    dead: false,
  }))
  const damageDealt = new Map<string, number>()
  const damageTaken = new Map<string, number>()

  // Fixed initiative (Agility + Mind); ties are broken with 1d6.
  const initiative = fighters.map((fighter) => ({
    fighter,
    value: fighter.source.initiative,
    tieBreaker: 1 + Math.floor(rng() * 6),
  }))
  initiative.sort((a, b) => b.value - a.value || b.tieBreaker - a.tieBreaker)
  const order = initiative.map((entry) => entry.fighter)

  if (logEnabled) {
    log.push(
      `Initiative: ${order
        .map((f) => `${f.source.name} ${f.source.vitalityMax} Vit (${f.source.defense} Def)`)
        .join(' → ')}`,
    )
    log.push(`Starting distance: ${cfg.meta.startZone}`)
  }

  const standing = (side: 'ally' | 'foe') =>
    fighters.filter((f) => f.source.side === side && f.vitality > 0 && !f.dead)

  let distance = zoneIndex(cfg.meta.startZone)
  let rounds = 0
  const maxRounds = Math.max(1, cfg.maxRounds)

  while (rounds < maxRounds) {
    if (standing('ally').length === 0 || standing('foe').length === 0) break
    rounds++
    if (logEnabled && rounds <= 5) log.push(`— Round ${rounds} —`)

    // The melee line closes one zone per round.
    const anyMelee = fighters.some(
      (f) => !f.dead && f.vitality > 0 && f.source.zone === 'melee',
    )
    if (anyMelee && distance > 0) distance -= 1

    for (const fighter of order) {
      if (fighter.dead) continue

      if (fighter.dying) {
        const resistente = fighter.source.tricks.includes('resistente')
        let save = rollSuccesses(rng, fighter.source.pool, cfg.criticalSuccess).successes
        if (resistente && save < 3) {
          save = Math.max(save, rollSuccesses(rng, fighter.source.pool, cfg.criticalSuccess).successes)
        }
        if (save < 3) {
          fighter.dead = true
          fighter.dying = false
          if (logEnabled) log.push(`${fighter.source.name} fails the Vigor (3) save and dies.`)
          continue
        }
        if (logEnabled) log.push(`${fighter.source.name} clings to life (Vigor ${save}).`)
      }

      if (fighter.downed) continue

      if (fighter.source.tricks.includes('regenera') && fighter.vitality > 0) {
        fighter.vitality = Math.min(fighter.maxVitality, fighter.vitality + 2)
      }

      const actions =
        Math.max(1, fighter.source.actionsPerTurn) + (fighter.source.tricks.includes('rapido') ? 1 : 0)

      for (let action = 0; action < actions; action++) {
        const opponents = fighters.filter(
          (f) => f.source.side !== fighter.source.side && !f.dead && (cfg.finishDowned || f.vitality > 0),
        )
        if (!opponents.length) break
        const target = opponents[Math.floor(rng() * opponents.length)]

        const zonePenalty = Math.abs(distance - zoneIndex(fighter.source.zone))
        const tactician = fighters.some(
          (f) =>
            f !== fighter &&
            !f.dead &&
            f.vitality > 0 &&
            f.source.side === fighter.source.side &&
            f.source.tricks.includes('tatico'),
        )
        const pool = Math.max(1, fighter.source.pool - zonePenalty + (tactician ? 1 : 0))
        const roll = rollSuccesses(rng, pool, cfg.criticalSuccess)

        if (roll.successes < target.source.defense) {
          if (logEnabled && rounds <= 5) {
            log.push(
              `${fighter.source.name} attacks ${target.source.name}: ${roll.successes} vs ${target.source.defense} Def — miss` +
                (zonePenalty ? ` (−${zonePenalty} zone)` : ''),
            )
          }
          continue
        }

        const excess = roll.successes - target.source.defense
        const forte = roll.hadSix && fighter.source.tricks.includes('forte') ? 2 : 0
        const raw = fighter.source.damage + excess + forte
        const final = Math.max(0, raw - reductionOf(target))
        damageDealt.set(fighter.source.id, (damageDealt.get(fighter.source.id) ?? 0) + final)
        damageTaken.set(target.source.id, (damageTaken.get(target.source.id) ?? 0) + final)

        let killed = false
        if (target.vitality > 0) {
          if (final >= target.maxVitality + target.vitality) {
            killed = true
            target.vitality = 0
            target.dead = true
          } else {
            target.vitality = Math.max(0, target.vitality - final)
            if (target.vitality === 0) target.downed = true
          }
        } else if (!target.dead) {
          if (final >= target.maxVitality) {
            killed = true
            target.dead = true
          } else {
            target.dying = true
          }
        }

        if (logEnabled && rounds <= 5) {
          log.push(
            `${fighter.source.name} hits ${target.source.name} for ${final}` +
              (forte ? ' (Forte)' : '') +
              (killed
                ? ` — instant death!`
                : target.vitality === 0
                  ? ` — ${target.downed ? 'down (Caído)' : 'dying (Morrendo)'}`
                  : ` (${target.vitality}/${target.maxVitality} Vit)`),
          )
        }
      }
    }
  }

  const allies = fighters.filter((f) => f.source.side === 'ally')
  const foes = fighters.filter((f) => f.source.side === 'foe')
  const alliesUp = allies.filter((f) => f.vitality > 0 && !f.dead)
  const foesUp = foes.filter((f) => f.vitality > 0 && !f.dead)

  const winner: BattleOutcome['winner'] =
    alliesUp.length > 0 && foesUp.length === 0
      ? 'ally'
      : foesUp.length > 0 && alliesUp.length === 0
        ? 'foe'
        : 'draw'

  return {
    winner,
    rounds,
    allyVitalityLeft: alliesUp.reduce((sum, f) => sum + f.vitality, 0),
    allyDeaths: allies.filter((f) => f.dead).length,
    foeDeaths: foes.filter((f) => f.dead).length,
    damageDealt,
    damageTaken,
    survivors: new Set(fighters.filter((f) => f.vitality > 0 && !f.dead).map((f) => f.source.id)),
    deaths: new Set(fighters.filter((f) => f.dead).map((f) => f.source.id)),
    log,
  }
}

export function runCombat(cfg: CombatConfig): CombatResult {
  const empty: CombatResult = {
    iterations: 0,
    allyWins: 0,
    foeWins: 0,
    draws: 0,
    allyWinRate: 0,
    foeWinRate: 0,
    drawRate: 0,
    avgRounds: 0,
    avgWinRounds: 0,
    avgLoseRounds: 0,
    roundHistogram: [],
    avgAllyVitalityLeft: 0,
    avgAllyDeaths: 0,
    avgFoeDeaths: 0,
    stats: [],
    log: [],
  }

  const allies = cfg.combatants.filter((c) => c.side === 'ally')
  const foes = cfg.combatants.filter((c) => c.side === 'foe')
  if (!allies.length || !foes.length) {
    return { ...empty, error: 'Add at least one party member and one enemy.' }
  }

  const iterations = Math.round(clamp(cfg.iterations, 10, 20000))
  const rng = mulberry32(cfg.seed)
  const stats = new Map<string, { dealt: number; taken: number; survived: number; died: number }>()
  for (const combatant of cfg.combatants) {
    stats.set(combatant.id, { dealt: 0, taken: 0, survived: 0, died: 0 })
  }

  let allyWins = 0
  let foeWins = 0
  let draws = 0
  let totalRounds = 0
  let winRounds = 0
  let loseRounds = 0
  let allyVitalityTotal = 0
  let allyDeaths = 0
  let foeDeaths = 0
  const histogram = new Map<number, number>()
  let sampleLog: string[] = []

  for (let index = 0; index < iterations; index++) {
    const outcome = simulateBattle(cfg, rng, index === 0)
    if (index === 0) sampleLog = outcome.log
    totalRounds += outcome.rounds
    histogram.set(outcome.rounds, (histogram.get(outcome.rounds) ?? 0) + 1)
    allyDeaths += outcome.allyDeaths
    foeDeaths += outcome.foeDeaths

    if (outcome.winner === 'ally') {
      allyWins++
      winRounds += outcome.rounds
      allyVitalityTotal += outcome.allyVitalityLeft
    } else if (outcome.winner === 'foe') {
      foeWins++
      loseRounds += outcome.rounds
    } else {
      draws++
    }

    for (const combatant of cfg.combatants) {
      const bucket = stats.get(combatant.id)!
      bucket.dealt += outcome.damageDealt.get(combatant.id) ?? 0
      bucket.taken += outcome.damageTaken.get(combatant.id) ?? 0
      if (outcome.survivors.has(combatant.id)) bucket.survived++
      if (outcome.deaths.has(combatant.id)) bucket.died++
    }
  }

  return {
    iterations,
    allyWins,
    foeWins,
    draws,
    allyWinRate: allyWins / iterations,
    foeWinRate: foeWins / iterations,
    drawRate: draws / iterations,
    avgRounds: totalRounds / iterations,
    avgWinRounds: allyWins ? winRounds / allyWins : 0,
    avgLoseRounds: foeWins ? loseRounds / foeWins : 0,
    roundHistogram: [...histogram.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, count]) => ({ round, count })),
    avgAllyVitalityLeft: allyWins ? allyVitalityTotal / allyWins : 0,
    avgAllyDeaths: allyDeaths / iterations,
    avgFoeDeaths: foeDeaths / iterations,
    stats: cfg.combatants.map((combatant) => {
      const bucket = stats.get(combatant.id)!
      return {
        id: combatant.id,
        name: combatant.name,
        side: combatant.side,
        maxVitality: combatant.vitalityMax,
        avgDamageDealt: bucket.dealt / iterations,
        avgDamageTaken: bucket.taken / iterations,
        survivalRate: bucket.survived / iterations,
        deathRate: bucket.died / iterations,
      }
    }),
    log: sampleLog,
  }
}

/* ------------------------------ analytics ----------------------------- */

export interface MatchupRow {
  attackerId: string
  attackerName: string
  attackerSide: 'ally' | 'foe'
  targetId: string
  targetName: string
  hitChance: number
  avgDamage: number
  maxDamage: number
}

/**
 * Analytic attack profile per pair: chance to meet Defense and expected final
 * damage after the target's reduction. Uses the starting distance zone and
 * ignores conditional tricks (Forte/Tático), matching a plain first attack.
 */
export function matchupMatrix(cfg: CombatConfig): MatchupRow[] {
  const rows: MatchupRow[] = []
  const startDistance = zoneIndex(cfg.meta.startZone)
  for (const attacker of cfg.combatants) {
    const penalty = Math.abs(startDistance - zoneIndex(attacker.zone))
    const distribution = successDistribution(attacker.pool, cfg.criticalSuccess, 4, penalty)
    for (const target of cfg.combatants) {
      if (target.side === attacker.side) continue
      const reduction = target.reduction + (target.tricks.includes('blindado') ? 1 : 0)
      let hitChance = 0
      let expected = 0
      let maxDamage = 0
      for (const [successes, probability] of distribution.dist) {
        if (successes < target.defense) continue
        hitChance += probability
        const excess = successes - target.defense
        const final = Math.max(0, attacker.damage + excess - reduction)
        expected += final * probability
        maxDamage = Math.max(maxDamage, final)
      }
      rows.push({
        attackerId: attacker.id,
        attackerName: attacker.name,
        attackerSide: attacker.side,
        targetId: target.id,
        targetName: target.name,
        hitChance,
        avgDamage: expected,
        maxDamage,
      })
    }
  }
  return rows
}

export interface ThreatReport {
  partySize: number
  totalThreat: number
  targets: (ThreatBand & { delta: number })[]
  nearest: ThreatBand
  warnings: string[]
}

export function threatReport(cfg: CombatConfig): ThreatReport {
  const allies = cfg.combatants.filter((combatant) => combatant.side === 'ally')
  const foes = cfg.combatants.filter((combatant) => combatant.side === 'foe')
  const partySize = allies.length
  const totalThreat = foes.reduce((sum, foe) => sum + foe.threat, 0)
  const targets = threatTargets(partySize).map((band) => ({ ...band, delta: totalThreat - band.target }))
  const nearest = nearestBand(totalThreat, partySize)
  const warnings: string[] = []

  if (!partySize) warnings.push('No party members yet — threat bands need at least one PC.')
  if (!foes.length) warnings.push('No opposition yet.')
  if (partySize && foes.length > partySize * 2) {
    warnings.push('More than two enemies per PC: the action economy may overwhelm the party.')
  }

  const archetypes = new Set(foes.map((foe) => foe.archetype ?? 'custom'))
  if (foes.length > 1 && archetypes.size === 1) {
    warnings.push('All enemies share the same archetype — the rules recommend mixing at least two types.')
  }

  const hordas = foes.filter((foe) => foe.archetype === 'horda').length
  if (hordas === 1 && totalThreat >= Math.max(1, partySize)) {
    warnings.push('A single Horda is only Threat ½ and should not anchor a medium encounter.')
  }

  const legendaries = foes.filter((foe) => foe.archetype === 'lendario').length
  if (legendaries > 1) warnings.push('More than one Legendary: reserve them for separate arcs.')

  const maxDefense = allies.reduce((max, ally) => Math.max(max, ally.defense), 0)
  for (const foe of foes) {
    if (partySize && foe.pool < maxDefense) {
      warnings.push(
        `${foe.name} (pool ${foe.pool}) cannot reach Defense ${maxDefense} without a critical success (6 = 2 successes).`,
      )
    }
  }

  if (!cfg.meta.objective.trim() || !cfg.meta.obstacle.trim() || !cfg.meta.consequence.trim()) {
    warnings.push('An encounter needs an objective, an obstacle and a consequence — otherwise it is just a scene.')
  }

  if (cfg.meta.kind !== 'combat') {
    warnings.push('The lab simulates the combat portion only; other encounter types use extended or opposed tests.')
  }

  if (cfg.meta.startZone === 'far' && foes.length && foes.every((foe) => foe.zone === 'melee')) {
    warnings.push('All enemies are melee and the fight starts at Longe: the party gets two free rounds of attacks.')
  }

  return { partySize, totalThreat, targets, nearest, warnings }
}
