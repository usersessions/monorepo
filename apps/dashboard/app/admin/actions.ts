'use server'

import { revalidatePath } from 'next/cache'
import { audit, requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function toggleFlag(formData: FormData) {
  const { user } = await requireAdmin()
  const flagName = String(formData.get('flagName') ?? '')
  const enabled = String(formData.get('enabled')) === 'true'
  if (!flagName) return

  const db = createServiceClient()
  await db.from('feature_flags').update({ enabled, updated_at: new Date().toISOString() }).eq('flag_name', flagName)
  await audit(user.id, 'flag_toggle', null, { flagName, enabled })
  revalidatePath('/admin/flags')
}

export async function setSubscriptionStatus(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!targetUserId || !['none', 'active', 'non_renewing', 'attention', 'cancelled'].includes(status)) return

  const db = createServiceClient()
  await db.from('profiles').update({ subscription_status: status }).eq('id', targetUserId)
  await audit(user.id, 'billing_override_status', targetUserId, { status })
  revalidatePath('/admin/users')
}

export async function setPlan(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  const plan = String(formData.get('plan') ?? '')
  if (!targetUserId || !['free', 'founder', 'agency'].includes(plan)) return

  const db = createServiceClient()
  await db.from('profiles').update({ plan }).eq('id', targetUserId)
  await audit(user.id, 'billing_override_plan', targetUserId, { plan })
  revalidatePath('/admin/users')
}

/**
 * Adapter review (BUILD_SPEC §7): approve records the reviewer and stages a 10% rollout row;
 * the actual rollout mechanics are extension-side. Reject records the reviewer and closes the run.
 */
export async function reviewAdapterRun(formData: FormData) {
  const { user } = await requireAdmin()
  const runId = String(formData.get('runId') ?? '')
  const decision = String(formData.get('decision') ?? '')
  if (!runId || !['approve', 'reject'].includes(decision)) return

  const db = createServiceClient()
  const { data: run } = await db.from('adapter_runs').select('*').eq('id', runId).maybeSingle()
  if (!run || run.status !== 'pending_review') return

  await db
    .from('adapter_runs')
    .update({
      status: decision === 'approve' ? 'passed' : 'failed',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', runId)

  if (decision === 'approve') {
    await db.from('adapter_runs').insert({
      platform_id: run.platform_id,
      run_type: 'staged_rollout',
      status: 'passed',
      proposed_diff: run.proposed_diff,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
  }

  await audit(user.id, decision === 'approve' ? 'adapter_approve_stage_10pct' : 'adapter_reject', null, {
    runId,
    platformId: run.platform_id,
  })
  revalidatePath('/admin/adapters')
}

/** Suspend a user: blocks API access and future sign-ins. Admins can never be suspended. */
export async function suspendUser(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  const reason = String(formData.get('reason') ?? '').slice(0, 500)
  if (!targetUserId) return

  const db = createServiceClient()
  const { data: target } = await db.from('profiles').select('role').eq('id', targetUserId).maybeSingle()
  if (!target || target.role === 'admin') return

  await db.from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', targetUserId)
  await audit(user.id, 'user_suspend', targetUserId, { reason: reason || null })
  revalidatePath('/admin/users')
}

export async function unsuspendUser(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = String(formData.get('userId') ?? '')
  if (!targetUserId) return

  const db = createServiceClient()
  await db.from('profiles').update({ suspended_at: null }).eq('id', targetUserId)
  await audit(user.id, 'user_unsuspend', targetUserId, null)
  revalidatePath('/admin/users')
}

/**
 * Platform request status transitions. Notifying the requester by email is a documented
 * deferral (no existing template/schema for this notification type) — status + audit-log
 * only for now.
 */
export async function setPlatformRequestStatus(formData: FormData) {
  const { user } = await requireAdmin()
  const requestId = String(formData.get('requestId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!requestId || !['pending', 'under_review', 'approved', 'rejected', 'shipped'].includes(status)) return

  const db = createServiceClient()
  await db.from('platform_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', requestId)
  await audit(user.id, 'platform_request_status', null, { requestId, status })
  revalidatePath('/admin/platform-requests')
}
