import { NextResponse } from 'next/server'

// Temporary debug route — delete after confirming env vars are visible on Cloudflare
export async function GET() {
  return NextResponse.json({
    hasSecret: !!process.env.PAYSTACK_SECRET_KEY,
    hasPublic: !!process.env.PAYSTACK_PUBLIC_KEY,
    hasStarterMonthly: !!process.env.PAYSTACK_PLAN_STARTER_MONTHLY,
    hasStarterAnnual: !!process.env.PAYSTACK_PLAN_STARTER_ANNUAL,
    hasProMonthly: !!process.env.PAYSTACK_PLAN_PRO_MONTHLY,
    hasProAnnual: !!process.env.PAYSTACK_PLAN_PRO_ANNUAL,
    nodeEnv: process.env.NODE_ENV,
  })
}
