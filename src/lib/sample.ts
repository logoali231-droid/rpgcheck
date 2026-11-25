import type { CharacterSheet, Project } from './types'
import { buildEnemy } from './pulso'
import { DEFAULT_FORMULAS } from './engine/formula'

const now = Date.now()

export function sampleProject(): Project {
  const boss = buildEnemy({ archetype: 'chefe', name: 'Director Voss' })
  const enforcer = buildEnemy({ archetype: 'elite', name: 'Corporate Enforcer', tricks: ['tatico'] })

  return {
    version: 3,
    name: 'Pulso d6 — Balance Studio',
    updatedAt: now,
    items: [
      { id: 'wheat', name: 'Wheat', kind: 'raw', unit: 'sheaf', nutrition: 45, notes: 'Grown on the valley farm.' },
      { id: 'flour', name: 'Flour', kind: 'crafted', unit: 'sack', nutrition: 0, notes: '' },
      { id: 'water', name: 'Spring Water', kind: 'raw', unit: 'flask', nutrition: 0, notes: '' },
      { id: 'dough', name: 'Dough', kind: 'crafted', unit: 'loaf', nutrition: 30, notes: '' },
      { id: 'bread', name: 'Hearth Bread', kind: 'crafted', unit: 'loaf', nutrition: 120, notes: 'Staple travel food.' },
      { id: 'iron_ore', name: 'Iron Ore', kind: 'raw', unit: 'chunk', nutrition: 0, notes: '' },
      { id: 'coal', name: 'Coal', kind: 'raw', unit: 'lump', nutrition: 0, notes: '' },
      { id: 'iron_ingot', name: 'Iron Ingot', kind: 'crafted', unit: 'bar', nutrition: 0, notes: '' },
      { id: 'iron_pickaxe', name: 'Iron Pickaxe', kind: 'crafted', unit: 'tool', nutrition: 0, notes: 'Acesso 3 tool.' },
      { id: 'sand', name: 'Sand', kind: 'raw', unit: 'pouch', nutrition: 0, notes: '' },
      { id: 'glass_flask', name: 'Glass Flask', kind: 'crafted', unit: 'flask', nutrition: 0, notes: '' },
      { id: 'herb', name: 'Sunleaf Herb', kind: 'raw', unit: 'bundle', nutrition: 8, notes: '' },
      { id: 'healing_potion', name: 'Healing Potion', kind: 'crafted', unit: 'vial', nutrition: 0, notes: 'Restores 3 Vitality.' },
    ],
    recipes: [
      {
        id: 'mill_flour', name: 'Mill Flour', outputItemId: 'flour', outputQty: 1,
        inputs: [{ itemId: 'wheat', qty: 2 }], craftTimeSec: 30, difficulty: 1,
        station: 'Mill', requires: [],
      },
      {
        id: 'knead_dough', name: 'Knead Dough', outputItemId: 'dough', outputQty: 1,
        inputs: [{ itemId: 'flour', qty: 1 }, { itemId: 'water', qty: 1 }], craftTimeSec: 20, difficulty: 1,
        station: 'Kitchen', requires: [],
      },
      {
        id: 'bake_bread', name: 'Bake Bread', outputItemId: 'bread', outputQty: 2,
        inputs: [{ itemId: 'dough', qty: 1 }], craftTimeSec: 45, difficulty: 2,
        station: 'Oven', requires: ['apprentice_cook'],
      },
      {
        id: 'smelt_iron', name: 'Smelt Iron', outputItemId: 'iron_ingot', outputQty: 1,
        inputs: [{ itemId: 'iron_ore', qty: 2 }, { itemId: 'coal', qty: 1 }], craftTimeSec: 40, difficulty: 2,
        station: 'Furnace', requires: [],
      },
      {
        id: 'forge_pickaxe', name: 'Forge Pickaxe', outputItemId: 'iron_pickaxe', outputQty: 1,
        inputs: [{ itemId: 'iron_ingot', qty: 2 }], craftTimeSec: 90, difficulty: 3,
        station: 'Anvil', requires: ['iron_age'],
      },
      {
        id: 'blow_glass', name: 'Blow Glass', outputItemId: 'glass_flask', outputQty: 1,
        inputs: [{ itemId: 'sand', qty: 2 }, { itemId: 'coal', qty: 1 }], craftTimeSec: 35, difficulty: 2,
        station: 'Kiln', requires: [],
      },
      {
        id: 'brew_potion', name: 'Brew Healing Potion', outputItemId: 'healing_potion', outputQty: 1,
        inputs: [{ itemId: 'herb', qty: 1 }, { itemId: 'glass_flask', qty: 1 }], craftTimeSec: 60, difficulty: 3,
        station: 'Alchemy Table', requires: ['alchemy'],
      },
    ],
    achievements: [
      { id: 'apprentice_cook', name: 'Apprentice Cook', requires: [], itemCost: [{ itemId: 'wheat', qty: 5 }] },
      { id: 'iron_age', name: 'Iron Age', requires: ['apprentice_cook'], itemCost: [{ itemId: 'iron_ingot', qty: 1 }] },
      { id: 'alchemy', name: 'Alchemy', requires: [], itemCost: [{ itemId: 'glass_flask', qty: 1 }] },
    ],
    dice: {
      pool: 5,
      threshold: 4,
      difficulty: 2,
      criticalSuccess: true,
      partialSuccess: true,
      bonusSuccesses: 0,
      penaltyDice: 0,
      opposed: false,
      opposedPool: 4,
    },
    advancement: {
      xpPerSession: 3,
      bonusXpPerSession: 0,
      entries: [
        { id: 'adv_skill_1', name: 'Perícia +1 (Luta)', cost: 2, qty: 2 },
        { id: 'adv_adv_1', name: 'New advantage', cost: 3, qty: 1 },
        { id: 'adv_attr_1', name: 'Atributo 2 → 3', cost: 6, qty: 1 },
      ],
    },
    combat: {
      iterations: 2000,
      maxRounds: 20,
      seed: 1337,
      criticalSuccess: true,
      finishDowned: false,
      meta: {
        title: 'Penthouse Extraction',
        kind: 'combat',
        objective: 'Get the defector out of the penthouse before security locks down the floor.',
        obstacle: 'Director Voss and his corporate enforcer hold the only exit.',
        consequence: 'The defector is lost and the corporation marks the crew.',
        complication: '',
        startZone: 'near',
      },
      combatants: [
        {
          id: 'kara', name: 'Kara Vex', side: 'ally', pool: 5, defense: 3, vitalityMax: 11,
          reduction: 1, damage: 3, initiative: 6, actionsPerTurn: 1, zone: 'near', tricks: [], threat: 0,
        },
        {
          id: 'ivo', name: 'Dr. Ivo', side: 'ally', pool: 4, defense: 2, vitalityMax: 9,
          reduction: 0, damage: 2, initiative: 7, actionsPerTurn: 1, zone: 'near', tricks: [], threat: 0,
        },
        {
          id: 'brann', name: 'Brann', side: 'ally', pool: 6, defense: 3, vitalityMax: 12,
          reduction: 2, damage: 3, initiative: 5, actionsPerTurn: 1, zone: 'melee', tricks: [], threat: 0,
        },
        {
          id: 'sable', name: 'Sable', side: 'ally', pool: 6, defense: 4, vitalityMax: 9,
          reduction: 1, damage: 4, initiative: 8, actionsPerTurn: 1, zone: 'far', tricks: [], threat: 0,
        },
        { ...boss, id: 'boss', side: 'foe' },
        { ...enforcer, id: 'enforcer', side: 'foe' },
      ],
    },
    survival: {
      days: 7,
      dayMinutes: 720,
      workMinutes: 300,
      startHealth: 100,
      hungerPerDay: 100,
      hungerGrowthPct: 4,
      healthLossPerMissingNutrition: 0.08,
      fatiguePerHour: 4,
      sources: [
        { itemId: 'wheat', gatherMinutes: 12, stock: 6 },
        { itemId: 'bread', gatherMinutes: 25, stock: 4 },
        { itemId: 'herb', gatherMinutes: 6, stock: 0 },
      ],
    },
    derivedFormulas: DEFAULT_FORMULAS.map((formula) => ({ ...formula })),
    characters: sampleCharacters(),
  }
}

function sampleCharacters(): CharacterSheet[] {
  return [
    {
      id: 'char_kara',
      name: 'Kara Vex',
      concept: 'Contrabandista espacial com dívidas e um coração maior que o bom senso.',
      scenario: 'Pulso — Cyberpunk',
      wealth: 2,
      modules: { magic: false, cyber: true, sanity: false, bonds: true, base: true },
      attributes: { corpo: 3, agilidade: 3, mente: 3, presenca: 4 },
      skills: {
        luta: 0, vigor: 0, atirar: 3, acrobacia: 1, furtividade: 1, conduzir: 0,
        percepcao: 2, saber: 0, tecnologia: 0, medicina: 0, sobrevivencia: 0,
        persuasao: 2, enganacao: 1, intimidacao: 0, empatia: 0,
      },
      saberArea: '',
      specializations: [{ id: 'spec_kara', skillId: 'atirar', name: 'Pistolas' }],
      currentVitality: 11,
      fatigue: 0,
      stress: 1,
      conditions: { unconscious: false, stabilized: false, overloaded: false },
      weapon: { name: 'Pistola', damage: 3, zone: 'near' },
      armor: { name: 'Jaqueta reforçada', reduction: 1 },
      kit: 'Arrombamento',
      otherGear: 'Comunicador, corda, lanterna',
      load: { weapon: 1, armor: 1, kit: 1, other: 1 },
      advantages: ['Reflexos Rápidos', 'Contatos no submundo'],
      disadvantages: ['Procurada pela corporação'],
      tempWealth: 1,
      leverage: 'Recibo falso da carga 7',
      contracts: 'Deve um favor ao Dr. Ivo',
      mysticLevel: 0,
      implantsUsed: 1,
      bonds: [
        { id: 'bond_kara_1', name: 'Dr. Ivo', value: 2, note: 'Velho sócio' },
        { id: 'bond_kara_2', name: 'Sable', value: 1, note: 'Dívida de resgate' },
      ],
      baseLevel: 0,
      domainLevel: 0,
      foodReserve: 1,
      notes: 'Sempre carrega uma bala de sinalizador. Tema: liberdade tem preço.',
    },
    {
      id: 'char_brann',
      name: 'Brann',
      concept: 'Ex-segurança que trocou o soldo pela liberdade.',
      scenario: 'Pulso — Cyberpunk',
      wealth: 1,
      modules: { magic: false, cyber: false, sanity: false, bonds: true, base: true },
      attributes: { corpo: 4, agilidade: 3, mente: 2, presenca: 2 },
      skills: {
        luta: 3, vigor: 3, atirar: 0, acrobacia: 1, furtividade: 0, conduzir: 0,
        percepcao: 2, saber: 0, tecnologia: 0, medicina: 0, sobrevivencia: 1,
        persuasao: 0, enganacao: 0, intimidacao: 0, empatia: 0,
      },
      saberArea: '',
      specializations: [{ id: 'spec_brann', skillId: 'luta', name: 'Espadas' }],
      currentVitality: 13,
      fatigue: 1,
      stress: 0,
      conditions: { unconscious: false, stabilized: false, overloaded: false },
      weapon: { name: 'Espada', damage: 3, zone: 'melee' },
      armor: { name: 'Malha de placas', reduction: 2 },
      kit: 'Ferramentas',
      otherGear: 'Cantil, kit de primeiros socorros',
      load: { weapon: 2, armor: 2, kit: 1, other: 0 },
      advantages: ['Resistente'],
      disadvantages: ['Código de honra'],
      tempWealth: 0,
      leverage: 'Nada que ele admite em voz alta',
      contracts: '',
      mysticLevel: 0,
      implantsUsed: 0,
      bonds: [{ id: 'bond_brann_1', name: 'Kara Vex', value: 1, note: 'Sócia relutante' }],
      baseLevel: 0,
      domainLevel: 0,
      foodReserve: 1,
      notes: 'Não ataca inimigos caídos, mesmo quando deveria.',
    },
  ]
}
