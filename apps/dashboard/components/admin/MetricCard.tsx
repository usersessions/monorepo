import DeltaBadge, { type DeltaPeriod } from './DeltaBadge'
import Sparkline from './Sparkline'

export type Metric = {
  label: string
  value: string | number
  sub?: string
  delta?: number | null
  period?: DeltaPeriod
  spark?: number[]
}

// Dense metric card: label + delta badge on top, serif number, sparkline, muted subtext.
export default function MetricCard({ label, value, sub, delta, period, spark }: Metric) {
  return (
    <div className="card card--dense">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <p className="font-mono-label">{label}</p>
        {delta !== undefined ? <DeltaBadge value={delta} period={period} /> : null}
      </div>
      <p className="font-serif-metric">{value}</p>
      {spark && spark.length > 1 ? <Sparkline points={spark} /> : null}
      {sub ? <p className="font-mono-micro">{sub}</p> : null}
    </div>
  )
}
