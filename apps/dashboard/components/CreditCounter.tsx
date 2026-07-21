'use client'

import { useEffect, useState } from 'react'

/** TODO(pivot): wire to real credit metering in lib/tiers.ts once video plan limits land. */
export function CreditCounter() {
  const [credits, setCredits] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => setCredits(typeof d.videoCredits === 'number' ? d.videoCredits : null))
      .catch(() => setCredits(null))
  }, [])
  return (
    <span className="font-mono-micro" style={{ color: 'var(--muted)' }}>
      {credits === null ? 'credits: —' : `credits: ${credits}`}
    </span>
  )
}
