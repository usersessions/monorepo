import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public: marketing, auth flow, shareable reports, pricing. /api routes self-authenticate (Bearer, cron secret, or webhook signature).
const PUBLIC_PREFIXES = ['/home', '/login', '/signup', '/rx', '/auth', '/reports', '/pricing', '/api', '/terms', '/privacy', '/support']

/** Security headers on every response, including redirects. CSP is deferred until
 *  nonce handling for Next.js inline chunks is validated in a local build. */
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    // Logged-out visitors hitting the root see marketing; anything else asks them to sign in.
    url.pathname = path === '/' ? '/home' : '/login'
    return withSecurityHeaders(NextResponse.redirect(url))
  }

  return withSecurityHeaders(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
