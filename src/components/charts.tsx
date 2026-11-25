interface BarDatum {
  label: string
  value: number
  sub?: string
}

const WIDTH = 820
const PADDING = { left: 38, right: 10, top: 12, bottom: 26 }

export function BarChart({
  data,
  height = 200,
  color = '#7ee787',
  format = (value: number) => String(value),
  highlightIndex,
}: {
  data: BarDatum[]
  height?: number
  color?: string
  format?: (value: number) => string
  highlightIndex?: number
}) {
  if (!data.length) return <p className="empty">No data.</p>
  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = height - PADDING.top - PADDING.bottom
  const maxValue = Math.max(...data.map((d) => d.value), 0.0001)
  const slot = innerWidth / data.length
  const barWidth = Math.max(1, slot * 0.72)
  const labelEvery = Math.max(1, Math.ceil(data.length / 16))

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Bar chart">
      {[0, 0.5, 1].map((tick) => {
        const y = PADDING.top + innerHeight * (1 - tick)
        return (
          <g key={tick}>
            <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} className="chart__grid" />
            <text x={PADDING.left - 6} y={y + 3} className="chart__axis" textAnchor="end">
              {format(maxValue * tick)}
            </text>
          </g>
        )
      })}
      {data.map((datum, index) => {
        const barHeight = Math.max(0, (datum.value / maxValue) * innerHeight)
        const x = PADDING.left + slot * index + (slot - barWidth) / 2
        const y = PADDING.top + innerHeight - barHeight
        return (
          <g key={`${datum.label}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill={color}
              opacity={highlightIndex === undefined || highlightIndex === index ? 0.85 : 0.35}
            >
              <title>{`${datum.label}: ${datum.sub ?? format(datum.value)}`}</title>
            </rect>
            {index % labelEvery === 0 ? (
              <text x={x + barWidth / 2} y={height - 8} className="chart__axis" textAnchor="middle">
                {datum.label}
              </text>
            ) : null}
          </g>
        )
      })}
      <line
        x1={PADDING.left}
        y1={PADDING.top + innerHeight}
        x2={WIDTH - PADDING.right}
        y2={PADDING.top + innerHeight}
        className="chart__axis-line"
      />
    </svg>
  )
}

export function LineChart({
  points,
  height = 180,
  color = '#58a6ff',
  format = (value: number) => String(value),
}: {
  points: { label: string; value: number }[]
  height?: number
  color?: string
  format?: (value: number) => string
}) {
  if (points.length === 0) return <p className="empty">No data.</p>
  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = height - PADDING.top - PADDING.bottom
  const values = points.map((p) => p.value)
  const maxValue = Math.max(...values, 1)
  const minValue = Math.min(...values, 0)
  const range = Math.max(1, maxValue - minValue)
  const slot = points.length > 1 ? innerWidth / (points.length - 1) : 0
  const xOf = (index: number) => PADDING.left + (points.length > 1 ? slot * index : innerWidth / 2)
  const yOf = (value: number) => PADDING.top + innerHeight - ((value - minValue) / range) * innerHeight
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ')
  const labelEvery = Math.max(1, Math.ceil(points.length / 14))

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Line chart">
      {[0, 0.5, 1].map((tick) => {
        const value = minValue + range * tick
        const y = yOf(value)
        return (
          <g key={tick}>
            <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} className="chart__grid" />
            <text x={PADDING.left - 6} y={y + 3} className="chart__axis" textAnchor="end">
              {format(value)}
            </text>
          </g>
        )
      })}
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {points.map((p, index) => (
        <g key={`${p.label}-${index}`}>
          <circle cx={xOf(index)} cy={yOf(p.value)} r={2.6} fill={color}>
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
          {index % labelEvery === 0 ? (
            <text x={xOf(index)} y={height - 8} className="chart__axis" textAnchor="middle">
              {p.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}
