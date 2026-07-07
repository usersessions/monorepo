'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActionPlan } from '@usersessions/shared'

interface SessionRow {
  id: string
  platform_id: string
  status: 'running' | 'paused' | 'completed' | 'failed'
  current_step: number
  total_steps: number
  paused_reason: string | null
  simulated: boolean
  result: string | null
  created_at: string
  updated_at: string
}

interface LogRow {
  id: string
  step_index: number
  perception_url: string | null
  perception_page_type: string | null
  plan: ActionPlan | null
  created_at: string
}

const STATUS_COLOR: Record<SessionRow['status'], string> = {
  running: '#2563EB',
  paused: '#B45309',
  completed: '#15803D',
  failed: '#B91C1C',
}

/**
 * Real-time agent monitor — subscribes to agent_sessions (Supabase Realtime,
 * publication added in migration 0021) and shows per-step planner logs.
 * Pause/resume happens in the extension popup; this page is the observability side.
 */
export function AgentMonitor() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogRow[]>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('agent_sessions')
      .select('id, platform_id, status, current_step, total_steps, paused_reason, simulated, result, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)
    setSessions((data as SessionRow[]) ?? [])
  }, [])

  useEffect(() => {
    void load()
    const supabase = createClient()
    const channel = supabase
      .channel('agent-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_sessions' }, () => void load())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (!selected) {
      setLogs([])
      return
    }
    const supabase = createClient()
    void supabase
      .from('agent_logs')
      .select('id, step_index, perception_url, perception_page_type, plan, created_at')
      .eq('session_id', selected)
      .order('step_index', { ascending: true })
      .limit(100)
      .then(({ data }) => setLogs((data as LogRow[]) ?? []))
  }, [selected, sessions])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Agent monitor</h1>
        <p style={{ opacity: 0.7, fontSize: 13 }}>
          Live view of Computer Use sessions. Paused sessions are resumed from the extension popup — the agent
          waits for you on logins and CAPTCHAs, it never bypasses them.
        </p>
      </div>

      {sessions.length === 0 && <p style={{ opacity: 0.7 }}>No agent sessions yet. Start one from the extension popup.</p>}

      {sessions.map((s) => {
        const total = Math.max(s.total_steps, 1)
        const pct = Math.min(100, Math.round((s.current_step / total) * 100))
        return (
          <div
            key={s.id}
            onClick={() => setSelected(selected === s.id ? null : s.id)}
            style={{ border: '1px solid rgba(127,127,127,0.3)', borderRadius: 8, padding: 12, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong>{s.platform_id}</strong>
              <span style={{ color: STATUS_COLOR[s.status], fontWeight: 600 }}>
                {s.status}
                {s.result ? ` · ${s.result}` : ''}
                {s.simulated ? ' · simulation' : ' · live'}
              </span>
            </div>
            <div style={{ background: 'rgba(127,127,127,0.2)', height: 6, borderRadius: 3, margin: '8px 0' }}>
              <div style={{ width: `${pct}%`, background: STATUS_COLOR[s.status], height: 6, borderRadius: 3 }} />
            </div>
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              step {Math.min(s.current_step + 1, total)} of {total} · updated {new Date(s.updated_at).toLocaleTimeString()}
            </p>
            {s.paused_reason && (
              <p style={{ fontSize: 12, color: '#B45309' }}>
                {s.paused_reason} — resume from the extension popup.
              </p>
            )}

            {selected === s.id && (
              <div style={{ marginTop: 8, borderTop: '1px solid rgba(127,127,127,0.2)', paddingTop: 8 }}>
                {logs.length === 0 && <p style={{ fontSize: 12, opacity: 0.7 }}>No planner logs for this session.</p>}
                {logs.map((log) => (
                  <details key={log.id} style={{ fontSize: 12, marginBottom: 6 }}>
                    <summary>
                      step {log.step_index} · {log.perception_page_type ?? 'unknown'} · {log.perception_url}
                    </summary>
                    {log.plan && (
                      <div style={{ paddingLeft: 12 }}>
                        <p>
                          <em>reasoning:</em> {log.plan.reasoning}
                        </p>
                        <p>
                          <em>expected:</em> {log.plan.expectedOutcome}
                        </p>
                        <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                          {JSON.stringify(log.plan.actions, null, 1)}
                        </pre>
                      </div>
                    )}
                  </details>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
