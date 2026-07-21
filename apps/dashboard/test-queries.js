const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  console.log('Testing queries...')

  const queries = [
    { name: 'profiles', promise: supabase.from('profiles').select('full_name, email, plan').limit(1) },
    { name: 'campaigns', promise: supabase.from('campaigns').select('*', { count: 'exact', head: true }) },
    { name: 'submissions (all)', promise: supabase.from('submissions').select('*', { count: 'exact', head: true }) },
    { name: 'submissions (live)', promise: supabase.from('submissions').select('*', { count: 'exact', head: true }).in('status', ['live', 'indexed']) },
    { name: 'distribution_scores', promise: supabase.from('distribution_scores').select('score, computed_at').limit(1) },
    { name: 'visibility_checks', promise: supabase.from('visibility_checks').select('mentioned, checked_at').limit(1) },
    { name: 'notifications', promise: supabase.from('notifications').select('id, kind, title, body, read, created_at').limit(1) },
    { name: 'products', promise: supabase.from('products').select('*', { count: 'exact', head: true }) },
    { name: 'visibility_queries', promise: supabase.from('visibility_queries').select('*', { count: 'exact', head: true }) }
  ]

  for (const q of queries) {
    try {
      const { data, error } = await q.promise
      if (error) {
        console.error(`❌ ${q.name} failed:`, error.message)
      } else {
        console.log(`✅ ${q.name} succeeded`)
      }
    } catch (err) {
      console.error(`💥 ${q.name} crashed:`, err.message)
    }
  }
}

test()
