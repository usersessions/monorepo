import { NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cf-env'

// Temporary debug route — delete after confirming env vars are visible on Cloudflare
export async function GET() {
  return NextResponse.json({
    hasSecret: !!(await getEnvVar('PAYSTACK_SECRET_KEY')),
    hasPublic: !!(await getEnvVar('PAYSTACK_PUBLIC_KEY')),
    hasStarterMonthly: !!(await getEnvVar('PAYSTACK_PLAN_STARTER_MONTHLY')),
    hasStarterAnnual: !!(await getEnvVar('PAYSTACK_PLAN_STARTER_ANNUAL')),
    hasProMonthly: !!(await getEnvVar('PAYSTACK_PLAN_PRO_MONTHLY')),
    hasProAnnual: !!(await getEnvVar('PAYSTACK_PLAN_PRO_ANNUAL')),
    nodeEnv: process.env.NODE_ENV,
  })
}
