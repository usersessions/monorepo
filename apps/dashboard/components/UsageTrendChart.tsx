'use client'

/**
 * Minimal dependency-free stacked-area trend chart for daily feature usage (30 days).
 * Mirrors the visual language of TrendChart (--primary/--ink-2/--muted), extended to a
 * small palette for the top N features; "other" absorbs the long tail so the chart stays legible.
 */
const PALETTE = ['var(--primary)', 'var(--cyan)', 'var(--amber)', 'var(--green)', 'var(--red)', 'var(--muted-2)']

export function UsageTrendChart({
  days,
  series,
}: {
  days: string[]
  series: { name: string; values: number[] }[]
}) {
  const W = 760
  const H = 220
  const PAD = 20

  if (days.length < 2 || series.length === 0) {
    return (
      <div
        style={{
          background: 'var(--ink-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--rounded-md)',
          height: H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p className="font-sans-body" style={{ color: 'var(--muted-2)' }}>No usage recorded yet.</p>
      </div>
    )
  }

  const totals = days.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0))
  const max = Math.max(1, ...totals)
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (days.length - 1)
  const yFor = (v: number) => H - PAD - (v / max) * (H - PAD * 2)

  // Stack series bottom-up.
  const cumulative = days.map(() => 0)
  const bands = series.map((ser, si) => {
    const bottom = [...cumulative]
    const top = days.map((_, i) => {
      cumulative[i] += ser.values[i] ?? 0
      return cumulative[i]
    })
    const topPath = top.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ')
    const bottomPath = [...bottom]
      .map((v, i) => `L${x(days.length - 1 - i).toFixed(1)},${yFor(bottom[days.length - 1 - i]).toFixed(1)}`)
      .join(' ')
    return { name: ser.name, color: PALETTE[si % PALETTE.length], d: `${topPath} ${bottomPath} Z` }
  })

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-sm)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', background: 'var(--ink-2)', border: '1px solid var(--border)', borderRadius: 'var(--rounded-md)' }}
        role="img"
        aria-label="Daily feature usage, last 30 days"
      >
        {[0.25, 0.5, 0.75].map((pct) => (
          <line key={pct} x1={PAD} x2={W - PAD} y1={H - PAD - pct * (H - PAD * 2)} y2={H - PAD - pct * (H - PAD * 2)} stroke="var(--muted)" strokeOpacity={0.15} />
        ))}
        {bands.map((b) => (
          <path key={b.name} d={b.d} fill={b.color} fillOpacity={0.55} stroke={b.color} strokeWidth={1} />
        ))}
      </svg>
      <div className="flex" style={{ gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        {bands.map((b) => (
          <span key={b.name} className="font-mono-micro" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, display: 'inline-block' }} />
            {b.name}
          </span>
        ))}
      </div>
    </div>
  )
}
