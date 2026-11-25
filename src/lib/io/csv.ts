import type { Item, Project, Recipe } from '../types'
import { slugify } from '../format'

/** Parses CSV/TSV/SSV text (quoted fields supported) and guesses the delimiter. */
export function parseDelimited(text: string): { rows: string[][]; delimiter: string } {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!clean) return { rows: [], delimiter: ',' }
  const firstLine = clean.split('\n')[0]
  let delimiter = ','
  let bestCount = 0
  for (const candidate of ['\t', ';', ',']) {
    const count = firstLine.split(candidate).length
    if (count > bestCount) {
      bestCount = count
      delimiter = candidate
    }
  }

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  row.push(field)
  rows.push(row)
  return { rows: rows.filter((r) => r.some((cell) => cell.trim() !== '')), delimiter }
}

export function toCsv(rows: (string | number | undefined | null)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          return /[",\n;\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(','),
    )
    .join('\n')
}

/* ------------------------------------------------------------------ */
/* Spreadsheet importer                                                */
/* ------------------------------------------------------------------ */

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'item', 'item name', 'itemname', 'title', 'id'],
  kind: ['kind', 'type', 'category'],
  unit: ['unit', 'uom'],
  nutrition: ['nutrition', 'calories', 'food', 'food value', 'nutrition value'],
  time: ['time', 'craft time', 'crafttime', 'crafttimesec', 'seconds', 'sec', 'time (s)', 'duration'],
  difficulty: ['difficulty', 'dif', 'dc', 'craft difficulty'],
  inputs: ['inputs', 'ingredients', 'recipe', 'materials', 'requires', 'input'],
  qty: ['qty', 'quantity', 'amount', 'output', 'output qty', 'outputqty', 'yield'],
  station: ['station', 'bench', 'workstation', 'crafting station'],
  notes: ['notes', 'note', 'description', 'comment'],
}

function detectColumns(headers: string[]): Record<string, number> {
  const normalized = headers.map((h) =>
    h.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
  )
  const map: Record<string, number> = {}
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex((h) => aliases.includes(h))
    if (index >= 0) map[key] = index
  }
  return map
}

export function parseInputsCell(cell: string): { name: string; qty: number }[] {
  const trimmed = cell.trim()
  if (!trimmed) return []
  const chunks =
    trimmed.includes(';') || trimmed.includes('|') ? trimmed.split(/[;|]/) : trimmed.split(/\s*,\s*/)
  const result: { name: string; qty: number }[] = []
  for (const chunk of chunks) {
    const token = chunk.trim()
    if (!token) continue
    const match = token.match(/^(.+?)\s*(?:[:x×*]\s*(\d+(?:\.\d+)?))?$/)
    if (!match) continue
    const name = match[1].trim()
    const qty = match[2] ? Math.max(1, Math.round(Number(match[2]))) : 1
    if (name) result.push({ name, qty })
  }
  return result
}

export interface SheetImport {
  items: Item[]
  recipes: Recipe[]
  warnings: string[]
  headers: string[]
  rowCount: number
}

/**
 * Turns a pasted spreadsheet into connected items and recipes.
 * An `inputs` column links rows to other items (created as raw on demand).
 */
export function importSpreadsheet(project: Project, text: string): SheetImport {
  const { rows, delimiter } = parseDelimited(text)
  const warnings: string[] = []
  if (rows.length < 2) {
    return {
      items: [],
      recipes: [],
      warnings: ['Paste a header row plus at least one data row.'],
      headers: rows[0] ?? [],
      rowCount: 0,
    }
  }
  const headers = rows[0].map((h) => h.trim())
  const cols = detectColumns(headers)
  if (cols.name === undefined) {
    return {
      items: [],
      recipes: [],
      warnings: [
        `No name column found. Headers seen: ${headers.join(', ') || '(none)'} (delimiter “${
          delimiter === '\t' ? 'tab' : delimiter
        }”).`,
      ],
      headers,
      rowCount: rows.length - 1,
    }
  }

  const items: Item[] = []
  const recipes: Recipe[] = []
  const nameToId = new Map(project.items.map((i) => [i.name.trim().toLowerCase(), i.id]))
  const idTaken = new Set(project.items.map((i) => i.id))
  const createdByName = new Map<string, string>()

  const cell = (row: string[], key: string): string => {
    const index = cols[key]
    return index === undefined ? '' : (row[index] ?? '').trim()
  }

  const ensureItem = (
    name: string,
    opts: { kind?: 'raw' | 'crafted'; unit?: string; nutrition?: number; notes?: string } = {},
  ): string => {
    const key = name.trim().toLowerCase()
    const existing = nameToId.get(key) ?? createdByName.get(key)
    if (existing) return existing
    let id = slugify(name)
    let suffix = 2
    while (idTaken.has(id)) id = `${slugify(name)}_${suffix++}`
    idTaken.add(id)
    items.push({
      id,
      name: name.trim(),
      kind: opts.kind ?? 'raw',
      unit: opts.unit ?? '',
      nutrition: opts.nutrition ?? 0,
      notes: opts.notes ?? '',
    })
    createdByName.set(key, id)
    return id
  }

  rows.slice(1).forEach((row, rowIndex) => {
    const name = cell(row, 'name')
    if (!name) {
      warnings.push(`Row ${rowIndex + 2} skipped: empty name.`)
      return
    }
    const parsedInputs = parseInputsCell(cell(row, 'inputs'))
    const rawKind = cell(row, 'kind').toLowerCase()
    const kind: 'raw' | 'crafted' =
      rawKind === 'raw' ? 'raw' : parsedInputs.length || rawKind === 'crafted' ? 'crafted' : 'raw'
    const nutrition = Number(cell(row, 'nutrition')) || 0
    const unit = cell(row, 'unit')
    const notes = cell(row, 'notes')
    const outputId = ensureItem(name, { kind, unit, nutrition, notes })
    if (!parsedInputs.length) return

    const inputs = parsedInputs.map((ing) => ({
      itemId: ensureItem(ing.name),
      qty: ing.qty,
    }))
    let recipeId = slugify(`craft ${name}`)
    if (recipes.some((r) => r.id === recipeId) || project.recipes.some((r) => r.id === recipeId)) {
      recipeId = `${recipeId}_${rowIndex + 2}`
    }
    recipes.push({
      id: recipeId,
      name: `Craft ${name}`,
      outputItemId: outputId,
      outputQty: Math.max(1, Math.round(Number(cell(row, 'qty')) || 1)),
      inputs,
      craftTimeSec: Math.max(0, Number(cell(row, 'time')) || 0),
      difficulty: Math.min(6, Math.max(1, Math.round(Number(cell(row, 'difficulty')) || 2))),
      station: cell(row, 'station'),
      requires: [],
    })
  })

  if (!items.length && !recipes.length) warnings.push('Nothing importable was found.')
  return { items, recipes, warnings, headers, rowCount: rows.length - 1 }
}
