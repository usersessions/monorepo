interface TrendPoint {
  score: number
  computed_at: string
}

/**
 * The one shared chart (BUILD_SPEC §8): SVG line, --primary stroke, --ink-2 background,
 * --muted gridlines. Fewer than 2 points renders an HONEST placeholder, never a blank box.
 */
export function TrendChart({ points, height = 200 }: { points: TrendPoint[]; height?: number }) {
  const W = 600
  const H = height
  const PAD = 16

  if (points.length < 2) {
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
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: PAD,
            right: PAD,
            top: '50%',
            borderTop: '1px dashed var(--muted-2)',
          }}
        />
        <p className="font-sans-body" style={{ position: 'relative', color: 'var(--muted-2)' }}>
          Trend appears after your first few days of data
        </p>
      </div>
    )
  }

  const sorted = [...points].sort(
    (a, b) => new Date(a.computed_at).getTime() - new Date(b.computed_at).getTime()
  )
  const xs = sorted.map((_, i) => PAD + (i * (W - PAD * 2)) / (sorted.length - 1))
  const ys = sorted.map((p) => H - PAD - (p.score / 100) * (H - PAD * 2))
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: '100%',
        background: 'var(--ink-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--rounded-md)',
      }}
      role="img"
      aria-label="Distribution Score trend"
    >
      {[25, 50, 75].map((pct) => (
        <line
          key={pct}
          x1={PAD}
          x2={W - PAD}
          y1={H - PAD - (pct / 100) * (H - PAD * 2)}
          y2={H - PAD - (pct / 100) * (H - PAD * 2)}
          stroke="var(--muted)"
          strokeOpacity={0.15}
        />
      ))}
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} />
    </svg>
  )
}
