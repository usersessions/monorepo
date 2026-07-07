import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { PLATFORM_SCRIPTS } from '@usersessions/shared'
import type { ActionPlan, AgentAction, AgentRunContext, PerceptionPayload, PlatformScript } from '@usersessions/shared'

/**
 * POST /api/agent/plan — the agent's brain (Bearer auth, called by the extension).
 * Receives a perception payload (DOM snapshot + screenshot), returns a validated
 * ActionPlan. The AI key lives ONLY here. Screenshots are used in-flight for
 * planning and are NEVER persisted — stronger than encrypt-and-expire.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_ACTIONS = 3
const MAX_SESSIONS_PER_HOUR = 5
const ACTION_TYPES = new Set(['click', 'type', 'select', 'upload', 'scroll', 'wait', 'navigate', 'submit', 'pause', 'complete'])
const AUTH_HOSTS = ['accounts.google.com', 'github.com', 'twitter.com', 'x.com', 'appleid.apple.com']

function navAllowed(url: string, script: PlatformScript): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === script.domain || host.endsWith(`.${script.domain}`) || AUTH_HOSTS.includes(host)
  } catch {
    return false
  }
}

function buildPrompt(
  script: PlatformScript,
  runContext: Partial<AgentRunContext>,
  perception: PerceptionPayload,
  history: AgentAction[],
  stepIndex: number
): string {
  return [
    `You are a browser automation agent submitting a product listing to ${script.name}.`,
    'You receive a DOM snapshot, a screenshot of the page, your recent action history, and the product data.',
    '',
    'Respond with ONLY a JSON object shaped exactly:',
    '{"reasoning":"...max 200 words...","actions":[...1 to 3 actions...],"expectedOutcome":"...","fallbackActions":[...]}',
    '',
    'Available actions:',
    '- {"type":"click","selector":"css","description":"..."}',
    '- {"type":"type","selector":"css","value":"text","clearFirst":true}',
    '- {"type":"select","selector":"css","value":"option text or value"}',
    '- {"type":"scroll","direction":"down"|"up"|"toElement","selector":"css"}',
    '- {"type":"wait","durationMs":1000}',
    '- {"type":"navigate","url":"https://..."}',
    '- {"type":"submit","selector":"form or button css"}',
    '- {"type":"pause","reason":"auth_required"|"captcha"|"human_verification","message":"why"}',
    '- {"type":"complete","result":"success"|"already_exists"|"error"}',
    '',
    'RULES (non-negotiable):',
    '- Max 3 actions per plan. Verify happens after every batch.',
    '- Selector priority: [data-testid] > [name] > #id > stable structural path. Avoid fragile class names.',
    '- If the page is a login/OAuth wall: PAUSE with auth_required.',
    '- If a CAPTCHA or 2FA prompt is present: PAUSE with captcha.',
    '- If nothing on the page matches the expected flow: PAUSE with human_verification.',
    '- If the page shows a success confirmation: COMPLETE with success.',
    '- If it says the product already exists / was already submitted: COMPLETE with already_exists.',
    '- NEVER navigate off this platform\'s domain. Never guess URLs — use the navigation flow below.',
    '- NEVER select a paid tier, checkout, or upsell. Free/standard tier only.',
    '- Only fill fields with the product data given. If a value is empty, SKIP that field — never invent data.',
    '',
    'Product data (the ONLY values you may type):',
    JSON.stringify(
      {
        title: runContext.title ?? '',
        url: runContext.url ?? '',
        tagline: runContext.tagline ?? '',
        hook: runContext.hook ?? '',
        body: runContext.body ?? '',
        founderName: runContext.founderName ?? '',
        contactEmail: runContext.contactEmail ?? '',
        category: runContext.category ?? '',
        tags: runContext.tags ?? [],
        pricingModel: runContext.pricingModel ?? '',
      },
      null,
      1
    ),
    '',
    `Platform navigation flow (rule-based reference):`,
    JSON.stringify(script.steps, null, 1),
    script.fieldRules ? `Field rules: ${JSON.stringify(script.fieldRules)}` : '',
    `Success indicators: ${JSON.stringify(script.successIndicators)}`,
    `Error indicators: ${JSON.stringify(script.errorIndicators)}`,
    '',
    `Current step index: ${stepIndex}`,
    `Previous actions (most recent last): ${JSON.stringify(history.slice(-5))}`,
    '',
    'Current page state:',
    `URL: ${perception.url}`,
    `Title: ${perception.title}`,
    `Detected page type: ${perception.pageType}`,
    `Headings: ${JSON.stringify(perception.domSnapshot?.headings ?? [])}`,
    `Forms: ${JSON.stringify(perception.domSnapshot?.forms ?? [])}`,
    `Buttons: ${JSON.stringify(perception.domSnapshot?.buttons ?? [])}`,
    `Interactive elements (top 20): ${JSON.stringify((perception.interactiveElements ?? []).slice(0, 20))}`,
    `Visible text (truncated): ${(perception.domSnapshot?.textContent ?? '').slice(0, 3000)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function validatePlan(raw: unknown, sessionId: string, stepIndex: number, script: PlatformScript): ActionPlan {
  const obj = (raw ?? {}) as Record<string, unknown>
  const sanitize = (list: unknown): AgentAction[] =>
    (Array.isArray(list) ? list : [])
      .filter((a): a is AgentAction => Boolean(a && typeof a === 'object' && ACTION_TYPES.has((a as AgentAction).type)))
      .map((a) => {
        // Domain lock is validated server-side too: a rogue navigate becomes a pause.
        if (a.type === 'navigate' && !navAllowed(a.url, script)) {
          return {
            type: 'pause' as const,
            reason: 'human_verification' as const,
            message: `Planner proposed navigation off-platform (${a.url}) — blocked.`,
          }
        }
        if (a.type === 'wait') return { ...a, durationMs: Math.min(Number(a.durationMs) || 1_000, 10_000) }
        return a
      })
      .slice(0, MAX_ACTIONS)

  const actions = sanitize(obj.actions)
  return {
    sessionId,
    stepIndex: stepIndex + 1,
    actions: actions.length
      ? actions
      : [{ type: 'pause', reason: 'human_verification', message: 'Planner returned no executable actions.' }],
    reasoning: String(obj.reasoning ?? '').slice(0, 2_000),
    expectedOutcome: String(obj.expectedOutcome ?? '').slice(0, 500),
    fallbackActions: sanitize(obj.fallbackActions),
  }
}

export async function POST(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!rateLimit(`agent-plan:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  const sessionId = String(body.sessionId ?? '')
  const platformId = String(body.platformId ?? '')
  const stepIndex = Number(body.stepIndex ?? 0)
  const perception = body.perception as PerceptionPayload | undefined
  const runContext = (body.runContext ?? {}) as Partial<AgentRunContext>
  const history = (Array.isArray(body.history) ? body.history : []) as AgentAction[]
  if (!sessionId || !platformId || !perception?.url) {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  const script = PLATFORM_SCRIPTS[platformId]
  if (!script) return NextResponse.json({ error: 'UNKNOWN_PLATFORM' }, { status: 400 })

  const db = createServiceClient()

  // Server-enforced budget: max 5 NEW agent sessions per rolling hour per user.
  const { data: existing } = await db.from('agent_sessions').select('user_id').eq('id', sessionId).maybeSingle()
  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  if (!existing) {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await db
      .from('agent_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo)
    if ((count ?? 0) >= MAX_SESSIONS_PER_HOUR) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
    }
    await db.from('agent_sessions').insert({
      id: sessionId,
      user_id: user.id,
      campaign_id: (body.campaignId as string) ?? null,
      product_id: (body.productId as string) ?? null,
      platform_id: platformId,
      status: 'running',
      current_step: stepIndex,
      total_steps: script.steps.length,
      simulated: body.simulated !== false,
      run_context: runContext,
    })
  } else {
    await db
      .from('agent_sessions')
      .update({ status: 'running', current_step: stepIndex, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', user.id)
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'PLANNER_UNAVAILABLE' }, { status: 503 })

  try {
    const parts: Array<Record<string, unknown>> = [
      { text: buildPrompt(script, runContext, perception, history, stepIndex) },
    ]
    const shot = typeof perception.screenshotBase64 === 'string' ? perception.screenshotBase64 : ''
    if (shot.startsWith('data:image/') && shot.includes(',')) {
      parts.push({
        inline_data: { mime_type: shot.slice(5, shot.indexOf(';')), data: shot.slice(shot.indexOf(',') + 1) },
      })
    }

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2000 },
      }),
    })
    if (!res.ok) throw new Error(`gemini ${res.status} (model=${GEMINI_MODEL})`)
    const payload = await res.json()
    const text: string = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const plan = validatePlan(JSON.parse(text), sessionId, stepIndex, script)

    // Step log for the dashboard monitor — the plan, never the screenshot.
    await db
      .from('agent_logs')
      .insert({
        session_id: sessionId,
        step_index: stepIndex,
        perception_url: perception.url,
        perception_page_type: perception.pageType ?? 'unknown',
        plan,
      })
      .then(
        () => undefined,
        () => undefined // logging is best-effort
      )

    return NextResponse.json(plan)
  } catch (err) {
    console.error('[agent/plan] planning failed:', err)
    return NextResponse.json({ error: 'PLANNER_UNAVAILABLE' }, { status: 502 })
  }
}
