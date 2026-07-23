import { NextResponse } from 'next/server'

// Temporary debug route — delete after confirming env vars are visible on Cloudflare
export async function GET() {
  // Filter out built-in Next.js/Node keys, show custom keys only
  const builtInPrefixes = ['npm_', 'NX_', 'NEXT_', 'NODE_', 'PATH', 'HOME', 'USER', 'PWD', 'SHELL', 'OPEN_NEXT']
  const customKeys = Object.keys(process.env).filter(
    k => !builtInPrefixes.some(prefix => k.startsWith(prefix))
  )

  return NextResponse.json({
    // Direct checks
    hasSecret: !!process.env.PAYSTACK_SECRET_KEY,
    hasPublic: !!process.env.PAYSTACK_PUBLIC_KEY,
    hasStarterMonthly: !!process.env.PAYSTACK_PLAN_STARTER_MONTHLY,
    // Keys that are actually visible (no values, just names)
    visibleCustomKeys: customKeys,
    // Supabase check as a cross-reference
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    nextRuntime: process.env.NEXT_RUNTIME,
  })
}
