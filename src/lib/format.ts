export function fmtNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.abs(n) >= 1000 ? Math.round(n) : Number(n.toFixed(digits))
  return rounded.toLocaleString('en-US')
}

export function fmtPct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return '—'
  return `${(x * 100).toFixed(digits)}%`
}

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts: string[] = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!h && sec) parts.push(`${sec}s`)
  return parts.join(' ') || '0s'
}

export function fmtMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'entry'
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function uid(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${rand}`
}

export function parseNumberList(text: string): number[] {
  return text
    .split(/[,\s;]+/)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n) && n >= 0)
}
