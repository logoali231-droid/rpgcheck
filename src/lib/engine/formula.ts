import type { DerivedFormula } from '../types'

/* A tiny, safe expression evaluator for editable derived formulas.
   Supports + - * / % ^, parentheses, numbers, variables and
   floor/ceil/round/abs/min/max. No eval, no access to the page. */

const FUNCTIONS: Record<string, { min: number; max: number; fn: (...args: number[]) => number }> = {
  floor: { min: 1, max: 1, fn: Math.floor },
  ceil: { min: 1, max: 1, fn: Math.ceil },
  round: { min: 1, max: 1, fn: Math.round },
  abs: { min: 1, max: 1, fn: Math.abs },
  sqrt: { min: 1, max: 1, fn: Math.sqrt },
  min: { min: 1, max: 8, fn: (...args: number[]) => Math.min(...args) },
  max: { min: 1, max: 8, fn: (...args: number[]) => Math.max(...args) },
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let index = 0
  while (index < input.length) {
    const char = input[index]
    if (/\s/.test(char)) {
      index++
      continue
    }
    const rest = input.slice(index)
    const number = rest.match(/^\d+(?:\.\d+)?/)
    if (number) {
      tokens.push(number[0])
      index += number[0].length
      continue
    }
    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (identifier) {
      tokens.push(identifier[0])
      index += identifier[0].length
      continue
    }
    if ('+-*/%^(),'.includes(char)) {
      tokens.push(char)
      index++
      continue
    }
    throw new Error(`Unexpected character “${char}”`)
  }
  return tokens
}

class Parser {
  private position = 0

  constructor(
    private readonly tokens: string[],
    private readonly variables: Record<string, number>,
  ) {}

  parse(): number {
    const value = this.expression()
    if (this.position < this.tokens.length) {
      throw new Error(`Unexpected “${this.tokens[this.position]}”`)
    }
    return value
  }

  private peek(): string | undefined {
    return this.tokens[this.position]
  }

  private next(): string {
    const token = this.tokens[this.position]
    this.position++
    return token
  }

  private expect(token: string) {
    if (this.next() !== token) throw new Error(`Expected “${token}”`)
  }

  private expression(): number {
    let value = this.term()
    while (this.peek() === '+' || this.peek() === '-') {
      const operator = this.next()
      const right = this.term()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  private term(): number {
    let value = this.unary()
    while (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') {
      const operator = this.next()
      const right = this.unary()
      if ((operator === '/' || operator === '%') && right === 0) throw new Error('Division by zero')
      value = operator === '*' ? value * right : operator === '/' ? value / right : value % right
    }
    return value
  }

  private unary(): number {
    if (this.peek() === '-') {
      this.next()
      return -this.unary()
    }
    if (this.peek() === '+') {
      this.next()
      return this.unary()
    }
    return this.power()
  }

  private power(): number {
    const base = this.primary()
    if (this.peek() === '^') {
      this.next()
      return Math.pow(base, this.unary())
    }
    return base
  }

  private primary(): number {
    const token = this.next()
    if (token === undefined) throw new Error('Unexpected end of formula')
    if (token === '(') {
      const value = this.expression()
      this.expect(')')
      return value
    }
    if (/^\d/.test(token)) return Number(token)
    if (/^[A-Za-z_]/.test(token)) {
      const name = token.toLowerCase()
      if (this.peek() === '(') {
        this.next()
        const args: number[] = []
        if (this.peek() !== ')') {
          args.push(this.expression())
          while (this.peek() === ',') {
            this.next()
            args.push(this.expression())
          }
        }
        this.expect(')')
        const fn = FUNCTIONS[name]
        if (!fn) throw new Error(`Unknown function “${token}”`)
        if (args.length < fn.min || args.length > fn.max) {
          throw new Error(`${token}() takes ${fn.min === fn.max ? fn.min : `${fn.min}–${fn.max}`} value(s)`)
        }
        return fn.fn(...args)
      }
      if (name in this.variables) return this.variables[name]
      throw new Error(`Unknown value “${token}”`)
    }
    throw new Error(`Unexpected “${token}”`)
  }
}

export function evaluateExpression(expression: string, variables: Record<string, number>): number {
  const tokens = tokenize(expression)
  if (!tokens.length) throw new Error('Formula is empty')
  const scoped = { ...variables }
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (target in scoped && !(alias in scoped)) scoped[alias] = scoped[target]
  }
  const value = new Parser(tokens, scoped).parse()
  if (!Number.isFinite(value)) throw new Error('Formula did not produce a finite number')
  return value
}

export interface FormulaEvaluation {
  values: Record<string, number>
  errors: Record<string, string>
}

const ALIASES: Record<string, string> = {
  cor: 'corpo',
  agi: 'agilidade',
  men: 'mente',
  pre: 'presenca',
}

/**
 * Evaluates formulas with dependency resolution: a formula may reference any
 * attribute, alias or another derived id, regardless of order.
 */
export function evaluateFormulas(
  formulas: DerivedFormula[],
  base: Record<string, number>,
): FormulaEvaluation {
  const values: Record<string, number> = { ...base }
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (target in values) values[alias] = values[target]
  }
  const errors: Record<string, string> = {}
  let pending = formulas.filter((formula) => formula.expression.trim() !== '')

  for (let pass = 0; pass < formulas.length + 2 && pending.length; pass++) {
    const next: DerivedFormula[] = []
    let progressed = false
    for (const formula of pending) {
      try {
        values[formula.id] = evaluateExpression(formula.expression, values)
        progressed = true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid formula'
        if (message.startsWith('Unknown value')) next.push(formula)
        else errors[formula.id] = message
      }
    }
    pending = next
    if (!progressed) break
  }

  for (const formula of pending) {
    try {
      values[formula.id] = evaluateExpression(formula.expression, values)
    } catch (error) {
      errors[formula.id] = error instanceof Error ? error.message : 'Invalid formula'
    }
  }

  return { values, errors }
}

export const DEFAULT_FORMULAS: DerivedFormula[] = [
  { id: 'vitalityMax', label: 'Vitalidade Máx', expression: '5 + corpo * 2', builtin: true },
  { id: 'initiative', label: 'Iniciativa', expression: 'agilidade + mente', builtin: true },
  { id: 'defense', label: 'Defesa', expression: 'agilidade', builtin: true },
  { id: 'willpower', label: 'Vontade', expression: 'presenca + mente', builtin: true },
  { id: 'inventory', label: 'Espaços', expression: 'corpo + 3', builtin: true },
]

export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS)
export const FORMULA_VARIABLES = ['corpo', 'agilidade', 'mente', 'presenca', 'cor', 'agi', 'men', 'pre']
